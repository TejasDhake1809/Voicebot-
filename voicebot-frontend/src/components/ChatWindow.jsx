import React, { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";

export default function ChatWindow({ messages, onScrollBottom }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
      if (onScrollBottom) onScrollBottom();
    }
  }, [messages]);

  return (
    <div ref={ref} className="p-4 overflow-y-auto flex-1 scrollbar-hide">
      <div className="flex flex-col">
        {messages.map((m, i) => (
          <MessageBubble
            key={i}
            who={m.who}
            text={m.text}
            audioBase64={m.audioBase64}
          />
        ))}
      </div>
    </div>
  );
}
