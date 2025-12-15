import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines class names using clsx and tailwind-merge.
 * This is the standard pattern from Shadcn/ui for handling conditional classes.
 */
export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}

/**
 * Generates a unique ID using the Web Crypto API.
 */
export function generateId(): string {
    return crypto.randomUUID();
}

/**
 * Formats a date for display in chat messages.
 */
export function formatMessageTime(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }).format(date);
}
