import { useEffect, useRef, useState } from "react";
import type { ChatMessage, SourceRef } from "../types";
import { getOrCreateUserId } from "../userId";
import { BrandMark } from "./BrandMark";
import { SourcesSidebar } from "./SourcesSidebar";

interface ChatPageProps {
  repoId: string;
  onBack: () => void;
}

function createId(): string {
  return crypto.randomUUID();
}

export function ChatPage({ repoId, onBack }: ChatPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const userIdRef = useRef(getOrCreateUserId());

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  function updateMessage(id: string, updater: (msg: ChatMessage) => ChatMessage) {
    setMessages((prev) => prev.map((m) => (m.id === id ? updater(m) : m)));
  }

  function finishStreaming(assistantId: string, patch: Partial<ChatMessage> = {}) {
    updateMessage(assistantId, (m) => ({ ...m, streaming: false, ...patch }));
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setIsStreaming(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isStreaming) return;

    const userMessage: ChatMessage = { id: createId(), role: "user", content: trimmed };
    const assistantId = createId();
    const assistantMessage: ChatMessage = { id: assistantId, role: "assistant", content: "", streaming: true };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setQuestion("");
    setIsStreaming(true);

    const url = `/api/repos/${repoId}/ask?question=${encodeURIComponent(trimmed)}&userId=${encodeURIComponent(
      userIdRef.current
    )}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener("sources", (event) => {
      try {
        const sources = JSON.parse((event as MessageEvent).data) as SourceRef[];
        updateMessage(assistantId, (m) => ({ ...m, sources }));
      } catch {
        // ignore malformed payload
      }
    });

    es.addEventListener("token", (event) => {
      try {
        const { token } = JSON.parse((event as MessageEvent).data) as { token: string };
        updateMessage(assistantId, (m) => ({ ...m, content: m.content + token }));
      } catch {
        // ignore malformed payload
      }
    });

    // Server-reported failure (mid-stream LLM error, etc.) — named
    // "stream-error" specifically so it doesn't collide with EventSource's
    // own reserved "error" event handled below.
    es.addEventListener("stream-error", (event) => {
      let message = "The assistant hit an error while answering.";
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as { error?: string };
        if (parsed.error) message = parsed.error;
      } catch {
        // keep default message
      }
      finishStreaming(assistantId, { errorText: message });
    });

    es.addEventListener("done", () => {
      finishStreaming(assistantId);
    });

    // Connection-level failure (server unreachable, dropped mid-stream).
    es.onerror = () => {
      updateMessage(assistantId, (m) =>
        m.streaming ? { ...m, errorText: "Connection to the server was lost." } : m
      );
      finishStreaming(assistantId);
    };
  }

  return (
    <div className="chat-page">
      <div className="chat-main">
        <div className="chat-header">
          <button className="btn-secondary" onClick={onBack}>
            &larr; Back
          </button>
          <div className="brand">
            <BrandMark size={30} />
            <div>
              <div className="brand-name">Codebase Assistant</div>
              <div className="chat-header-subtitle muted">Ask about this repo</div>
            </div>
          </div>
        </div>

        <div className="message-list">
          {messages.length === 0 && (
            <div className="empty-state">
              <p className="muted">Ask a question about the codebase to get started.</p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`message-row role-${m.role}`}>
              <div className={`message-avatar role-${m.role}`}>{m.role === "user" ? "You" : "AI"}</div>
              <div className="message-col">
                <div className="message-bubble">
                  {m.content}
                  {m.streaming && <span className="cursor">▍</span>}
                </div>
                {m.errorText && <div className="error-text">{m.errorText}</div>}
              </div>
            </div>
          ))}
        </div>

        <form className="chat-input" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Ask a question about this codebase…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={isStreaming}
          />
          <button type="submit" disabled={isStreaming || !question.trim()}>
            {isStreaming ? "Asking…" : "Ask"}
          </button>
        </form>
      </div>

      <SourcesSidebar messages={messages} />
    </div>
  );
}
