import type { Update } from "@tauri-apps/plugin-updater";

export type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking"; source: "startup" | "manual" }
  | { kind: "available"; currentVersion: string; version: string; body?: string; date?: string }
  | { kind: "no-update"; currentVersion: string; checkedAt: string }
  | { kind: "downloading"; version: string; downloadedBytes: number; totalBytes?: number }
  | { kind: "installed"; version: string }
  | { kind: "error"; message: string };

export interface AvailableUpdateDetails {
  currentVersion: string;
  version: string;
  body?: string;
  date?: string;
}

export function toAvailableUpdateDetails(update: Update): AvailableUpdateDetails {
  return {
    currentVersion: update.currentVersion,
    version: update.version,
    body: update.body,
    date: update.date,
  };
}

export function formatUpdateError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Failed to check for updates";
}
