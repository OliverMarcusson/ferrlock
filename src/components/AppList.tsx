import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import AppListItem from "./AppListItem";

interface ProtectedApp {
  name: string;
  exe_name: string;
  exe_path: string;
}

export default function AppList() {
  const [apps, setApps] = useState<ProtectedApp[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadApps() {
    try {
      const result = await invoke<ProtectedApp[]>("get_protected_apps");
      setApps(result);
    } catch (err) {
      console.error("Failed to load apps:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApps();
  }, []);

  async function handleAdd() {
    console.log("[ferrlock-ui] handleAdd clicked");
    let file;
    try {
      file = await open({
        multiple: false,
        filters: [{ name: "Executables", extensions: ["exe"] }],
      });
      console.log("[ferrlock-ui] dialog result:", file, typeof file);
    } catch (err) {
      console.error("[ferrlock-ui] dialog error:", err);
      return;
    }

    if (!file) {
      console.log("[ferrlock-ui] no file selected");
      return;
    }

    const path = typeof file === "string" ? file : String(file);
    const parts = path.replace(/\\/g, "/").split("/");
    const exeName = parts[parts.length - 1];
    const name = exeName.replace(".exe", "");

    console.log("[ferrlock-ui] invoking add_protected_app:", { name, exeName, exePath: path });
    try {
      await invoke("add_protected_app", {
        name,
        exeName,
        exePath: path,
      });
      console.log("[ferrlock-ui] add succeeded");
      await loadApps();
    } catch (err) {
      console.error("[ferrlock-ui] add failed:", err);
    }
  }

  async function handleRemove(exeName: string) {
    try {
      await invoke("remove_protected_app", { exeName });
      await loadApps();
    } catch (err) {
      console.error("Failed to remove app:", err);
    }
  }

  if (loading) {
    return <p className="text-gray-400">Loading...</p>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Protected Applications</h2>
        <button
          onClick={handleAdd}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          + Add App
        </button>
      </div>

      {apps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-600 p-8 text-center">
          <p className="text-gray-400">No protected applications yet.</p>
          <p className="mt-1 text-sm text-gray-500">
            Click "Add App" to protect an application with a password.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {apps.map((app) => (
            <AppListItem key={app.exe_name} app={app} onRemove={handleRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
