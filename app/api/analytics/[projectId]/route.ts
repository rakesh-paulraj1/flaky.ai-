import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await req.json();

    const pageView = await prisma.pageView.create({
      data: {
        projectId,
        utmSource: body.utmSource || null,
        utmMedium: body.utmMedium || null,
        utmCampaign: body.utmCampaign || null,
        utmContent: body.utmContent || null,
        utmTerm: body.utmTerm || null,
        referrer: body.referrer || null,
        userAgent: req.headers.get("user-agent") || null,
      },
    });

    return NextResponse.json({ success: true, id: pageView.id });
  } catch (error) {
    console.error("Failed to record page view:", error);
    return NextResponse.json(
      { error: "Failed to record page view" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    const totalViews = await prisma.pageView.count({
      where: { projectId },
    });

    const viewsBySource = await prisma.pageView.groupBy({
      by: ["utmSource"],
      where: { projectId },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    const viewsByCampaign = await prisma.pageView.groupBy({
      by: ["utmCampaign"],
      where: { projectId },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    const recentViews = await prisma.pageView.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        utmSource: true,
        utmCampaign: true,
        referrer: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      totalViews,
      viewsBySource: viewsBySource.map((v) => ({
        source: v.utmSource || "Direct",
        count: v._count.id,
      })),
      viewsByCampaign: viewsByCampaign.map((v) => ({
        campaign: v.utmCampaign || "None",
        count: v._count.id,
      })),
      recentViews,
    });
  } catch (error) {
    console.error("Failed to get analytics:", error);
    return NextResponse.json(
      { error: "Failed to get analytics" },
      { status: 500 }
    );
  }
}
