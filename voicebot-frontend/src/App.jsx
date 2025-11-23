// src/App.jsx
import React, { useState, useRef } from "react";
import ChatWindow from "./components/ChatWindow";
import RecorderButton from "./components/RecorderButton";
import SaveButton from "./components/SaveButton";
import Login from "./components/Login";

import { postMessage, postVoice, savePending } from "./services/api";

function generateSessionId() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return "sess_" + Math.random().toString(36).slice(2);
}

export default function App() {
  // -------- AUTH CHECK ----------
  const [isAuthed, setIsAuthed] = useState(!!localStorage.getItem("token"));

  

  // -------- CHAT STATES ----------
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [sessionId] = useState(generateSessionId());
  const [saveVisible, setSaveVisible] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  if (!isAuthed) {
    return <Login onLogin={() => setIsAuthed(true)} />;
  }

  // =========================================
  // PUSH MESSAGE
  // =========================================
  function pushMessage(who, txt, audioBase64 = null) {
    setMessages((prev) => [...prev, { who, text: txt, audioBase64 }]);
  }

  // =========================================
  // SEND TEXT MESSAGE
  // =========================================
  async function handleSendText() {
    if (!text.trim()) return;

    const userText = text;
    pushMessage("user", userText);
    setText("");

    const res = await postMessage(userText, sessionId);
    handleBotResponse(res);
  }

  // =========================================
  // BOT RESPONSE HANDLER
  // =========================================
  function handleBotResponse(res) {
    const respText =
      res?.responseText || res?.response || "Something went wrong.";
    const audio = res?.audioBase64 || null;

    pushMessage("bot", respText, audio);

    if (/save.*question/i.test(respText)) {
      setSaveVisible(true);
    }
  }

  // =========================================
  // START RECORDING
  // =========================================
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => chunksRef.current.push(e.data);

      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: "audio/webm",
        });

        const file = new File([blob], "voice.webm", {
          type: "audio/webm",
        });

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

  // =========================================
  // STOP RECORDING
  // =========================================
  function stopRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setRecording(false);
  }

  // =========================================
  // UPLOAD FILE
  // =========================================
  async function handleUploadFile(file) {
    if (!file) return;

    const res = await postVoice(file, sessionId);

    const userSaid = res?.inputText || "(unable to transcribe)";
    pushMessage("user", userSaid);

    handleBotResponse(res);
  }

  // =========================================
  // SAVE PENDING QUESTION
  // =========================================
  async function handleSavePending() {
    const res = await savePending(sessionId);
    pushMessage("bot", res?.message || "Saved");
    setSaveVisible(false);
  }

  // =========================================
  // UI RENDER
  // =========================================
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100">
      <div className="w-full max-w-md h-[85vh] bg-white rounded-xl shadow-lg flex flex-col">
        {/* HEADER */}
        <div className="bg-blue-600 text-white p-4 rounded-t-xl font-semibold text-center">
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
          {/* TEXT INPUT */}
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 border rounded px-3 py-2"
            placeholder="Type a message..."
          />

          {/* SEND BUTTON */}
          <button
            onClick={handleSendText}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Send
          </button>

          {/* RECORD BUTTON */}
          <RecorderButton
            recording={recording}
            onStart={startRecording}
            onStop={stopRecording}
          />

          {/* UPLOAD FILE */}
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
