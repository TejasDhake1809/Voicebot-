// src/App.jsx
import React, { useState, useRef } from "react";
import ChatWindow from "./components/ChatWindow";
import RecorderButton from "./components/RecorderButton";
import SaveButton from "./components/SaveButton";
import Login from "./components/Login";
import Register from "./components/Register";
import { postMessage, postVoice, savePending } from "./services/api";

function generateSessionId() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return "sess_" + Math.random().toString(36).slice(2);
}

export default function App() {
  // ------------------ AUTH ------------------
  const [isAuthed, setIsAuthed] = useState(!!localStorage.getItem("token"));
  const [mode, setMode] = useState("login"); // login / register

  // ------------------ CHAT STATES ------------------
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [sessionId] = useState(generateSessionId());
  const [saveVisible, setSaveVisible] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // ------------------ AUTH SCREEN ------------------
  if (!isAuthed) {
    if (mode === "login") {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
          <div className="w-full max-w-md">
            <Login onLogin={() => setIsAuthed(true)} />

            <p className="text-center mt-4 text-gray-700">
              Don't have an account?
              <button
                className="text-blue-600 font-semibold ml-1"
                onClick={() => setMode("register")}
              >
                Register here
              </button>
            </p>
          </div>
        </div>
      );
    }

    if (mode === "register") {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
          <div className="w-full max-w-md">
            <Register
              onRegistered={() => {
                setIsAuthed(true);
              }}
            />

            <p className="text-center mt-4 text-gray-700">
              Already have an account?
              <button
                className="text-blue-600 font-semibold ml-1"
                onClick={() => setMode("login")}
              >
                Login here
              </button>
            </p>
          </div>
        </div>
      );
    }
  }

  // ------------------ CHAT HELPERS ------------------
  function pushMessage(who, txt, audioBase64 = null) {
    setMessages((prev) => [...prev, { who, text: txt, audioBase64 }]);
  }

  async function handleSendText() {
    if (!text.trim()) return;

    const userText = text;
    pushMessage("user", userText);
    setText("");

    const res = await postMessage(userText, sessionId);
    handleBotResponse(res);
  }

  function handleBotResponse(res) {
    const respText =
      res?.responseText || res?.response || "Something went wrong.";
    const audio = res?.audioBase64 || null;

    pushMessage("bot", respText, audio);

    if (/save.*question/i.test(respText)) {
      setSaveVisible(true);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => chunksRef.current.push(e.data);

      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], "voice.webm", { type: "audio/webm" });

        const res = await postVoice(file, sessionId);

        const userSaid = res?.inputText || "(unable to transcribe)";
        pushMessage("user", userSaid);

        handleBotResponse(res);
      };

      mr.start();
      setRecording(true);
    } catch (err) {
      console.log(err);
      alert("Microphone access denied.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setRecording(false);
  }

  async function handleUploadFile(file) {
    if (!file) return;

    const res = await postVoice(file, sessionId);

    const userSaid = res?.inputText || "(unable to transcribe)";
    pushMessage("user", userSaid);

    handleBotResponse(res);
  }

  async function handleSavePending() {
    const res = await savePending(sessionId);
    pushMessage("bot", res?.message || "Saved");
    setSaveVisible(false);
  }

  // ------------------ MAIN CHAT UI ------------------
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100">
      <div className="w-full max-w-md h-[85vh] bg-white rounded-xl shadow-lg flex flex-col">

        {/* HEADER */}
        <div className="bg-blue-600 text-white p-4 rounded-t-xl font-semibold text-center relative">
          Voice Bot Assistant

          <button
            className="absolute right-4 top-4 bg-red-500 text-white px-3 py-1 rounded"
            onClick={() => {
              localStorage.removeItem("token");
              window.location.reload();
            }}
          >
            Logout
          </button>
        </div>

        {/* CHAT WINDOW */}
        <ChatWindow messages={messages} />

        {/* SAVE BUTTON */}
        <SaveButton visible={saveVisible} onSave={handleSavePending} />

        {/* INPUT AREA */}
        <div className="p-3 border-t flex gap-2 items-center bg-gray-50">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 border rounded px-3 py-2"
            placeholder="Type a message..."
          />

          <button
            onClick={handleSendText}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Send
          </button>

          <RecorderButton
            recording={recording}
            onStart={startRecording}
            onStop={stopRecording}
          />

          <label className="bg-purple-600 text-white px-3 py-2 rounded cursor-pointer ml-1">
            Upload
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => handleUploadFile(e.target.files[0])}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
