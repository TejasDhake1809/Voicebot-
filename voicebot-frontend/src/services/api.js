// src/services/api.js
export const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:8000";

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function postMessage(text, sessionId) {
  const res = await fetch(`${API_BASE}/api/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ text, sessionId }),
  });
  return res.json();
}

export async function postVoice(file, sessionId) {
  const form = new FormData();
  form.append("audio", file);
  form.append("sessionId", sessionId);

  const res = await fetch(`${API_BASE}/api/voice-bot`, {
    method: "POST",
    headers: { ...authHeaders() }, // fetch will set boundary for form-data
    body: form,
  });
  return res.json();
}

export async function savePending(sessionId) {
  const res = await fetch(`${API_BASE}/api/save-question`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ text: "yes", sessionId }),
  });
  return res.json();
}

export async function login(username, password) {
  const res = await fetch(`${API_BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return res.json();
}

export async function register(username, password, accountId) {
  const res = await fetch(`${API_BASE}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, accountId }),
  });
  return res.json();
}

export async function registerFull(formData) {
  const res = await fetch(`${API_BASE}/api/register-full`, {
    method: "POST",
    body: formData
  });
  return res.json();
}

