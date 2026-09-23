import { NextResponse, type NextRequest } from "next/server";

// Temporary shared-password gate (HTTP Basic auth) so the prototype can be
// online before real sign-in lands in M2 — delete this file then. Any username
// works; the password must match SITE_PASSWORD. Fails closed if SITE_PASSWORD
// is unset, except in local `next dev`.
export function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV === "development") return NextResponse.next();
    return new NextResponse("Site password not configured.", { status: 503 });
  }

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      if (decoded.slice(decoded.indexOf(":") + 1) === password) {
        return NextResponse.next();
      }
    } catch {}
  }

  return new NextResponse("Password required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="ModuleTracker", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
