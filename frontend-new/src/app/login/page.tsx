"use client";

import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginContent() {
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/";
    const error = searchParams.get("error");

    return (
        <div className="min-h-screen flex items-center justify-center bg-void relative overflow-hidden">
            {/* Gradient Background Effects */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-primary/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse delay-1000" />
            </div>

            {/* Login Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative z-10 w-full max-w-md mx-4"
            >
                <div className="bg-surface border border-white-5 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
                    {/* Logo & Title */}
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold animated-gradient-text mb-2">NEXUS</h1>
                        <p className="text-txt-secondary text-sm">
                            Enterprise RAG System for JWTL
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg"
                        >
                            <p className="text-red-400 text-sm text-center">
                                {error === "AccessDenied"
                                    ? "Access denied. Only @jwtl.in and @jameswarrentea.com emails are allowed."
                                    : "An error occurred during sign in. Please try again."}
                            </p>
                        </motion.div>
                    )}

                    {/* Domain Notice */}
                    <div className="mb-6 p-3 bg-brand-primary/10 border border-brand-primary/20 rounded-lg">
                        <p className="text-txt-secondary text-xs text-center">
                            🔒 Restricted to <span className="text-brand-primary font-medium">@jwtl.in</span> and{" "}
                            <span className="text-brand-primary font-medium">@jameswarrentea.com</span> accounts only
                        </p>
                    </div>

                    {/* Google Sign In Button */}
                    <button
                        onClick={() => signIn("google", { callbackUrl, prompt: "select_account" })}
                        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-medium rounded-lg px-4 py-3 transition-all shadow-lg cursor-pointer"
                    >
                        <GoogleIcon />
                        Sign in with Google
                    </button>

                    {/* Footer */}
                    <p className="text-center text-txt-tertiary text-xs mt-6">
                        By signing in, you agree to JWTL&apos;s terms of service and privacy policy.
                    </p>
                </div>

                {/* Powered By */}
                <p className="text-center text-txt-tertiary text-xs mt-4">
                    Powered by James Warren Tea Limited
                </p>
            </motion.div>
        </div>
    );
}

function GoogleIcon() {
    return (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
        </svg>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-void" />}>
            <LoginContent />
        </Suspense>
    );
}
