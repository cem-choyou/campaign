import { type NextRequest, NextResponse } from "next/server";

// Runs before every page request (Next 16 "proxy", Node runtime):
// 1. per-request CSP nonce (§5);
// 2. cheap redirect to /connexion when there is no session cookie. The session itself is
//    verified against the database by the (app) layout and every Server Action.

const PUBLIC_PREFIXES = [
  "/connexion",
  "/invitation",
  "/kit",
  "/confidentialite",
  "/mentions-legales",
];
const SESSION_COOKIES = ["__Secure-authjs.session-token", "authjs.session-token"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // FullCalendar and Framer Motion set inline styles at runtime.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    // FullCalendar ships its icon font as a data: URI.
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    // Sign-in forms redirect to Google's consent page.
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (!hasSession && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (pathname.startsWith("/kit")) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
