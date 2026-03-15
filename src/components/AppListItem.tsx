interface ProtectedApp {
  name: string;
  exe_name: string;
  exe_path: string;
}

interface Props {
  app: ProtectedApp;
  onRemove: (exeName: string) => void;
}

export default function AppListItem({ app, onRemove }: Props) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-800 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-700">
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <p className="font-medium text-white">{app.name}</p>
          <p className="text-xs text-gray-500">{app.exe_path}</p>
        </div>
      </div>
      <button
        onClick={() => onRemove(app.exe_name)}
        className="rounded-lg px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-900/30"
      >
        Remove
      </button>
    </div>
  );
}
