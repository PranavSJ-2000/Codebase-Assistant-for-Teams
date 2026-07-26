import type { ChatMessage } from "../types";

interface SourcesSidebarProps {
  messages: ChatMessage[];
}

interface Turn {
  question: ChatMessage;
  answer: ChatMessage;
}

function FileIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 2h9l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function SourcesSidebar({ messages }: SourcesSidebarProps) {
  const turns: Turn[] = messages
    .map((message, index) => ({ answer: message, question: messages[index - 1] }))
    .filter(
      (t): t is Turn =>
        t.answer.role === "assistant" && (t.answer.sources?.length ?? 0) > 0 && t.question?.role === "user"
    );

  return (
    <aside className="sources-sidebar">
      <h2>Sources</h2>
      {turns.length === 0 ? (
        <p className="muted">Sources cited in answers will show up here.</p>
      ) : (
        turns
          .slice()
          .reverse()
          .map((turn) => (
            <div key={turn.answer.id} className="source-group">
              <p className="source-group-question">{turn.question.content}</p>
              <ul>
                {turn.answer.sources!.map((source, i) => (
                  <li key={i} className="source-item">
                    <FileIcon />
                    <span>
                      <code>{source.filePath}</code>
                      <span className="muted">
                        {" "}
                        lines {source.startLine}-{source.endLine}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
      )}
    </aside>
  );
}
