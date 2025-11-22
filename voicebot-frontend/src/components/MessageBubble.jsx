import React from "react";

export default function MessageBubble({ who, text, audioBase64 }) {
  const isUser = who === "user";
  return (
    <div
      className={`max-w-[78%] mb-3 p-3 rounded-2xl ${
        isUser
          ? "ml-auto bg-blue-100 text-black"
          : "mr-auto bg-gray-100 text-black"
      }`}
    >
      <div className="whitespace-pre-wrap">{text}</div>
      {audioBase64 && (
        <audio
          className="mt-2"
          controls
          src={`data:audio/mp3;base64,${audioBase64}`}
        />
      )}
    </div>
  );
}
