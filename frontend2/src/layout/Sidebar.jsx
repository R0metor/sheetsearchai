import {
  LayoutDashboard,
  MessageSquare,
  BarChart3,
  Settings,
  HelpCircle,
  PanelLeftClose,
  PanelLeft,
  LayoutGrid,
} from "lucide-react";

export const Sidebar = ({ page, setPage, collapsed, setCollapsed }) => {
  const navItems = [
    { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { id: "chat", icon: MessageSquare, label: "Chat" },
    { id: "analytics", icon: BarChart3, label: "Analytics" },
  ];
  const bottomItems = [
    { id: "settings", icon: Settings, label: "Settings" },
    { id: "help", icon: HelpCircle, label: "Help" },
  ];

  return (
    <aside
      className={`${collapsed ? "w-16" : "w-64"
        } h-screen flex-shrink-0 border-r
      border-slate-200/60 dark:border-slate-800
      bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl
      transition-all duration-300 flex flex-col relative z-20
      hidden md:flex`}
    >
      <div className="h-16 flex items-center px-4 border-b border-slate-200/60 dark:border-slate-800">
        {!collapsed && (
          <button
            onClick={() => setPage("landing")}
            className="flex items-center gap-2 group animate-fade-in"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-md shadow-green-500/20">
              <LayoutGrid size={14} className="text-white" />
            </div>
            <span className="font-display font-bold text-sm text-slate-900 dark:text-white">
              Sheet<span className="text-green-500">Search</span>
            </span>
          </button>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`${collapsed ? "mx-auto" : "ml-auto"
            } w-8 h-8 rounded-lg flex items-center justify-center
            text-slate-400 hover:text-slate-600 dark:hover:text-slate-300
            hover:bg-slate-100 dark:hover:bg-slate-800 transition-all`}
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <div className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const active = page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                ${active
                  ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                }`}
            >
              <item.icon
                size={18}
                className={active ? "text-green-500" : ""}
              />
              {!collapsed && <span>{item.label}</span>}
              {active && !collapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500" />
              )}
            </button>
          );
        })}
      </div>

      <div className="py-4 px-2 border-t border-slate-200/60 dark:border-slate-800 space-y-1">
        {bottomItems.map((item) => (
          <button
            key={item.id}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
              text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <item.icon size={18} />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
        {!collapsed && (
          <div className="mx-2 mt-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200/50 dark:border-green-800/30">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-green-700 dark:text-green-300">
                Google Sheets Connected
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
