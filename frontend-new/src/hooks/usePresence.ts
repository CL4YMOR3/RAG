"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

interface PresenceState {
    onlineUsers: string[];
    isOnline: boolean;
}

/**
 * Hook to track real-time presence for a team.
 * Sends heartbeat every 20 seconds to keep user marked as online.
 * Polls for online users every 10 seconds.
 */
export function usePresence(teamId: string | null) {
    const { data: session } = useSession();
    const [presence, setPresence] = useState<PresenceState>({
        onlineUsers: [],
        isOnline: false,
    });

    // Send heartbeat to mark self as online
    const sendHeartbeat = useCallback(async () => {
        if (!teamId || !session?.user?.id) return;

        try {
            await fetch(`/api/teams/${teamId}/presence`, {
                method: "POST",
            });
        } catch (e) {
            console.error("[Presence] Heartbeat failed:", e);
        }
    }, [teamId, session?.user?.id]);

    // Fetch online users
    const fetchPresence = useCallback(async () => {
        if (!teamId || !session?.user?.id) return;

        try {
            const res = await fetch(`/api/teams/${teamId}/presence`);
            if (res.ok) {
                const data = await res.json();
                setPresence({
                    onlineUsers: data.online || [],
                    isOnline: (data.online || []).includes(session.user.id),
                });
            }
        } catch (e) {
            console.error("[Presence] Fetch failed:", e);
        }
    }, [teamId, session?.user?.id]);

    useEffect(() => {
        if (!teamId || !session?.user?.id) return;

        // Initial heartbeat and fetch
        sendHeartbeat();
        fetchPresence();

        // Set up intervals
        const heartbeatInterval = setInterval(sendHeartbeat, 20000); // Every 20 seconds
        const pollInterval = setInterval(fetchPresence, 10000); // Every 10 seconds

        return () => {
            clearInterval(heartbeatInterval);
            clearInterval(pollInterval);
        };
    }, [teamId, session?.user?.id, sendHeartbeat, fetchPresence]);

    return presence;
}
