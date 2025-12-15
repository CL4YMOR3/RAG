'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
    error: Error & { digest?: string };
    reset: () => void;
}

/**
 * Error boundary component for the app.
 * Provides a recovery action instead of a blank screen.
 */
export default function Error({ error, reset }: ErrorBoundaryProps) {
    useEffect(() => {
        // Log error to console in development
        console.error('Application error:', error);

        // TODO: Send to error tracking service (e.g., Sentry)
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-void text-txt-primary px-4">
            <div className="flex flex-col items-center text-center max-w-md">
                {/* Error Icon */}
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
                    <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>

                {/* Error Message */}
                <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
                <p className="text-txt-secondary mb-6">
                    We encountered an unexpected error. Please try again or contact support if the problem persists.
                </p>

                {/* Error Details (Development Only) */}
                {process.env.NODE_ENV === 'development' && (
                    <div className="w-full mb-6 p-4 bg-surface-elevated rounded-lg border border-white-10 text-left">
                        <p className="text-xs font-mono text-red-400 break-all">
                            {error.message}
                        </p>
                        {error.digest && (
                            <p className="text-xs text-txt-tertiary mt-2">
                                Digest: {error.digest}
                            </p>
                        )}
                    </div>
                )}

                {/* Recovery Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={reset}
                        className="flex items-center gap-2 px-4 py-2.5 bg-brand-primary hover:bg-brand-secondary text-white rounded-lg font-medium transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Try Again
                    </button>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="px-4 py-2.5 border border-white-10 text-txt-secondary hover:text-txt-primary hover:bg-white/5 rounded-lg transition-colors"
                    >
                        Go Home
                    </button>
                </div>
            </div>
        </div>
    );
}
