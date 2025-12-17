import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication (pages)
const protectedRoutes = ["/", "/admin", "/settings"];
// Routes that are public (no auth required)
const publicRoutes = ["/login", "/auth/error"];
// Routes exempt from onboarding check
const onboardingExemptRoutes = ["/onboarding", "/login", "/auth/error", "/api"];

export default auth((req) => {
    const { nextUrl } = req;
    const isLoggedIn = !!req.auth;
    const isAdmin = req.auth?.user?.isAdmin ?? false;
    const isOnboardingComplete = req.auth?.user?.onboardingComplete ?? false;

    const pathname = nextUrl.pathname;

    // Check if the route is protected
    const isProtectedRoute = protectedRoutes.some(
        (route) => pathname === route || pathname.startsWith(route + "/")
    );
    const isPublicRoute = publicRoutes.includes(pathname);
    const isAdminRoute = pathname.startsWith("/admin");
    const isAdminApiRoute = pathname.startsWith("/api/admin");
    const isOnboardingExempt = onboardingExemptRoutes.some(
        (route) => pathname === route || pathname.startsWith(route + "/")
    );

    // Redirect unauthenticated users to login (pages only)
    if (isProtectedRoute && !isLoggedIn) {
        const loginUrl = new URL("/login", nextUrl.origin);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Redirect authenticated users away from login page
    if (isPublicRoute && isLoggedIn) {
        // If onboarding not complete, redirect to onboarding
        // DISABLED: User requested to bypass onboarding for now
        /*
        if (!isOnboardingComplete) {
            return NextResponse.redirect(new URL("/onboarding", nextUrl.origin));
        }
        */
        return NextResponse.redirect(new URL("/", nextUrl.origin));
    }

    // Redirect users who haven't completed onboarding
    // DISABLED: User requested to bypass onboarding for now
    /*
    if (isLoggedIn && !isOnboardingComplete && !isOnboardingExempt) {
        return NextResponse.redirect(new URL("/onboarding", nextUrl.origin));
    }
    */

    // Block non-admin users from admin routes (pages)
    if (isAdminRoute && isLoggedIn && !isAdmin) {
        return NextResponse.redirect(new URL("/", nextUrl.origin));
    }

    // SECURITY: Block non-admin users from admin API routes
    // Returns 403 instead of redirect for API routes
    if (isAdminApiRoute && !isAdmin) {
        return NextResponse.json(
            { error: "Forbidden: Admin access required" },
            { status: 403 }
        );
    }

    return NextResponse.next();
});


export const config = {
    matcher: [
        // Match all routes except static files
        // NOTE: We now INCLUDE /api/admin routes for protection
        "/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)",
    ],
};
