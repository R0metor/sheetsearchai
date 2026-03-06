import { useState, useEffect } from "react";
import {
  Database, LayoutGrid, FileSpreadsheet, Cpu,
  RefreshCw, Table, Layers,
} from "lucide-react";
import { Card, Badge } from "../components/ui/index.jsx";
import { AnimatedBackground } from "../components/AnimatedBackground.jsx";
import { Sidebar } from "../layout/Sidebar.jsx";
import { DashboardHeader } from "../layout/DashboardHeader.jsx";

const API_BASE = "";

const StatCard = ({ icon: Icon, label, value, sub, delay = "0" }) => (
  <Card className="p-5 animate-fade-in-up" style={{ animationDelay: `${delay}s` }}>
    <div className="flex items-start justify-between mb-3">
      <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
        <Icon size={18} className="text-green-600 dark:text-green-400" />
      </div>
      {sub && (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          {sub}
        </span>
      )}
    </div>
    <div className="font-display text-2xl font-bold text-slate-900 dark:text-white mb-1">{value}</div>
    <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
  </Card>
);

const LoadingState = () => (
  <div className="flex items-center justify-center py-24">
    <div className="text-center">
      <RefreshCw size={32} className="text-green-500 animate-spin mx-auto mb-4" />
      <p className="text-sm text-slate-500 dark:text-slate-400">Loading sheet data…</p>
    </div>
  </div>
);

export const AnalyticsPage = ({ dark, setDark, setPage }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/stats`)
      .then((r) => r.json())
      .then((data) => { if (data.ok) setStats(data); })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 transition-theme overflow-hidden">
      <AnimatedBackground variant="dashboard" />
      <Sidebar page="analytics" setPage={setPage} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader dark={dark} setDark={setDark} title="Data Overview" />
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <LoadingState />
          ) : !stats ? (
            <div className="text-center py-24">
              <Database size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Could not load sheet data.</p>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Stats row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Database} label="Total Rows" value={stats.total_rows.toLocaleString()} sub="Live" delay="0" />
                <StatCard icon={LayoutGrid} label="Columns" value={stats.columns.length} delay="0.1" />
                <StatCard icon={FileSpreadsheet} label="Sheet" value={stats.sheet_name} delay="0.2" />
                <StatCard icon={Cpu} label="AI Model" value="GPT-4.1-mini" delay="0.3" />
              </div>

              {/* Column detail table */}
              <Card className="p-6 animate-fade-in-up" hover={false} style={{ animationDelay: "0.4s" }}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-green-500" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Column Explorer</h3>
                  </div>
                  <Badge>{stats.columns.length} columns</Badge>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-700/40">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50">
                        {["#", "Column Name", "Sample Value"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-slate-700/40">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.columns.map((col, i) => (
                        <tr key={i} className="hover:bg-green-50/50 dark:hover:bg-green-900/10 transition-colors">
                          <td className="px-4 py-3 text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 font-mono text-xs w-10">
                            {i + 1}
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 font-medium">
                            {col}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 font-mono text-xs">
                            {stats.sample_rows[0]?.[col] ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Sample data preview */}
              <Card className="p-6 animate-fade-in-up" hover={false} style={{ animationDelay: "0.5s" }}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Table size={16} className="text-green-500" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Sample Data</h3>
                  </div>
                  <Badge>First {stats.sample_rows.length} rows</Badge>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-700/40">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-green-50 dark:bg-green-900/20">
                        {stats.columns.map((h, i) => (
                          <th key={i} className="px-3 py-2.5 text-left text-xs font-semibold text-green-700 dark:text-green-300 border-b border-green-200/30 dark:border-green-800/30 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.sample_rows.map((row, ri) => (
                        <tr key={ri} className="hover:bg-green-50/30 dark:hover:bg-green-900/10 transition-colors">
                          {stats.columns.map((col, ci) => (
                            <td key={ci} className="px-3 py-2.5 text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap text-xs">
                              {row[col] ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
