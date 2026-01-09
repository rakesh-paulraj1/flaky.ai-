import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authentication } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { runAgent } from "@/langgraph/graph";
import { sandboxService } from "@/langgraph/services";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authentication);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const { id: chatId } = await params;
  if (!chatId) {
    return new Response(JSON.stringify({ error: "Missing chat ID" }), {
      status: 400,
    });
  }


  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      project: true,
    },
  });
  if (!chat) {
    return new Response(JSON.stringify({ error: "Chat not found" }), {
      status: 404,
    });
  }

  const latestMessage = await prisma.message.findFirst({
    where: {
      chatId,
      role: "user",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!latestMessage) {
    console.log("no messages available");
    return new Response(JSON.stringify({ error: "No user message found" }), {
      status: 404,
    });
  }

  const projectContext = chat.project
    ? {
        productName: chat.project.productName || "",
        productDescription: chat.project.productDetails || "",
        imageLink:
          chat.project.generatedimageLink || "",
      }
    : undefined;

  const encoder = new TextEncoder();
  const messageId = Date.now().toString();

  const stream = new ReadableStream({
    async start(controller) {
      let assistantContent = "";

      try {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "start", id: messageId })}\n\n`
          )
        );

        const sandbox = await sandboxService.getSandbox(chatId);

        await runAgent({
          projectId: chatId,
          userPrompt: latestMessage.content,
          sandbox,
          projectContext,
          sendEvent: async (payload) => {
            const eventPayload = { type: "partial", id: messageId, payload };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(eventPayload)}\n\n`)
            );

            if (payload.e === "thinking" && payload.message) {
              assistantContent += payload.message + "\n";
            } else if (payload.e === "planner_complete" && payload.plan) {
              assistantContent += "Plan created\n";
            } else if (payload.e === "builder_complete") {
              assistantContent += "Build completed\n";
            }

            try {
              await prisma.message.create({
                data: {
                  chatId,
                  role: "assistant",
                  content: JSON.stringify(payload),
                  eventType: payload.e as string,
                },
              });
            } catch (dbError) {
              console.error("Failed to save event message:", dbError);
            }
          },
        });

        if (assistantContent) {
          await prisma.message.create({
            data: {
              chatId,
              role: "assistant",
              content: assistantContent.trim(),
              eventType: "summary",
            },
          });
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "done", id: messageId })}\n\n`
          )
        );
        controller.close();
      } catch (error) {
        console.error("Agent execution error:", error);
        const errorPayload = {
          type: "error",
          message:
            error instanceof Error ? error.message : "Agent execution failed",
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(errorPayload)}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
