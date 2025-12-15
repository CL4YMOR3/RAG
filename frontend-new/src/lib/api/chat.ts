import { apiPost } from './client';

/**
 * Parameters for streaming query endpoint.
 */
export interface StreamQueryParams {
    query: string;
    team: string;
    sessionId?: string;
}

/**
 * Sends a streaming query to the backend.
 * Uses FormData to match the backend's Form(...) parameter types.
 */
export async function streamQuery(params: StreamQueryParams): Promise<Response> {
    const formData = new FormData();
    formData.append('query', params.query);
    formData.append('team', params.team);
    if (params.sessionId) {
        formData.append('session_id', params.sessionId);
    }

    return apiPost('/query/stream', formData, { stream: true }) as Promise<Response>;
}

/**
 * Non-streaming query endpoint.
 */
export interface QueryResponse {
    answer: string;
    provenance: Array<{
        file_name: string;
        page: number;
        chunk_id?: string;
        relevance_score?: number;
    }>;
}

export async function queryTeam(params: StreamQueryParams): Promise<QueryResponse> {
    const formData = new FormData();
    formData.append('query', params.query);
    formData.append('team', params.team);
    if (params.sessionId) {
        formData.append('session_id', params.sessionId);
    }

    return apiPost<QueryResponse>('/query/', formData) as Promise<QueryResponse>;
}
