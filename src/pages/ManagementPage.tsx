import { useState } from "react";
import AppList from "../components/AppList";
import SettingsPanel from "../components/SettingsPanel";

type Tab = "apps" | "settings";

export default function ManagementPage() {
  const [tab, setTab] = useState<Tab>("apps");

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
        {tab === "apps" ? <AppList /> : <SettingsPanel />}
      </main>
    </div>
  );
}
