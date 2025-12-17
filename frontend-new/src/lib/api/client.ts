import { API_BASE_URL } from '../constants';

/**
 * Custom API Error class for structured error handling.
 */
export class ApiError extends Error {
    constructor(
        public status: number,
        message: string,
        public details?: string,
        public suggestion?: string
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

/**
 * User context for auth headers.
 */
export interface UserContext {
    userId?: string;
    email?: string;
    teamId?: string;  // For multi-tenant vector filtering
    apiKey?: string;  // For API key auth (programmatic access)
}

// Internal secret for backend verification (prevents header spoofing)
const API_SECRET = process.env.NEXT_PUBLIC_API_SECRET || '';

/**
 * Base API client for making requests to the backend.
 * Supports both JSON and FormData payloads.
 * Includes X-Internal-Secret header to prevent header spoofing.
 */
export async function apiPost<T>(
    endpoint: string,
    body: FormData | Record<string, unknown>,
    options?: { stream?: boolean; userContext?: UserContext }
): Promise<T | Response> {
    const isFormData = body instanceof FormData;

    // Build headers with user context for backend tracking
    const headers: Record<string, string> = {};

    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }

    // Add auth headers if user context is provided
    if (options?.userContext) {
        // SECURITY: Always send internal secret to prove this is from our frontend
        if (API_SECRET) {
            headers['X-Internal-Secret'] = API_SECRET;
        }

        if (options.userContext.userId) {
            headers['X-User-Id'] = options.userContext.userId;
        }
        if (options.userContext.email) {
            headers['X-User-Email'] = options.userContext.email;
        }
        if (options.userContext.teamId) {
            headers['X-Team-Id'] = options.userContext.teamId;
        }
        if (options.userContext.apiKey) {
            headers['X-API-Key'] = options.userContext.apiKey;
        }
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        body: isFormData ? body : JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(
            response.status,
            error.message || 'Request failed',
            error.details,
            error.suggestion
        );
    }

    return options?.stream ? response : response.json();
}

/**
 * GET request helper.
 */
export async function apiGet<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(
            response.status,
            error.message || 'Request failed',
            error.details,
            error.suggestion
        );
    }

    return response.json();
}
