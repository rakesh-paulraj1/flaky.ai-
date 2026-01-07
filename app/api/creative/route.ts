import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { uploadFileToBlob } from "@/lib/azure-storage";
import { generatecreative } from "@/lib/hf";
import { authentication } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authentication);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  
   
const userid = session.user.id;
if (typeof userid === "undefined" || userid === null) {
  return NextResponse.json({ error: "User ID not found" }, { status: 400 });
}

    const formData = await req.formData();
    const productName = formData.get("productName") as string;
    const productDescription = formData.get("productDescription") as string;
    const ctaLink = formData.get("ctaLink") as string;
    const videoPrompt = formData.get("videoPrompt") as string;

    const file = formData.get("files") as File | null;
    let imageLink: string = "";

   
    if (file && file.size > 0) {
      if (file.type.startsWith("image/")) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        const fileUrl = await uploadFileToBlob(
          buffer,
          file.name,
          file.type
        );
        imageLink=fileUrl
      } else {
        return NextResponse.json(
          { error: "Only image files are allowed" },
          { status: 400 }
        )
      }
    }

    const chat = await prisma.chat.create({
      data: {
        userId:userid,
        title: `${productName} - Creative Project`,
      },
    });

    const project = await prisma.project.create({
      data: {
        id: chat.id,
        chatId: chat.id,
        productName,
        ctalink:ctaLink,
        productDetails: productDescription,
        imageLink: imageLink,
        videoGenerationEntities: videoPrompt,
      },
    });

    let videoUrl: string | undefined;
    if (file && videoPrompt) {
      try {
        const videoBlob = await generatecreative(file, videoPrompt);
        
        const videoBuffer = Buffer.from(await videoBlob.arrayBuffer());
        
        const videoFileName = `${chat.id}-creative-video.mp4`;
        videoUrl = await uploadFileToBlob(
          videoBuffer,
          videoFileName,
          'video/mp4'
        );
      } catch (error) {
        console.error("Error generating video:", error);
      }
    }

    return NextResponse.json({
      success: true,
      chat_id: chat.id,
      project_id: project.id,
      imageLinks: imageLink,
      // videoUrl: videoUrl,
      message: "Creative project created successfully",
    });
  } catch (error) {
    console.error("Error creating creative project:", error);
    return NextResponse.json(
      { error: "Failed to create creative project" },
      { status: 500 }
    );
  }
}
