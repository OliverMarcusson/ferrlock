import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface PasswordPromptPageProps {
  targetExe: string;
}

export default function PasswordPromptPage({ targetExe }: PasswordPromptPageProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const appName = targetExe.split("\\").pop()?.replace(".exe", "") || "Application";

  useEffect(() => {
    // Focus the input after the webview is ready.
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => window.clearTimeout(timer);
  }, []);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const success = await invoke<boolean>("verify_and_launch", {
        password,
        targetExe,
      });

      if (success) {
        await getCurrentWindow().close();
      } else {
        setError("Wrong password");
        setPassword("");
        inputRef.current?.focus();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    await getCurrentWindow().close();
  }

  return (
    <div className="flex h-screen items-center justify-center overflow-hidden bg-gray-900 px-6 pb-4 pt-2">
      <div className="w-full">
        <div className="mb-3 flex flex-col items-center">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600/20">
            <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-white">{appName}</p>
          <p className="text-xs text-gray-500">Enter password to continue</p>
        </div>

        <form onSubmit={handleUnlock}>
          <input
            id="password"
            name="password"
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="mb-2 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />

          {error && (
            <p className="mb-2 text-center text-xs text-red-400">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 rounded-md border border-gray-700 py-1.5 text-xs font-medium text-gray-400 hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !password}
              className="flex-1 rounded-md bg-blue-600 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
            >
              {loading ? "..." : "Unlock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
