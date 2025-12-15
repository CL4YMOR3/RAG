'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
    width?: string | number;
    height?: string | number;
    lines?: number;
}

/**
 * Skeleton loader component for content placeholders.
 * Replaces spinners with calm, professional loading states.
 */
export function Skeleton({
    className,
    variant = 'rectangular',
    width,
    height,
    lines = 1,
}: SkeletonProps) {
    const baseClasses = 'animate-pulse bg-white/5';

    const variantClasses = {
        text: 'rounded h-4',
        circular: 'rounded-full',
        rectangular: 'rounded-lg',
    };

    const style = {
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
    };

    if (lines > 1) {
        return (
            <div className="space-y-2">
                {Array.from({ length: lines }).map((_, i) => (
                    <div
                        key={i}
                        className={cn(baseClasses, variantClasses.text, className)}
                        style={{ ...style, width: i === lines - 1 ? '60%' : '100%' }}
                    />
                ))}
            </div>
        );
    }

    return (
        <div
            className={cn(baseClasses, variantClasses[variant], className)}
            style={style}
        />
    );
}

/**
 * Message skeleton for chat loading states
 */
export function MessageSkeleton() {
    return (
        <div className="flex items-start gap-3">
            <Skeleton variant="circular" width={32} height={32} />
            <div className="flex-1 space-y-2">
                <Skeleton variant="text" width="80%" />
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="70%" />
            </div>
        </div>
    );
}
