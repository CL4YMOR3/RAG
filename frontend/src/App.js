import React, { useState, useEffect, useRef } from "react";
import { ingestFile, queryRAG } from "./api";
import ReactMarkdown from 'react-markdown';
import { v4 as uuidv4 } from 'uuid'; // For unique chat IDs

function App() {
  // --- Global State ---
  const [error, setError] = useState("");
  const chatContainerRef = useRef(null); // Ref for auto-scrolling chat
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [hoveredChatId, setHoveredChatId] = useState(null);

  // --- Team Management State ---
  const [teams, setTeams] = useState(() => {
    const savedTeams = localStorage.getItem("rag_teams");
    return savedTeams ? JSON.parse(savedTeams) : ["finance", "hr", "engineering"]; // Default teams
  });
  const [newTeamNameInput, setNewTeamNameInput] = useState("");
  const [showNewTeamInput, setShowNewTeamInput] = useState(false);

  // --- Chat History State ---
  const [chatHistory, setChatHistory] = useState(() => {
    const savedChatHistory = localStorage.getItem("rag_chat_history");
    return savedChatHistory ? JSON.parse(savedChatHistory) : [];
  });
  const [activeChatId, setActiveChatId] = useState(null);

  // --- Current Chat State (derived from activeChatId) ---
  const activeChat = chatHistory.find(chat => chat.id === activeChatId);
  const currentTeam = activeChat ? activeChat.team : "";

  // --- Querying State ---
  const [queryInput, setQueryInput] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);

  // --- File Ingestion State (for modal) ---
  const [showFileUploadModal, setShowFileUploadModal] = useState(false);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const fileInputRef = useRef(null); // Ref for hidden file input

  // --- Effects for Local Storage Persistence ---
  useEffect(() => {
    localStorage.setItem("rag_teams", JSON.stringify(teams));
  }, [teams]);

  useEffect(() => {
    localStorage.setItem("rag_chat_history", JSON.stringify(chatHistory));
  }, [chatHistory]);

  // --- Auto-scroll chat to bottom ---
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [activeChat?.messages]);

  // --- Chat Management Functions ---
  const startNewChat = (teamName = "") => {
    const newChat = {
      id: uuidv4(),
      title: "New Chat",
      team: teamName,
      messages: [],
      createdAt: new Date().toISOString(),
    };
    setChatHistory(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setError("");
    setQueryInput("");
  };

  const selectChat = (chatId) => {
    setActiveChatId(chatId);
    setError("");
    setQueryInput("");
  };

  const deleteChat = (chatId) => {
    setChatHistory(prev => {
      const newHistory = prev.filter(chat => chat.id !== chatId);
      if (activeChatId === chatId) {
        if (newHistory.length > 0) {
          setActiveChatId(newHistory[0].id);
        } else {
          setActiveChatId(null);
        }
      }
      return newHistory;
    });
  };

  const addMessageToActiveChat = (sender, text, provenance = []) => {
    setChatHistory(prev =>
      prev.map(chat =>
        chat.id === activeChatId
          ? {
              ...chat,
              messages: [...chat.messages, { sender, text, provenance }],
              title: chat.messages.length === 0 && sender === 'user' ? text.substring(0, 50) + (text.length > 50 ? '...' : '') : chat.title,
            }
          : chat
      )
    );
  };

  // --- Team Management Functions ---
  const handleAddTeam = () => {
    if (newTeamNameInput.trim() && !teams.includes(newTeamNameInput.trim().toLowerCase())) {
      setTeams(prev => [...prev, newTeamNameInput.trim().toLowerCase()]);
      setNewTeamNameInput("");
      setShowNewTeamInput(false);
    }
  };

  const handleTeamChangeForActiveChat = (e) => {
    const selectedTeam = e.target.value;
    setChatHistory(prev =>
      prev.map(chat =>
        chat.id === activeChatId
          ? { ...chat, team: selectedTeam }
          : chat
      )
    );
    setError("");
  };

  // --- Query Handling ---
  const handleQuerySubmit = async (e) => {
    e.preventDefault();
    if (!queryInput.trim() || !currentTeam) {
      setError("Please select a team and enter a query.");
      return;
    }
    if (!activeChatId) {
      startNewChat(currentTeam); // Start a new chat if none is active
    }

    setError("");
    setIsQuerying(true);
    const userQuery = queryInput;
    setQueryInput(""); // Clear input immediately
    addMessageToActiveChat("user", userQuery);

    try {
      const result = await queryRAG(userQuery, currentTeam);
      addMessageToActiveChat("ai", result.answer, result.provenance || []);
    } catch (err) {
      addMessageToActiveChat("ai", `Error: ${err.message || "Failed to get answer."}`);
      setError(err.message || "Failed to get answer.");
    } finally {
      setIsQuerying(false);
    }
  };

  // --- File Ingestion Handling ---
  const handleFileChange = (e) => {
    setFileToUpload(e.target.files[0]);
    setUploadStatus("");
  };

  const handleIngestSubmit = async () => {
    if (!fileToUpload || !currentTeam) {
      setError("Please select a team and a file to upload.");
      return;
    }
    setError("");
    setUploadStatus("");
    setIsUploading(true);

    try {
      const result = await ingestFile(fileToUpload, currentTeam);
      setUploadStatus(result.message || "Upload successful!");
      setFileToUpload(null); // Clear file input after success
      if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input visually
    } catch (err) {
      setError(err.message || "Failed to ingest file.");
      setUploadStatus(`Error: ${err.message || "Failed to ingest file."}`);
    } finally {
      setIsUploading(false);
    }
  };

  // --- Initial chat setup ---
  useEffect(() => {
    if (chatHistory.length === 0 && teams.length > 0) {
      startNewChat(teams[0]); // Start a new chat with the first team if no history
    } else if (chatHistory.length > 0 && !activeChatId) {
      setActiveChatId(chatHistory[0].id); // Select the most recent chat if history exists
    }
  }, [chatHistory, activeChatId, teams]);

  return (
    <div className="flex h-screen bg-[#121212] text-[#E0E0E0] font-sans">
      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full bg-[#1E1E1E] backdrop-blur-lg flex flex-col p-4 shadow-2xl z-10 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="flex flex-col items-start">
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-2 rounded-md bg-gray-700/50 hover:bg-gray-600/70 transition-colors mb-4 hover:scale-110 active:scale-90">
            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>

          <button
            onClick={() => startNewChat(currentTeam || (teams.length > 0 ? teams[0] : ""))}
            className={`w-full flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-4 rounded-lg mb-6 transition-all duration-300 shadow-lg hover:shadow-blue-500/30 hover:scale-105 active:scale-95 ${isSidebarCollapsed ? 'px-2' : ''}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
            {!isSidebarCollapsed && <span>New Chat</span>}
          </button>
        </div>

        {!isSidebarCollapsed && (
          <div>
              {/* Teams Section */}
              <div className="mb-4">
                <h3 className={`text-xs font-semibold text-gray-400 uppercase mb-2`}>Teams</h3>
                <ul className="space-y-1">
                  {teams.map((t) => (
                    <li key={t}>
                      <button
                        onClick={() => {
                          if (activeChatId && activeChat.team === t) return; // No change if already active
                          const existingChat = chatHistory.find(chat => chat.team === t && chat.messages.length === 0);
                          if (existingChat) {
                            setActiveChatId(existingChat.id);
                          } else {
                            startNewChat(t);
                          }
                        }}
                        className={`w-full text-left py-1.5 px-3 rounded-md transition-colors duration-200 text-sm hover:scale-105 active:scale-95 ${
                          currentTeam === t ? "bg-gray-700/80 text-white font-medium" : "hover:bg-gray-700/50 text-gray-300"
                        }`}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    </li>
                  ))}
                </ul>
                {showNewTeamInput ? (
                  <div className="mt-2 flex">
                    <input
                      type="text"
                      value={newTeamNameInput}
                      onChange={(e) => setNewTeamNameInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTeam()}
                      placeholder="New team..."
                      className="flex-grow p-1.5 text-sm rounded-l-md bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleAddTeam}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 rounded-r-md transition-colors hover:scale-105 active:scale-95"
                    >
                      Add
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewTeamInput(true)}
                    className={`w-full text-left py-1.5 px-3 mt-1 text-sm text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-md transition-colors duration-200 hover:scale-105 active:scale-95`}
                  >
                    + Add New Team
                  </button>
                )}
              </div>

              {/* Recent Chats */}
              <div className="flex-grow overflow-y-auto custom-scrollbar -mr-2 pr-2">
                <h3 className={`text-xs font-semibold text-gray-400 uppercase mb-2`}>Recent Chats</h3>
                <ul className="space-y-1">
                  {chatHistory.filter(chat => chat.messages.length > 0).map((chat) => (
                    <li key={chat.id} onMouseEnter={() => setHoveredChatId(chat.id)} onMouseLeave={() => setHoveredChatId(null)} className="relative">
                      <button
                        onClick={() => selectChat(chat.id)}
                        className={`w-full text-left py-1.5 px-3 rounded-md transition-colors duration-200 text-sm truncate active:scale-98 ${
                          activeChatId === chat.id ? "bg-gray-700/80 text-white font-medium" : "hover:bg-gray-700/50 text-gray-300"
                        }`}
                      >
                        {chat.title} <span className="text-gray-500 text-xs">{`(${chat.team})`}</span>
                      </button>
                      {hoveredChatId === chat.id && (
                        <button onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full bg-red-500/80 hover:bg-red-500 text-white transition-colors" title="Delete Chat">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div
        className={`flex-1 flex flex-col bg-[#121212] transition-all duration-300 ease-in-out`}
        style={{ marginLeft: isSidebarCollapsed ? '4rem' : '16rem' }}>
        <div className="flex items-center p-4">
          <h1 className="text-xl font-semibold bg-gradient-to-r from-blue-400 to-blue-600 text-transparent bg-clip-text">RAG Assistant</h1>
        </div>
        {/* Chat Display */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {!activeChatId && (
              <div
                className="text-center text-gray-500 mt-20">
                <p className="text-3xl font-semibold mb-2 text-[#E0E0E0]">Welcome to RAG Assistant</p>
                <p className="text-gray-400">Start a new chat or select a team from the sidebar to begin.</p>
              </div>
            )}

            {activeChat && activeChat.messages.length === 0 && (
              <div
                className="text-center text-gray-500 mt-20">
                <p className="text-3xl font-semibold mb-2 text-[#E0E0E0]">Chat with {currentTeam.charAt(0).toUpperCase() + currentTeam.slice(1)}</p>
                <p className="text-gray-400">Ask a question or upload a document to get started.</p>
              </div>
            )}

            {activeChat && activeChat.messages.map((msg, index) => (
              <div
                key={index}
                className={`flex items-start gap-4 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-3xl p-4 rounded-xl shadow-lg ${
                    msg.sender === "user"
                      ? "bg-gray-700/60 text-[#E0E0E0]"
                      : "bg-[#1E1E1E] text-[#E0E0E0] border border-gray-700/50"
                  }`}
                >
                  <div className="prose prose-invert max-w-none">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                  {msg.provenance && msg.provenance.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-600/50 text-sm text-gray-400">
                      <h4 className="font-semibold mb-2 text-gray-300">Sources:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {msg.provenance.map((p, pIdx) => (
                          <li key={pIdx}>
                            Source: {p.source_doc} "{p.chunk_text.substring(0, 100)}..."
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}

          {isQuerying && (
            <div className="flex justify-start">
              <div className="max-w-3xl p-4 rounded-xl shadow-lg bg-[#1E1E1E] text-[#E0E0E0] border border-gray-700/50">
                <div className="flex items-center">
                  <div className="gemini-loader mr-3"></div>
                  <span>Thinking...</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <p className="text-red-400 text-center p-3 bg-red-500/10 rounded-lg border border-red-500/30">{error}</p>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-transparent flex items-center space-x-3">
          {/* Team Selector for current chat */}
          <select
            value={currentTeam}
            onChange={handleTeamChangeForActiveChat}
            className="p-2.5 border border-gray-600 rounded-lg text-sm bg-gray-700/50 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            disabled={!activeChatId || teams.length === 0}
          >
            <option value="">Select Team</option>
            {teams.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>

          {/* Plus button for file upload */}
          <button
            onClick={() => setShowFileUploadModal(true)}
            className="p-2.5 rounded-full bg-gray-700/50 hover:bg-gray-600/70 text-gray-300 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-110 active:scale-90"
            title="Upload Document"
            disabled={!currentTeam}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
          </button>

          <form onSubmit={handleQuerySubmit} className="flex-grow flex items-center relative">
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder={currentTeam ? `Ask a question about ${currentTeam}...` : "Select a team to ask a question..."}
              className="flex-grow w-full p-4 pr-16 bg-[#1E1E1E] text-[#E0E0E0] rounded-full border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
              disabled={isQuerying || !currentTeam}
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-colors duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed hover:scale-110 active:scale-90"
              disabled={isQuerying || !queryInput.trim() || !currentTeam}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </button>
          </form>
        </div>
      </div>

      {/* File Upload Modal */}
      {showFileUploadModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl shadow-2xl w-full max-w-md text-gray-200">
            <h2 className="text-xl font-semibold mb-4 text-white">Upload Document for {currentTeam.charAt(0).toUpperCase() + currentTeam.slice(1)}</h2>
            <p className="text-sm text-gray-400 mb-5">Supported formats: PDF, DOCX, TXT</p>
            
            <div className="mb-4">
              <label htmlFor="file-upload-modal" className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-lg inline-flex items-center transition-colors duration-200">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                {fileToUpload ? fileToUpload.name : "Choose File"}
              </label>
              <input
                id="file-upload-modal"
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.docx,.txt"
              />
            </div>

            {uploadStatus && (
              <p className={`text-sm mb-4 ${uploadStatus.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
                {uploadStatus}
              </p>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowFileUploadModal(false);
                  setFileToUpload(null);
                  setUploadStatus("");
                  setError("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="px-4 py-2 bg-gray-600 text-gray-200 rounded-lg hover:bg-gray-500 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleIngestSubmit}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed"
                disabled={isUploading || !fileToUpload || !currentTeam}
              >
                {isUploading ? "Uploading..." : "Upload & Ingest"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Scrollbar Styles (can be moved to index.css) */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #4a5568; /* gray-600 */
          border-radius: 10px;
          border: 2px solid transparent;
          background-clip: content-box;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #718096; /* gray-500 */
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
        .gemini-loader {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: conic-gradient(#fff, #4299e1, #93c5fd, #fff);
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        /* For Firefox */
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #4a5568 transparent;
        }
        .font-sans {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
        }
        /* Basic prose styles for markdown */
        .prose { color: #d1d5db; }
        .prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6 { color: #f9fafb; font-weight: 600; }
        .prose strong { color: #f9fafb; font-weight: 600; }
        .prose a { color: #60a5fa; }
        .prose blockquote { border-left-color: #4b5563; }
        .prose code { color: #f9fafb; background-color: #374151; padding: 0.2em 0.4em; margin: 0; font-size: 85%; border-radius: 3px; }
        .prose pre { background-color: #1f2937; }
        .prose ul > li::before { background-color: #6b7280; }
 
      `}</style>
    </div>
  );
}

export default App;