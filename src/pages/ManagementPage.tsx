import { useEffect, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";
import AppList from "../components/AppList";
import SettingsPanel from "../components/SettingsPanel";
import { formatUpdateError, toAvailableUpdateDetails, type UpdateStatus } from "../lib/updater";

type Tab = "apps" | "settings";

export default function ManagementPage() {
  const [tab, setTab] = useState<Tab>("apps");
  const [ready, setReady] = useState(false);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [appVersion, setAppVersion] = useState("");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingUpdateRef = useRef<Update | null>(null);
  const updateCheckStartedRef = useRef(false);

  async function relockManagement() {
    setPassword("");
    setError("");
    setLoading(false);
    setTab("apps");

    try {
      const passwordSet = await invoke<boolean>("is_password_set");
      setRequiresPassword(passwordSet);
      setUnlocked(!passwordSet);
    } catch {
      setRequiresPassword(false);
      setUnlocked(true);
    }
  }

  useEffect(() => {
    let mounted = true;

    getVersion()
      .then((version) => {
        if (mounted) {
          setAppVersion(version);
        }
      })
      .catch(() => {});

    invoke<boolean>("is_password_set")
      .then((passwordSet) => {
        if (!mounted) {
          return;
        }

        setRequiresPassword(passwordSet);
        setUnlocked(!passwordSet);
        setReady(true);
      })
      .catch(() => {
        if (!mounted) {
          return;
        }

        setRequiresPassword(false);
        setUnlocked(true);
        setReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen("management-lock-requested", () => {
      void relockManagement();
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!ready || !requiresPassword || unlocked) {
      return;
    }

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => window.clearTimeout(timer);
  }, [ready, requiresPassword, unlocked]);

  useEffect(() => {
    if (!ready || !unlocked || updateCheckStartedRef.current) {
      return;
    }

    updateCheckStartedRef.current = true;
    void runUpdateCheck("startup");
  }, [ready, unlocked]);

  async function runUpdateCheck(source: "startup" | "manual") {
    setUpdateStatus({ kind: "checking", source });

    try {
      const availableUpdate = await check();

      if (!availableUpdate) {
        pendingUpdateRef.current = null;
        setUpdateStatus({
          kind: "no-update",
          currentVersion: appVersion || "unknown",
          checkedAt: new Date().toISOString(),
        });
        return;
      }

      pendingUpdateRef.current = availableUpdate;
      setUpdateStatus({
        kind: "available",
        ...toAvailableUpdateDetails(availableUpdate),
      });
    } catch (err) {
      pendingUpdateRef.current = null;
      setUpdateStatus({
        kind: "error",
        message: formatUpdateError(err),
      });
    }
  }

  async function handleInstallUpdate() {
    const availableUpdate = pendingUpdateRef.current;
    if (!availableUpdate) {
      return;
    }

    const accepted = await confirm(
      `Download and install Ferrlock ${availableUpdate.version} now?${availableUpdate.body ? `\n\n${availableUpdate.body}` : ""}`,
      {
        title: "Ferrlock update available",
        kind: "info",
        okLabel: "Install update",
        cancelLabel: "Later",
      },
    );

    if (!accepted) {
      return;
    }

    let downloadedBytes = 0;
    let totalBytes: number | undefined;

    try {
      setUpdateStatus({
        kind: "downloading",
        version: availableUpdate.version,
        downloadedBytes: 0,
      });

      await availableUpdate.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === "Started") {
          totalBytes = event.data.contentLength;
          downloadedBytes = 0;
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
        }

        setUpdateStatus({
          kind: "downloading",
          version: availableUpdate.version,
          downloadedBytes,
          totalBytes,
        });
      });

      pendingUpdateRef.current = null;
      setUpdateStatus({
        kind: "installed",
        version: availableUpdate.version,
      });

      await relaunch();
    } catch (err) {
      setUpdateStatus({
        kind: "error",
        message: formatUpdateError(err),
      });
    }
  }

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const valid = await invoke<boolean>("verify_management_password", { password });

      if (!valid) {
        setError("Wrong password");
        setPassword("");
        inputRef.current?.focus();
        return;
      }

      setUnlocked(true);
      setPassword("");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    setPassword("");
    setError("");
    await getCurrentWindow().hide();
  }

  if (!ready) {
    return null;
  }

  if (requiresPassword && !unlocked) {
    return (
      <div className="flex h-screen items-center justify-center overflow-hidden bg-gray-900 px-6 pb-4 pt-2 text-white">
        <div className="w-full max-w-sm">
          <div className="mb-3 flex flex-col items-center">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600/20">
              <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-white">Ferrlock</p>
            <p className="text-xs text-gray-500">Enter password to open management</p>
          </div>

          <form onSubmit={handleUnlock}>
            <input
              id="management-password"
              name="management-password"
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

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="border-b border-gray-700 px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight">Ferrlock</h1>
        <p className="text-sm text-gray-400">Application Locker</p>
      </header>

      <nav className="flex border-b border-gray-700">
        <button
          onClick={() => setTab("apps")}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            tab === "apps"
              ? "border-b-2 border-blue-500 text-blue-400"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Protected Apps
        </button>
        <button
          onClick={() => setTab("settings")}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            tab === "settings"
              ? "border-b-2 border-blue-500 text-blue-400"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Settings
        </button>
      </nav>

      <main className="p-6">
        {updateStatus.kind === "available" && tab !== "settings" && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-blue-200">
                Ferrlock {updateStatus.version} is available.
              </p>
              <p className="text-xs text-blue-100/80">Open Settings to review release notes and install the update.</p>
            </div>
            <button
              type="button"
              onClick={() => setTab("settings")}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              View Update
            </button>
          </div>
        )}

        {tab === "apps" ? (
          <AppList />
        ) : (
          <SettingsPanel
            appVersion={appVersion}
            updateStatus={updateStatus}
            onCheckForUpdates={async () => {
              await runUpdateCheck("manual");
            }}
            onInstallUpdate={handleInstallUpdate}
          />
        )}
      </main>
    </div>
  );
}
