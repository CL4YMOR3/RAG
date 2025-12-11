const API_BASE_URL = "http://localhost:8000";

/**
 * Parses a structured error response from the backend.
 * @param {Response} response - The fetch response object.
 * @returns {Promise<Error>} - An Error with a user-friendly message.
 */
const parseErrorResponse = async (response) => {
  try {
    const errorData = await response.json();
    // Build a user-friendly message from the structured response
    let message = errorData.message || "An unknown error occurred.";
    if (errorData.suggestion) {
      message += ` Suggestion: ${errorData.suggestion}`;
    }
    const error = new Error(message);
    error.errorType = errorData.error_type || "UNKNOWN_ERROR";
    error.details = errorData.details || null;
    return error;
  } catch {
    return new Error("An unknown error occurred.");
  }
};

export const ingestFile = async (file, team) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("team", team);

  const response = await fetch(`${API_BASE_URL}/ingest/`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }
  return response.json();
};

export const queryRAG = async (query, team, sessionId) => {
  const formData = new FormData();
  formData.append("query", query);
  formData.append("team", team);
  if (sessionId) {
    formData.append("session_id", sessionId);
  }

  const response = await fetch(`${API_BASE_URL}/query/`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }
  return response.json();
};

export const streamQueryRAG = async function* (query, team, sessionId) {
  const formData = new FormData();
  formData.append("query", query);
  formData.append("team", team);
  if (sessionId) {
    formData.append("session_id", sessionId);
  }

  const response = await fetch(`${API_BASE_URL}/query/stream`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value, { stream: true });
  }
};

export const deleteSessionMemory = async (sessionId) => {
  const response = await fetch(`${API_BASE_URL}/session/${sessionId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }
  return response.json();
};

// =============================================================================
// TEAM MANAGEMENT API
// =============================================================================

/**
 * Fetches all available teams (Qdrant collections) from the backend.
 * @returns {Promise<{status: string, teams: string[], count: number}>}
 */
export const listTeams = async () => {
  const response = await fetch(`${API_BASE_URL}/teams/`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }
  return response.json();
};

/**
 * Fetches all documents ingested into a specific team's knowledge base.
 * @param {string} team - The team/collection name.
 * @returns {Promise<{status: string, team: string, documents: Array, document_count: number, total_chunks: number}>}
 */
export const listTeamDocuments = async (team) => {
  const response = await fetch(`${API_BASE_URL}/teams/${encodeURIComponent(team)}/documents`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }
  return response.json();
};

/**
 * Deletes a specific document from a team's knowledge base.
 * @param {string} team - The team/collection name.
 * @param {string} filename - The filename to delete.
 * @returns {Promise<{status: string, message: string}>}
 */
export const deleteDocument = async (team, filename) => {
  const response = await fetch(`${API_BASE_URL}/teams/${encodeURIComponent(team)}/documents/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }
  return response.json();
};

/**
 * Deletes an entire team's knowledge base.
 * WARNING: This permanently deletes all documents in the team.
 * @param {string} team - The team/collection name.
 * @returns {Promise<{status: string, message: string}>}
 */
export const deleteTeam = async (team) => {
  const response = await fetch(`${API_BASE_URL}/teams/${encodeURIComponent(team)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }
  return response.json();
};

