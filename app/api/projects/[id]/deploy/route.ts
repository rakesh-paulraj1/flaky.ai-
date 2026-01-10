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

    await sandbox.commands.run(
      'mkdir -p /home/user/react-app/public && echo "/*    /index.html   200" > /home/user/react-app/public/_redirects'
    );

    const lsResult = await sandbox.commands.run("ls -la /home/user/react-app/");
    console.log("Source folder contents:", lsResult.stdout);

    console.log("Creating zip of source code...");
    const zipResult = await sandbox.commands.run(`
      cd /home/user/react-app && \\
      python3 -c "
import zipfile
import os

exclude_dirs = {'node_modules', '.git', 'dist', '.cache'}
exclude_files = {'.DS_Store'}

with zipfile.ZipFile('/tmp/source.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk('.'):
        # Exclude certain directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in files:
            if file not in exclude_files:
                file_path = os.path.join(root, file)
                arcname = file_path[2:] if file_path.startswith('./') else file_path
                zf.write(file_path, arcname)
print('Source zip created successfully')
"
    `);

    if (zipResult.exitCode !== 0) {
      console.error("Zip failed:", zipResult.stderr);
      return NextResponse.json(
        { error: "Failed to create archive", details: zipResult.stderr },
        { status: 500 }
      );
    }
    console.log("Zip output:", zipResult.stdout);

    // Debug: Check zip file
    const zipSizeResult = await sandbox.commands.run(
      "ls -la /tmp/source.zip && unzip -l /tmp/source.zip | head -30"
    );
    console.log("Zip file info:", zipSizeResult.stdout);

    const sourceArchive = await sandbox.files.read("/tmp/source.zip");
    console.log("Source zip file size:", sourceArchive.length, "bytes");

    let siteId = project.netlifySiteId;
    let siteUrl = "";

    if (!siteId) {
      console.log("Creating new Netlify site with build settings...");
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
          // Build settings for Vite React app
          build_settings: {
            cmd: "npm install && npm run build",
            dir: "dist",
          },
        }),
      });

      if (!createRes.ok) {
        const error = await createRes.text();
        console.error("Failed to create Netlify site:", error);
        return NextResponse.json(
          { error: "Failed to create Netlify site", details: error },
          { status: 500 }
        );
      }

      const siteData = await createRes.json();
      siteId = siteData.id;
      console.log("Created site with ID:", siteId);
      siteUrl = siteData.ssl_url || siteData.url;
      console.log("Site URL:", siteUrl);
    }

    console.log(
      "Deploying source code to Netlify (will build on their servers)..."
    );
    const deployRes = await fetch(`${NETLIFY_API}/sites/${siteId}/deploys`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${netlifyToken}`,
        "Content-Type": "application/zip",
      },
      body: sourceArchive,
    });

    const deployResponseText = await deployRes.text();
    console.log("Deploy response status:", deployRes.status);
    console.log("Deploy response body:", deployResponseText);

    if (!deployRes.ok) {
      console.error("Failed to deploy to Netlify:", deployResponseText);
      return NextResponse.json(
        { error: "Failed to deploy to Netlify", details: deployResponseText },
        { status: 500 }
      );
    }

    const deployData = JSON.parse(deployResponseText);
    const deployedUrl =
      deployData.ssl_url || deployData.deploy_ssl_url || deployData.url;
    console.log("Deploy initiated:", deployedUrl);
    console.log("Deploy state:", deployData.state);
    console.log("Deploy ID:", deployData.id);

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
      deployId: deployData.id,
      deployState: deployData.state,
    });
  } catch (error) {
    console.error("Deploy failed:", error);
    return NextResponse.json(
      { error: "Deployment failed", details: String(error) },
      { status: 500 }
    );
  }
}
