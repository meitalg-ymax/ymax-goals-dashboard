import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Vercel's cron invokes GET /api/import/budget directly (no browser
  // session) with the same Bearer CRON_SECRET the route itself checks --
  // bypass the cookie-auth check only for that exact secret, so the manual
  // POST button behind DataOpsBar still requires a logged-in session same as
  // before. (This must stay committed to git -- an earlier version of this
  // fix was only ever pushed via a direct `vercel deploy` and got silently
  // wiped out by the next git-based redeploy, breaking the daily cron for a
  // day before anyone noticed. See app/api/import/budget/route.ts.)
  const authHeader = request.headers.get("authorization");
  if (
    request.nextUrl.pathname.startsWith("/api/import/budget") &&
    authHeader === `Bearer ${process.env.CRON_SECRET}`
  ) {
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Run on every route except static assets and the sync API (which uses
    // its own CRON_SECRET check, not cookie-based auth).
    "/((?!_next/static|_next/image|favicon.ico|api/sync).*)",
  ],
};
