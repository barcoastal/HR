import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Paths under these prefixes are publicly reachable without a session.
// Everything else inside the app requires an authenticated NextAuth token.
const PUBLIC_PREFIXES = [
  "/login",
  "/sign", // /sign/[token] flow for offer-letter signing
  "/fill", // /fill/[token] flow for onboarding doc filling
  "/careers", // public careers page
  "/api/auth", // NextAuth endpoints (signin, callback, session, etc.)
  "/api/careers", // public application submit endpoint
  "/api/cron", // already secret-guarded inside each route
];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request });
  if (token) {
    return NextResponse.next();
  }

  // API requests get a 401; UI requests redirect to /login with a return URL.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Skip Next.js internals + static assets; we still want to gate the rest.
    "/((?!_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
