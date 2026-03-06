import { Moon, Sun, Bell } from "lucide-react";

export const DashboardHeader = ({ dark, setDark, title }) => (
  <header
    className="h-16 flex items-center justify-between px-6 border-b border-slate-200/60 dark:border-slate-800
    bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl sticky top-0 z-10"
  >
    <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
      {title}
    </h1>
    <div className="flex items-center gap-3">
      <button
        className="w-9 h-9 rounded-xl flex items-center justify-center
        text-slate-400 hover:text-slate-600 dark:hover:text-slate-300
        hover:bg-slate-100 dark:hover:bg-slate-800 transition-all relative"
      >
        <Bell size={16} />
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-500" />
      </button>
      <button
        onClick={() => setDark(!dark)}
        className="w-9 h-9 rounded-xl flex items-center justify-center
          bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400
          hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
      >
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      <div
        className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600
        flex items-center justify-center text-white text-xs font-bold cursor-pointer"
      >
        JS
      </div>
    </div>
  </header>
);
