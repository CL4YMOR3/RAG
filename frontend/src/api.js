import axios from "axios";

const API_BASE = "http://localhost:8000";

/**
 * Uploads and ingests a file for a specific team.
 * @param {File} file The file to be ingested.
 * @param {string} team The team to associate the file with.
 * @returns {Promise<object>} The response from the server.
 */
export const ingestFile = async (file, team) => {
  if (!file || !team) {
    throw new Error("File and team are required for ingestion.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("team", team);

  try {
    const response = await axios.post(`${API_BASE}/ingest/`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error during file ingestion:", error);
    // Try to extract a meaningful error message from the server response
    if (error.response && error.response.data) {
      const serverData = error.response.data;
      const serverMessage =
        serverData.detail ||
        serverData.message ||
        (typeof serverData === 'string' ? serverData : JSON.stringify(serverData));
      throw new Error(`Server error: ${serverMessage}`);
    }
    throw new Error(error.message || "An unknown network error occurred during ingestion.");
  }
};

/**
 * Sends a query to the RAG system for a specific team.
 * @param {string} query The user's question.
 * @param {string} team The team to query against.
 * @returns {Promise<object>} The answer and provenance from the RAG system.
 */
export const queryRAG = async (query, team) => {
  if (!query || !team) {
    throw new Error("Query and team are required.");
  }

  try {
    // The backend seems to expect form-data for this endpoint as well.
    const formData = new FormData();
    formData.append("query", query);
    formData.append("team", team);

    const response = await axios.post(`${API_BASE}/query/`, formData);

    return response.data;
  } catch (error) {
    console.error("Error during query:", error);
    // Try to extract a meaningful error message from the server response
    if (error.response && error.response.data) {
      const serverData = error.response.data;
      const serverMessage =
        serverData.detail ||
        serverData.message ||
        (typeof serverData === 'string' ? serverData : JSON.stringify(serverData));
      throw new Error(`Server error: ${serverMessage}`);
    }
    throw new Error(error.message || "An unknown network error occurred during query.");
  }
};
