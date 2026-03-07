import { useState, useEffect, useMemo } from "react";
import {
  Database, LayoutGrid, Hash, Calendar, Type, ToggleLeft,
  RefreshCw, Table, Layers, Search, Sparkles, FileSpreadsheet,
} from "lucide-react";
import { Card, Badge } from "../components/ui/index.jsx";
import { AnimatedBackground } from "../components/AnimatedBackground.jsx";
import { Sidebar } from "../layout/Sidebar.jsx";
import { DashboardHeader } from "../layout/DashboardHeader.jsx";
import { humanizeColumnName } from "../utils/columns.js";

const API_BASE = "";

/* ── Type detection ── */
function detectType(value) {
  if (value === null || value === undefined || value === "") return "string";
  const s = String(value).trim().toLowerCase();
  if (["true", "false", "yes", "no", "1", "0"].includes(s)) return "boolean";
  if (!isNaN(Number(value)) && value !== "") return "numeric";
  if (/\d{4}/.test(s) && !isNaN(Date.parse(value))) return "date";
  return "string";
}

function buildColumnTypes(columns, sampleRows) {
  const sample = sampleRows?.[0] ?? {};
  return columns.map((col) => ({
    name: col,
    type: detectType(sample[col]),
    example: sample[col] ?? "—",
  }));
}

/* ── Type badge ── */
const TYPE_STYLES = {
  numeric: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  string: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  boolean: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  date: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
};
const TYPE_ICONS = { numeric: Hash, string: Type, boolean: ToggleLeft, date: Calendar };

const TypeBadge = ({ type }) => {
  const Icon = TYPE_ICONS[type] ?? Type;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${TYPE_STYLES[type]}`}>
      <Icon size={10} />
      {type}
    </span>
  );
};

/* ── Skeleton loader ── */
const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded-xl ${className}`} />
);

const SkeletonAnalytics = () => (
  <div className="max-w-7xl mx-auto space-y-6">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-white/70 dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 p-5">
          <Skeleton className="w-10 h-10 mb-3" />
          <Skeleton className="h-7 w-20 mb-2" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-white/70 dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 p-6 space-y-3">
        <Skeleton className="h-5 w-40 mb-4" />
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
      <div className="bg-white/70 dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 p-6 space-y-3">
        <Skeleton className="h-5 w-40 mb-4" />
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    </div>
    <div className="bg-white/70 dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 p-6">
      <Skeleton className="h-5 w-32 mb-4" />
      {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full mb-2" />)}
    </div>
  </div>
);

/* ── Stat Card ── */
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

/* ── Column Explorer ── */
const ColumnExplorer = ({ columnTypes }) => {
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () => columnTypes.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [columnTypes, search]
  );
  return (
    <Card className="p-6 animate-fade-in-up" hover={false} style={{ animationDelay: "0.4s" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-green-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Column Explorer</h3>
        </div>
        <Badge>{columnTypes.length} columns</Badge>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Filter columns…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/40 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 green-focus transition-all"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-700/40 max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 dark:bg-slate-800/80">
              {["Column", "Type", "Example"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-slate-700/40">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-xs text-slate-400">No columns match "{search}"</td>
              </tr>
            ) : (
              filtered.map((col, i) => (
                <tr key={i} className="hover:bg-green-50/50 dark:hover:bg-green-900/10 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 truncate max-w-[160px]">
                    {humanizeColumnName(col.name)}
                  </td>
                  <td className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                    <TypeBadge type={col.type} />
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 font-mono text-xs truncate max-w-[160px]">
                    {String(col.example).slice(0, 40) || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

/* ── Dataset Summary ── */
const TypeCountRow = ({ icon: Icon, label, count, colorClass }) => (
  <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
    <div className="flex items-center gap-2">
      <Icon size={14} className={colorClass} />
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
    </div>
    <span className={`text-sm font-bold ${colorClass}`}>{count}</span>
  </div>
);

const DatasetSummary = ({ stats, columnTypes }) => {
  const counts = useMemo(() => ({
    numeric: columnTypes.filter((c) => c.type === "numeric").length,
    string: columnTypes.filter((c) => c.type === "string").length,
    date: columnTypes.filter((c) => c.type === "date").length,
    boolean: columnTypes.filter((c) => c.type === "boolean").length,
  }), [columnTypes]);

  return (
    <Card className="p-6 animate-fade-in-up" hover={false} style={{ animationDelay: "0.45s" }}>
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <FileSpreadsheet size={16} className="text-green-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Dataset Summary</h3>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 pl-6">Automatically inferred schema and column types</p>
      </div>

      <div className="space-y-2 mb-5">
        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">Total Rows</span>
          <span className="text-sm font-bold text-slate-900 dark:text-white">{(stats.total_rows || 0).toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">Total Columns</span>
          <span className="text-sm font-bold text-slate-900 dark:text-white">{(stats.columns || []).length}</span>
        </div>
      </div>

      <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Column Types</div>
      <div className="space-y-2">
        <TypeCountRow icon={Hash} label="Numeric columns" count={counts.numeric} colorClass="text-blue-500" />
        <TypeCountRow icon={Type} label="Text columns" count={counts.string} colorClass="text-slate-500" />
        <TypeCountRow icon={Calendar} label="Date columns" count={counts.date} colorClass="text-orange-500" />
        <TypeCountRow icon={ToggleLeft} label="Boolean columns" count={counts.boolean} colorClass="text-purple-500" />
      </div>
    </Card>
  );
};

/* ── Sample Data Table ── */
const SampleTable = ({ columns, sampleRows }) => (
  <Card className="p-6 animate-fade-in-up" hover={false} style={{ animationDelay: "0.5s" }}>
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2">
        <Table size={16} className="text-green-500" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Sample Data</h3>
      </div>
      <Badge>First {sampleRows.length} rows</Badge>
    </div>
    <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-700/40">
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10">
          <tr className="bg-green-50 dark:bg-green-900/20">
            {columns.map((h, i) => (
              <th key={i} className="px-3 py-2.5 text-left font-semibold text-green-700 dark:text-green-300 border-b border-green-200/30 dark:border-green-800/30 whitespace-nowrap">
                {humanizeColumnName(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sampleRows.map((row, ri) => (
            <tr key={ri} className="hover:bg-green-50/40 dark:hover:bg-green-900/10 transition-colors">
              {columns.map((col, ci) => (
                <td key={ci} className="px-3 py-2.5 text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap">
                  {String(row[col] ?? "").slice(0, 60) || <span className="text-slate-300 dark:text-slate-600">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Card>
);

/* ── Suggested Questions ── */
function buildSuggestions(columnTypes) {
  const suggestions = [];
  const numeric = columnTypes.filter((c) => c.type === "numeric").map((c) => c.name);
  const dates = columnTypes.filter((c) => c.type === "date").map((c) => c.name);
  const strings = columnTypes.filter((c) => c.type === "string").map((c) => c.name);

  if (numeric[0]) suggestions.push(`What is the average ${humanizeColumnName(numeric[0])}?`);
  if (numeric[0]) suggestions.push(`Show the top 10 rows by ${humanizeColumnName(numeric[0])}`);
  if (numeric[1]) suggestions.push(`What is the total ${humanizeColumnName(numeric[1])}?`);
  if (dates[0]) suggestions.push(`How many rows were added per month?`);
  if (strings[0]) suggestions.push(`Which ${humanizeColumnName(strings[0])} has the highest count?`);
  if (strings[1]) suggestions.push(`Show all unique values of ${humanizeColumnName(strings[1])}`);

  // Fallback generic
  if (suggestions.length < 3) {
    suggestions.push("How many rows are in the dataset?");
    suggestions.push("Show the first 5 rows");
  }
  return suggestions.slice(0, 6);
}

const SuggestedQuestions = ({ columnTypes, setPage }) => {
  const suggestions = useMemo(() => buildSuggestions(columnTypes), [columnTypes]);
  return (
    <Card className="p-6 animate-fade-in-up" hover={false} style={{ animationDelay: "0.6s" }}>
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-green-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Suggested Questions</h3>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 pl-6">Try asking the AI about your dataset</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((q, i) => (
          <button
            key={i}
            onClick={() => setPage("chat")}
            className="px-4 py-2 rounded-xl text-sm bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/40 hover:border-green-300 dark:hover:border-green-700 hover:text-green-600 dark:hover:text-green-400 hover:shadow-sm transition-all"
          >
            {q}
          </button>
        ))}
      </div>
    </Card>
  );
};

/* ── Empty State ── */
const EmptyState = ({ setPage }) => (
  <div className="flex items-center justify-center py-32">
    <div className="text-center animate-fade-in-up">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
        <Database size={28} className="text-slate-400 dark:text-slate-500" />
      </div>
      <h3 className="font-display text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No dataset connected</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-xs mx-auto">
        Upload a CSV or XLSX file to start exploring your data.
      </p>
      <button
        onClick={() => setPage("dashboard")}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-400 transition-colors shadow-lg shadow-green-500/25 text-sm font-medium"
      >
        Upload file
      </button>
    </div>
  </div>
);

/* ── Main Page ── */
export const AnalyticsPage = ({ dark, setDark, setPage, datasetId }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!datasetId) return;
    setLoading(true);
    fetch(`${API_BASE}/api/stats?dataset_id=${datasetId}`)
      .then((r) => r.json())
      .then((data) => { if (data.ok) setStats(data); })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [datasetId]);

  const columnTypes = useMemo(
    () => (stats ? buildColumnTypes(stats.columns || [], stats.sample_rows || []) : []),
    [stats]
  );

  const numericCount = columnTypes.filter((c) => c.type === "numeric").length;
  const dateCount = columnTypes.filter((c) => c.type === "date").length;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 transition-theme overflow-hidden">
      <AnimatedBackground variant="dashboard" />
      <Sidebar page="analytics" setPage={setPage} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader dark={dark} setDark={setDark} title="Data Overview" />
        <div className="flex-1 overflow-y-auto p-6">
          {!datasetId ? (
            <EmptyState setPage={setPage} />
          ) : loading ? (
            <SkeletonAnalytics />
          ) : !stats ? (
            <div className="text-center py-24">
              <Database size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Could not load dataset.</p>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto space-y-6">
              {/* ── 4 Stat Cards ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Database} label="Total Rows" value={(stats.total_rows || 0).toLocaleString()} sub="Live" delay="0" />
                <StatCard icon={LayoutGrid} label="Total Columns" value={(stats.columns || []).length} delay="0.1" />
                <StatCard icon={Hash} label="Numeric Columns" value={numericCount} delay="0.2" />
                <StatCard icon={Calendar} label="Date Columns" value={dateCount} delay="0.3" />
              </div>

              {/* ── 2-column layout ── */}
              <div className="grid lg:grid-cols-2 gap-6">
                <ColumnExplorer columnTypes={columnTypes} />
                <DatasetSummary stats={stats} columnTypes={columnTypes} />
              </div>

              {/* ── Sample Data Table ── */}
              <SampleTable columns={stats.columns || []} sampleRows={(stats.sample_rows || []).slice(0, 10)} />

              {/* ── Suggested Questions ── */}
              <SuggestedQuestions columnTypes={columnTypes} setPage={setPage} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
