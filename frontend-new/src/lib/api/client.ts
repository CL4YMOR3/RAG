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
 * Base API client for making requests to the backend.
 * Supports both JSON and FormData payloads.
 */
export async function apiPost<T>(
    endpoint: string,
    body: FormData | Record<string, unknown>,
    options?: { stream?: boolean }
): Promise<T | Response> {
    const isFormData = body instanceof FormData;

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
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
