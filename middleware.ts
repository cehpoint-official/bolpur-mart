import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
    const session = request.cookies.get("session")?.value;
    const { pathname } = request.nextUrl;

    // Protected routes
    const isProtectedRoute = pathname.startsWith("/chat") || pathname.startsWith("/admin") || pathname.startsWith("/profile");

    if (isProtectedRoute && !session) {
        const loginUrl = new URL("/auth/login", request.url);
        loginUrl.searchParams.set("from", pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Redirect logged-in users away from auth pages
    const isAuthRoute = pathname.startsWith("/auth");
    if (isAuthRoute && session) {
        return NextResponse.redirect(new URL("/chat", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/chat/:path*", "/admin/:path*", "/profile/:path*", "/auth/:path*"],
};
