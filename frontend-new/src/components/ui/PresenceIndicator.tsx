"use client";

import { cn } from "@/lib/utils";

interface PresenceIndicatorProps {
    isOnline: boolean;
    size?: "sm" | "md" | "lg";
    showLabel?: boolean;
}

/**
 * Visual indicator for user online status.
 * Shows green pulsing dot when online, gray when offline.
 */
export function PresenceIndicator({ isOnline, size = "sm", showLabel = false }: PresenceIndicatorProps) {
    const sizes = {
        sm: "w-2 h-2",
        md: "w-2.5 h-2.5",
        lg: "w-3 h-3",
    };

    return (
        <div className="flex items-center gap-1.5">
            <div
                className={cn(
                    "rounded-full",
                    sizes[size],
                    isOnline
                        ? "bg-green-500 shadow-lg shadow-green-500/50 animate-pulse"
                        : "bg-gray-500"
                )}
            />
            {showLabel && (
                <span className={cn(
                    "text-xs",
                    isOnline ? "text-green-400" : "text-txt-tertiary"
                )}>
                    {isOnline ? "Online" : "Offline"}
                </span>
            )}
        </div>
    );
}

interface OnlineUsersCountProps {
    count: number;
}

/**
 * Shows count of online users in a team.
 */
export function OnlineUsersCount({ count }: OnlineUsersCountProps) {
    if (count === 0) return null;

    return (
        <div className="flex items-center gap-1.5 text-xs text-txt-tertiary">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>{count} online</span>
        </div>
    );
}
