"use client";

import * as React from "react";
import { Check, ChevronsUpDown, PlusCircle, Hash } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Team {
    id: string;
    name: string;
    slug: string;
    role: string;
}

interface TeamSwitcherProps {
    teams: Team[];
    currentTeam: Team | null;
    onTeamSwitch: (team: Team) => void;
    onCreateTeam: () => void;
}

export function TeamSwitcher({
    teams,
    currentTeam,
    onTeamSwitch,
    onCreateTeam,
}: TeamSwitcherProps) {
    const [open, setOpen] = React.useState(false);

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <button
                    className={cn(
                        "flex items-center gap-2 w-full px-3 py-2.5 rounded-lg",
                        "bg-glass border border-white-5 hover:bg-white/5 transition-colors",
                        "text-left cursor-pointer"
                    )}
                >
                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-brand-primary/20">
                        <Hash className="w-4 h-4 text-brand-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-txt-primary truncate">
                            {currentTeam?.name || "Select Team"}
                        </p>
                        <p className="text-xs text-txt-tertiary capitalize">
                            {currentTeam?.role.toLowerCase() || "No team selected"}
                        </p>
                    </div>
                    <ChevronsUpDown className="w-4 h-4 text-txt-tertiary shrink-0" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[240px]" align="start" sideOffset={8}>
                <DropdownMenuLabel>Your Teams</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {teams.map((team) => (
                    <DropdownMenuItem
                        key={team.id}
                        onSelect={() => {
                            onTeamSwitch(team);
                            setOpen(false);
                        }}
                        className="gap-2"
                    >
                        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-brand-primary/20">
                            <Hash className="w-3 h-3 text-brand-primary" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm">{team.name}</p>
                            <p className="text-xs text-txt-tertiary capitalize">
                                {team.role.toLowerCase()}
                            </p>
                        </div>
                        {currentTeam?.id === team.id && (
                            <Check className="w-4 h-4 text-brand-primary" />
                        )}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onCreateTeam} className="gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-md border border-dashed border-white-10">
                        <PlusCircle className="w-3 h-3 text-txt-tertiary" />
                    </div>
                    <span className="text-txt-secondary">Create Team</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
