/**
 * API Configuration
 * Using environment variable with localhost fallback for development.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Application metadata
 */
export const APP_NAME = 'NEXUS';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'Enterprise RAG System - Team Knowledge Intelligence';

/**
 * Default team for queries
 */
export const DEFAULT_TEAM = 'finance';

/**
 * Available workspace teams
 */
export interface Team {
    id: string;
    name: string;
}

export const TEAMS: Team[] = [
    { id: 'finance', name: 'Finance' },
    { id: 'hr', name: 'Hr' },
    { id: 'engineering', name: 'Engineering' },
    { id: 'admin', name: 'Admin' },
    { id: 'marketing', name: 'Marketing' },
];

/**
 * Sample questions per team for suggestion chips
 */
export const SAMPLE_QUESTIONS: Record<string, string[]> = {
    finance: [
        'how much is our profit?',
        'how much is our document?',
        'what is our revenue',
    ],
    hr: [
        'what are our leave policies?',
        'how to apply for remote work?',
        'what are the benefits?',
    ],
    engineering: [
        'how to deploy to production?',
        'what is our tech stack?',
        'where is the documentation?',
    ],
    admin: [
        'how to add new users?',
        'what are admin policies?',
        'how to manage permissions?',
    ],
    marketing: [
        'what is our brand guide?',
        'how to run campaigns?',
        'what are marketing KPIs?',
    ],
};
