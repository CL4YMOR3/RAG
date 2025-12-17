"use client";

import * as React from "react";
import { useSession, signOut } from "next-auth/react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Settings, Shield, LogOut, Command } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface UserMenuProps {
    onOpenCommandPalette: () => void;
}

export function UserMenu({ onOpenCommandPalette }: UserMenuProps) {
    const { data: session } = useSession();
    const router = useRouter();
    const user = session?.user;

    if (!user) return null;

    const initials = user.name
        ? user.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
        : user.email?.slice(0, 2).toUpperCase() || "?";

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    className={cn(
                        "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg",
                        "hover:bg-white/5 transition-colors cursor-pointer"
                    )}
                >
                    {user.image ? (
                        <img
                            src={user.image}
                            alt={user.name || "User"}
                            className="w-8 h-8 rounded-full"
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center text-sm font-medium text-brand-primary">
                            {initials}
                        </div>
                    )}
                    <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-txt-primary truncate">
                            {user.name || "User"}
                        </p>
                        <p className="text-xs text-txt-tertiary truncate">{user.email}</p>
                    </div>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[240px]" align="end" sideOffset={8}>
                <DropdownMenuLabel>
                    <div className="flex flex-col">
                        <span className="font-medium">{user.name}</span>
                        <span className="text-xs text-txt-tertiary font-normal">
                            {user.email}
                        </span>
                        {user.isAdmin && (
                            <span className="inline-flex items-center gap-1 mt-1 text-xs text-brand-primary">
                                <Shield className="w-3 h-3" />
                                Super Admin
                            </span>
                        )}
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onOpenCommandPalette} className="gap-2">
                    <Command className="w-4 h-4 opacity-70" />
                    Command Palette
                    <span className="ml-auto text-xs text-txt-tertiary">⌘K</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/profile")} className="gap-2 cursor-pointer">
                    <User className="w-4 h-4 opacity-70" />
                    Profile
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 cursor-pointer">
                    <Settings className="w-4 h-4 opacity-70" />
                    Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onSelect={() => signOut({ callbackUrl: "/login" })}
                    className="gap-2 text-red-400 focus:text-red-400"
                >
                    <LogOut className="w-4 h-4 opacity-70" />
                    Sign Out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
