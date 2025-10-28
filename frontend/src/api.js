const API_BASE_URL = "http://localhost:8000";

export const ingestFile = async (file, team) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("team", team);

  const response = await fetch(`${API_BASE_URL}/ingest/`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "An unknown error occurred." }));
    throw new Error(errorData.message || "Failed to ingest file.");
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
    const errorData = await response.json().catch(() => ({ message: "An unknown error occurred." }));
    throw new Error(errorData.message || "Failed to get answer.");
  }
  return response.json();
};

export const deleteSessionMemory = async (sessionId) => {
    const response = await fetch(`${API_BASE_URL}/session/${sessionId}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "An unknown error occurred." }));
        throw new Error(errorData.message || 'Failed to clear session memory.');
    }
    return response.json();
};