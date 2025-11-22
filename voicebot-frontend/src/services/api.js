export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'


export async function postMessage(text, sessionId) {
const res = await fetch(`${API_BASE}/api/message`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ text, sessionId })
})
return res.json()
}


export async function postVoice(file, sessionId) {
const form = new FormData()
form.append('audio', file)
form.append('sessionId', sessionId)


const res = await fetch(`${API_BASE}/api/voice-bot`, {
method: 'POST',
body: form
})
return res.json()
}


export async function savePending(sessionId) {
const res = await fetch(`${API_BASE}/api/save-question`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ text: 'yes', sessionId })
})
return res.json()
}