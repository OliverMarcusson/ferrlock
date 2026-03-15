import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";

export default function SettingsPanel() {
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

  return (
    <div className="space-y-8">
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
