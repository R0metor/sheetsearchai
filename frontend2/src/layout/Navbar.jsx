import { useState, useEffect } from "react";
import { Moon, Sun, Menu, X, Sparkles, LayoutGrid } from "lucide-react";
import { GreenButton } from "../components/ui/index.jsx";

export const Navbar = ({ dark, setDark, page, setPage }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500
      ${scrolled ? "glass shadow-lg shadow-black/5" : "bg-transparent"}`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <button
          onClick={() => setPage("landing")}
          className="flex items-center gap-2.5 group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20 group-hover:shadow-green-500/40 transition-shadow">
            <LayoutGrid size={16} className="text-white" />
          </div>
          <span className="font-display font-bold text-lg text-slate-900 dark:text-white">
            Sheet<span className="text-green-500">Search</span>
          </span>
        </button>

        <div className="hidden md:flex items-center gap-1">
          {[
            { id: "landing", label: "Home" },
            { id: "dashboard", label: "Dashboard" },
            { id: "chat", label: "Chat" },
            { id: "analytics", label: "Analytics" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${
                  page === item.id
                    ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDark(!dark)}
            className="w-9 h-9 rounded-xl flex items-center justify-center
              bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300
              hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <GreenButton size="sm" onClick={() => setPage("dashboard")}>
            <Sparkles size={14} />
            Launch App
          </GreenButton>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center
              bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden glass border-t border-slate-200/50 dark:border-slate-700/50 animate-fade-in">
          <div className="p-4 flex flex-col gap-1">
            {["landing", "dashboard", "chat", "analytics"].map((id) => (
              <button
                key={id}
                onClick={() => {
                  setPage(id);
                  setMobileOpen(false);
                }}
                className="px-4 py-3 rounded-xl text-sm font-medium text-left
                  text-slate-700 dark:text-slate-300 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors capitalize"
              >
                {id === "landing" ? "Home" : id}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
};
