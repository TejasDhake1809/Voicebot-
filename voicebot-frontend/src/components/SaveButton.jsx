import React from "react";

export default function SaveButton({ visible, onSave }) {
  if (!visible) return null;
  return (
    <div className="w-full">
      <button
        onClick={onSave}
        className="w-full py-2 bg-blue-600 text-white rounded-md"
      >
        Save This Question
      </button>
    </div>
  );
}
