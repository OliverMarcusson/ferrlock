import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import ManagementPage from "./pages/ManagementPage";
import PasswordPromptPage from "./pages/PasswordPromptPage";
import "./styles/globals.css";

function App() {
  const [targetExe, setTargetExe] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    invoke<string | null>("get_target_exe").then(setTargetExe);
  }, []);

  if (targetExe === undefined) return null; // loading

  if (targetExe) {
    return <PasswordPromptPage targetExe={targetExe} />;
  }

  return <ManagementPage />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
