import { NextResponse, NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const secret = process.env.NEXTAUTH_SECRET;

  const token = await getToken({ req, secret });
  if (token && pathname === "/") {
    return NextResponse.redirect(new URL("/creative", req.url));
  }

  if (!token) {
    if (pathname.startsWith("/api/")) {
    
      if (pathname.startsWith("/api/auth/")) {
        return NextResponse.next();
      }
      
      if (pathname.startsWith("/api/analytics/")) {
        return NextResponse.next();
      }
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 401 }
      );
    }

    if (pathname !== "/") {
      const url = new URL("/", req.url);
      url.searchParams.set("callbackUrl", req.url);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/creative",
    "/projects/:path*",
    "/api/proxy/:path*",
    "/api/((?!auth).*)",
  ],
};
