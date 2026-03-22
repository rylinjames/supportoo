import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Rewrite POST requests to root "/" to the webhook handler
  // This handles the case where Whop sends webhooks to the base_url
  if (request.method === "POST" && request.nextUrl.pathname === "/") {
    return NextResponse.rewrite(new URL("/api/webhooks/whop", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
