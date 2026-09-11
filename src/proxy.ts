import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: redirects visitors without a session cookie to /login.
// Pages and actions still verify the session for real (see requireUser()). API routes are
// left out: they check the session themselves and answer 401 instead of an HTML redirect.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    // Public: login, API (checks itself), static assets, PWA manifest and icons.
    "/((?!login|api/|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon).*)",
  ],
};
