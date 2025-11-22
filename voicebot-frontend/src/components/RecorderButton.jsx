import React from "react";

export default function RecorderButton({ onStart, onStop, recording }) {
  return (
    <button
      onClick={() => (recording ? onStop() : onStart())}
      className={`w-12 h-12 rounded-full flex items-center justify-center ${
        recording ? "bg-red-500" : "bg-red-400"
      } text-white`}
      aria-label="Record"
    >
      {recording ? "■" : "🎤"}
    </button>
  );
}
