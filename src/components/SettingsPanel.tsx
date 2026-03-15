import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import type { UpdateStatus } from "../lib/updater";

interface SettingsPanelProps {
  appVersion: string;
  updateStatus: UpdateStatus;
  onCheckForUpdates: () => Promise<void>;
  onInstallUpdate: () => Promise<void>;
}

function formatCheckedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function SettingsPanel({
  appVersion,
  updateStatus,
  onCheckForUpdates,
  onInstallUpdate,
}: SettingsPanelProps) {
  const [passwordSet, setPasswordSet] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [autostart, setAutostart] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      const set = await invoke<boolean>("is_password_set");
      setPasswordSet(set);
      const auto = await isEnabled();
      setAutostart(auto);
    })();
  }, []);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (newPassword.length < 4) {
      setMessage("Password must be at least 4 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }

    try {
      await invoke("set_password", { password: newPassword });
      setPasswordSet(true);
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password set successfully");
    } catch (err) {
      setMessage(String(err));
    }
  }

  async function handleAutostart(checked: boolean) {
    try {
      if (checked) {
        await enable();
      } else {
        await disable();
      }
      setAutostart(checked);
    } catch (err) {
      console.error("Autostart error:", err);
    }
  }

  const checkingForUpdates = updateStatus.kind === "checking" || updateStatus.kind === "downloading";

  function renderUpdateDetails() {
    switch (updateStatus.kind) {
      case "idle":
        return <p className="text-sm text-gray-400">Ferrlock will check for updates after the management app unlocks.</p>;
      case "checking":
        return (
          <p className="text-sm text-gray-300">
            {updateStatus.source === "startup" ? "Checking for updates in the background..." : "Checking for updates..."}
          </p>
        );
      case "available":
        return (
          <div className="space-y-3">
            <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-3">
              <p className="text-sm font-medium text-blue-300">
                Ferrlock {updateStatus.version} is available for download.
              </p>
              <p className="mt-1 text-xs text-blue-100/80">
                Current version: {updateStatus.currentVersion}
              </p>
            </div>
            {updateStatus.body && (
              <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Release notes</p>
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-300">{updateStatus.body}</pre>
              </div>
            )}
          </div>
        );
      case "no-update":
        return (
          <p className="text-sm text-gray-400">
            You’re on the latest version ({updateStatus.currentVersion}). Last checked {formatCheckedAt(updateStatus.checkedAt)}.
          </p>
        );
      case "downloading": {
        const percent = updateStatus.totalBytes
          ? Math.min(100, Math.round((updateStatus.downloadedBytes / updateStatus.totalBytes) * 100))
          : null;

        return (
          <div className="space-y-2">
            <p className="text-sm text-gray-300">Downloading Ferrlock {updateStatus.version}...</p>
            <div className="h-2 overflow-hidden rounded-full bg-gray-800">
              <div
                className="h-full bg-blue-500 transition-[width]"
                style={{ width: percent === null ? "35%" : `${percent}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">
              {percent === null
                ? `${Math.round(updateStatus.downloadedBytes / 1024)} KB downloaded`
                : `${percent}% complete`}
            </p>
          </div>
        );
      }
      case "installed":
        return <p className="text-sm text-green-400">Ferrlock {updateStatus.version} was installed. Restarting now...</p>;
      case "error":
        return <p className="text-sm text-red-400">{updateStatus.message}</p>;
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-lg font-semibold">Updates</h2>
        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">Current version</p>
              <p className="text-sm text-gray-400">{appVersion || "Loading..."}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void onCheckForUpdates()}
                disabled={checkingForUpdates}
                className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-gray-500 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updateStatus.kind === "checking" ? "Checking..." : "Check for Updates"}
              </button>
              {updateStatus.kind === "available" && (
                <button
                  type="button"
                  onClick={() => void onInstallUpdate()}
                  disabled={checkingForUpdates}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Download and Install
                </button>
              )}
            </div>
          </div>
          {renderUpdateDetails()}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Password</h2>
        <form onSubmit={handleSetPassword} className="max-w-sm space-y-3">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={passwordSet ? "New password" : "Set password"}
            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            {passwordSet ? "Change Password" : "Set Password"}
          </button>
          {message && (
            <p className={`text-sm ${message.includes("success") ? "text-green-400" : "text-red-400"}`}>
              {message}
            </p>
          )}
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">General</h2>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={autostart}
            onChange={(e) => handleAutostart(e.target.checked)}
            className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-300">Start Ferrlock on system startup</span>
        </label>
      </section>
    </div>
  );
}
