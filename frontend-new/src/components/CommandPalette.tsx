"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
    Hash,
    Upload,
    Settings,
    Moon,
    Sun,
    LogOut,
    Users,
    FileText,
    Search,
} from "lucide-react";

interface Team {
    id: string;
    name: string;
    slug: string;
    role: string;
}

interface CommandPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    teams: Team[];
    currentTeam: Team | null;
    onTeamSwitch: (team: Team) => void;
    onUpload: () => void;
    onSignOut: () => void;
}

export function CommandPalette({
    open,
    onOpenChange,
    teams,
    currentTeam,
    onTeamSwitch,
    onUpload,
    onSignOut,
}: CommandPaletteProps) {
    const router = useRouter();
    const [isDarkMode, setIsDarkMode] = React.useState(true);

    const runCommand = React.useCallback(
        (command: () => void) => {
            onOpenChange(false);
            command();
        },
        [onOpenChange]
    );

    // Keyboard shortcut handler
    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onOpenChange(!open);
            }
        };

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, [open, onOpenChange]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="overflow-hidden p-0 shadow-2xl max-w-2xl">
                <Command className="**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-txt-tertiary **:[[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 **:[[cmdk-input-wrapper]_svg]:h-5 **:[[cmdk-input-wrapper]_svg]:w-5 **:[[cmdk-input]]:h-12 **:[[cmdk-item]]:px-2 **:[[cmdk-item]]:py-3 **:[[cmdk-item]_svg]:h-5 **:[[cmdk-item]_svg]:w-5">
                    <CommandInput placeholder="Type a command or search..." />
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>

                        {/* Quick Actions */}
                        <CommandGroup heading="Quick Actions">
                            <CommandItem
                                onSelect={() => runCommand(onUpload)}
                                className="gap-3"
                            >
                                <Upload className="opacity-70" />
                                Upload Document
                                <CommandShortcut>⌘U</CommandShortcut>
                            </CommandItem>
                            <CommandItem
                                onSelect={() => runCommand(() => router.push("/settings"))}
                                className="gap-3"
                            >
                                <Settings className="opacity-70" />
                                Settings
                                <CommandShortcut>⌘,</CommandShortcut>
                            </CommandItem>
                            <CommandItem
                                onSelect={() =>
                                    runCommand(() => {
                                        setIsDarkMode(!isDarkMode);
                                        // Toggle theme logic here
                                    })
                                }
                                className="gap-3"
                            >
                                {isDarkMode ? (
                                    <Sun className="opacity-70" />
                                ) : (
                                    <Moon className="opacity-70" />
                                )}
                                Toggle Theme
                                <CommandShortcut>⌘T</CommandShortcut>
                            </CommandItem>
                        </CommandGroup>

                        <CommandSeparator />

                        {/* Teams */}
                        <CommandGroup heading="Switch Team">
                            {teams.map((team) => (
                                <CommandItem
                                    key={team.id}
                                    onSelect={() => runCommand(() => onTeamSwitch(team))}
                                    className="gap-3"
                                >
                                    <Hash className="opacity-70" />
                                    <span>{team.name}</span>
                                    {currentTeam?.id === team.id && (
                                        <span className="ml-auto text-xs text-brand-primary">
                                            Current
                                        </span>
                                    )}
                                </CommandItem>
                            ))}
                        </CommandGroup>

                        <CommandSeparator />

                        {/* Navigation */}
                        <CommandGroup heading="Navigation">
                            <CommandItem
                                onSelect={() => runCommand(() => router.push("/"))}
                                className="gap-3"
                            >
                                <FileText className="opacity-70" />
                                Chat
                            </CommandItem>
                            <CommandItem
                                onSelect={() => runCommand(() => router.push("/admin"))}
                                className="gap-3"
                            >
                                <Users className="opacity-70" />
                                Admin Console
                            </CommandItem>
                        </CommandGroup>

                        <CommandSeparator />

                        {/* Account */}
                        <CommandGroup heading="Account">
                            <CommandItem
                                onSelect={() => runCommand(onSignOut)}
                                className="gap-3 text-red-400"
                            >
                                <LogOut className="opacity-70" />
                                Sign Out
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </Command>
            </DialogContent>
        </Dialog>
    );
}
