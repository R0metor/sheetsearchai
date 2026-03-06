import { useState, useEffect, useRef } from "react";
import {
  Search,
  Home,
  LayoutDashboard,
  MessageSquare,
  BarChart3,
  Moon,
  FileSpreadsheet,
} from "lucide-react";

export const CommandPalette = ({ open, onClose, onNavigate }) => {
  const [search, setSearch] = useState("");
  const inputRef = useRef(null);

  const commands = [
    { icon: Home, label: "Go to Landing Page", action: () => onNavigate("landing") },
    { icon: LayoutDashboard, label: "Go to Dashboard", action: () => onNavigate("dashboard") },
    { icon: MessageSquare, label: "Open Chat", action: () => onNavigate("chat") },
    { icon: BarChart3, label: "View Analytics", action: () => onNavigate("analytics") },
    { icon: Moon, label: "Toggle Dark Mode", action: () => {} },
    { icon: FileSpreadsheet, label: "Connect Sheet", action: () => {} },
  ];

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
    if (open) setSearch("");
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-32"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-2xl overflow-hidden glass border border-slate-200/50 dark:border-slate-700/50 shadow-2xl">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200/50 dark:border-slate-700/50">
            <Search size={18} className="text-slate-400" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search commands..."
              className="flex-1 bg-transparent outline-none text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
            />
            <kbd className="px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
              ESC
            </kbd>
          </div>
          <div className="p-2 max-h-72 overflow-y-auto">
            {filtered.map((cmd, i) => (
              <button
                key={i}
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm text-left
                  text-slate-700 dark:text-slate-300 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
              >
                <cmd.icon size={16} className="text-green-500" />
                {cmd.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
