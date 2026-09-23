import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAllowedEmail } from "@/lib/allowlist";

// Sends anyone not signed in (or no longer on ALLOWED_EMAILS) to /signin.
// This is the optimistic first gate; Server Actions re-check via requireUser().
export const proxy = auth((req) => {
  const { pathname, search } = req.nextUrl;
  if (pathname === "/signin" || pathname.startsWith("/api/auth")) return;
  if (isAllowedEmail(req.auth?.user?.email)) return;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const url = new URL("/signin", req.nextUrl);
  url.searchParams.set("callbackUrl", pathname + search);
  return NextResponse.redirect(url);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
