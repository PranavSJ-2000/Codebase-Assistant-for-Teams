import { useState } from "react";
import { ChatPage } from "./components/ChatPage";
import { RepoUploadPage } from "./components/RepoUploadPage";

function App() {
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null);

  if (activeRepoId) {
    return <ChatPage repoId={activeRepoId} onBack={() => setActiveRepoId(null)} />;
  }

  return <RepoUploadPage onRepoReady={setActiveRepoId} />;
}

export default App;
