import { NextRequest, NextResponse } from "next/server";
import { sandboxService } from "@/langgraph/services";
import prisma from "@/lib/prisma";

const NETLIFY_API = "https://api.netlify.com/api/v1";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const netlifyToken = process.env.NETLIFY_API_KEY;

    if (!netlifyToken) {
      return NextResponse.json(
        { error: "Netlify API key not configured" },
        { status: 500 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        chatId: true,
        productName: true,
        netlifySiteId: true,
        state: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const sandbox = await sandboxService.getSandbox(project.chatId);

    const buildResult = await sandbox.commands.run(
      "cd /home/user/react-app && npm run build",
      { timeoutMs: 120000 }
    );

    await sandbox.commands.run(
      'echo "/*    /index.html   200" > /home/user/react-app/dist/_redirects'
    );

    const zipResult = await sandbox.commands.run(`
cd /home/user/react-app && python3 -c "
import zipfile, os
with zipfile.ZipFile('/tmp/dist.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk('dist'):
        for f in files:
            zf.write(os.path.join(root, f))
"
    `);

    if (zipResult.exitCode !== 0) {
      return NextResponse.json(
        { error: "Failed to create archive", details: zipResult.stderr },
        { status: 500 }
      );
    }

    const distArchive = await sandbox.files.read("/tmp/dist.zip", {
      format: "bytes",
    });

    let siteId = project.netlifySiteId;

    if (!siteId) {
      const sanitizedName = project.productName
        .replace(/[^a-zA-Z0-9]/g, "-")
        .toLowerCase()
        .slice(0, 30);

      const createRes = await fetch(`${NETLIFY_API}/sites`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${netlifyToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `${sanitizedName}-${Date.now()}`,
        }),
      });

      if (!createRes.ok) {
        const error = await createRes.text();

        return NextResponse.json(
          { error: "Failed to create Netlify site", details: error },
          { status: 500 }
        );
      }

      const siteData = await createRes.json();

      siteId = siteData.id;

      if (!siteId) {
        return NextResponse.json(
          { error: "Failed to get site ID from Netlify", details: siteData },
          { status: 500 }
        );
      }

      await prisma.project.update({
        where: { id: projectId },
        data: { netlifySiteId: siteId },
      });
    }

    let deployRes = await fetch(`${NETLIFY_API}/sites/${siteId}/deploys`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${netlifyToken}`,
        "Content-Type": "application/zip",
      },
      body: Buffer.from(distArchive),
    });

    if (deployRes.status === 404) {
      const sanitizedName = project.productName
        .replace(/[^a-zA-Z0-9]/g, "-")
        .toLowerCase()
        .slice(0, 30);

      const createRes = await fetch(`${NETLIFY_API}/sites`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${netlifyToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `${sanitizedName}-${Date.now()}`,
        }),
      });

      if (!createRes.ok) {
        const error = await createRes.text();

        return NextResponse.json(
          { error: "Failed to create Netlify site", details: error },
          { status: 500 }
        );
      }

      const siteData = await createRes.json();
      siteId = siteData.id;

      await prisma.project.update({
        where: { id: projectId },
        data: { netlifySiteId: siteId },
      });

      deployRes = await fetch(`${NETLIFY_API}/sites/${siteId}/deploys`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${netlifyToken}`,
          "Content-Type": "application/zip",
        },
        body: Buffer.from(distArchive),
      });
    }

    const deployResponseText = await deployRes.text();

    if (!deployRes.ok) {
      return NextResponse.json(
        { error: "Failed to deploy to Netlify", details: deployResponseText },
        { status: 500 }
      );
    }

    const deployData = JSON.parse(deployResponseText);
    const deployedUrl =
      deployData.ssl_url || deployData.deploy_ssl_url || deployData.url;

    await prisma.project.update({
      where: { id: projectId },
      data: {
        netlifySiteId: siteId,
        deployedUrl: deployedUrl,
        state: "DEPLOYED",
      },
    });

    return NextResponse.json({
      success: true,
      deployedUrl,
      siteId,
      deployState: deployData.state,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Deployment failed", details: String(error) },
      { status: 500 }
    );
  }
}
