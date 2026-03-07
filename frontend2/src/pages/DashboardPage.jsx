import { useState, useEffect } from "react";
import {
  FileSpreadsheet, LayoutGrid, Database, Cpu,
  Plus, MessageSquare, Download, RefreshCw,
  Zap,
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

const SpreadsheetPreview = ({ rows, sheetName }) => {
  if (!rows || rows.length === 0) return null;
  const headers = Object.keys(rows[0]);
  return (
    <Card className="p-5 animate-fade-in-up" hover={false} style={{ animationDelay: "0.3s" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={16} className="text-green-500" />
          <span className="text-sm font-semibold text-slate-900 dark:text-white">{sheetName}</span>
        </div>
        <Badge>Connected</Badge>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-700/40">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="px-3 py-2.5 text-left font-semibold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 border-b border-green-200/30 dark:border-green-800/30 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-green-50/50 dark:hover:bg-green-900/10 transition-colors">
                {headers.map((h, j) => (
                  <td key={j} className="px-3 py-2 text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap">
                    {row[h] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

const ColumnExplorer = ({ columns }) => {
  if (!columns || columns.length === 0) return null;
  return (
    <Card className="p-5 animate-fade-in-up" hover={false} style={{ animationDelay: "0.4s" }}>
      <div className="flex items-center gap-2 mb-4">
        <LayoutGrid size={16} className="text-green-500" />
        <span className="text-sm font-semibold text-slate-900 dark:text-white">Sheet Columns</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {columns.map((col, i) => (
          <span
            key={i}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/40"
            style={{ animation: "fadeInUp 0.3s ease-out both", animationDelay: `${i * 0.03}s` }}
          >
            {col}
          </span>
        ))}
      </div>
    </Card>
  );
};

const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded-xl ${className}`} />
);

const SkeletonDashboard = () => (
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
      <div className="bg-white/70 dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 p-5">
        <Skeleton className="h-5 w-40 mb-4" />
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-full mb-2" />)}
      </div>
      <div className="bg-white/70 dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 p-5">
        <Skeleton className="h-5 w-40 mb-4" />
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-7 w-24" />)}
        </div>
      </div>
    </div>
  </div>
);

export const DashboardPage = ({ dark, setDark, setPage, datasetId, setDatasetId }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchStats = (id) => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_BASE}/api/stats?dataset_id=${id}`)
      .then((r) => r.json())
      .then((data) => { if (data.ok) setStats(data); })
      .catch(() => { })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (datasetId) {
      fetchStats(datasetId);
    }
  }, [datasetId]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.ok && data.dataset_id) {
        setDatasetId(data.dataset_id);
      } else {
        alert("Upload failed: " + (data.detail || data.error));
      }
    } catch (err) {
      alert("Error uploading file: " + err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 transition-theme overflow-hidden">
      <AnimatedBackground variant="dashboard" />
      <Sidebar page="dashboard" setPage={setPage} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader dark={dark} setDark={setDark} title="Dashboard" />
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <SkeletonDashboard />
          ) : !stats ? (
            <div className="text-center py-24">
              <Database size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Upload a CSV or XLSX file to start analyzing your data.</p>
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-400 transition-colors shadow-lg shadow-green-500/30">
                {uploading ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                <span>{uploading ? "Uploading..." : "Upload File"}</span>
                <input type="file" accept=".csv,.xlsx" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Database} label="Total Rows" value={(stats.total_rows || 0).toLocaleString()} sub="Live" delay="0" />
                <StatCard icon={LayoutGrid} label="Columns" value={(stats.columns || []).length} delay="0.1" />
                <StatCard icon={FileSpreadsheet} label="Connected Sheet" value={stats.filename || "Uploaded File"} delay="0.2" />
                <StatCard icon={Cpu} label="AI Model" value="GPT-4.1-mini" delay="0.3" />
              </div>
              <div className="grid lg:grid-cols-2 gap-6">
                <SpreadsheetPreview rows={stats.sample_rows} sheetName={stats.filename || "Uploaded File"} />
                <ColumnExplorer columns={stats.columns} />
              </div>
              <Card className="p-5 animate-fade-in-up" hover={false} style={{ animationDelay: "0.5s" }}>
                <div className="flex items-center gap-2 mb-4">
                  <Zap size={16} className="text-green-500" />
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Quick Actions</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: MessageSquare, label: "Ask AI Agent", nav: "chat" },
                    { icon: Plus, label: "Upload New File", action: () => document.getElementById('new-file-upload').click() },
                  ].map((a, i) => (
                    <button key={i} onClick={a.nav ? () => setPage(a.nav) : a.action}
                      className="flex items-center gap-3 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/40 hover:bg-green-50 dark:hover:bg-green-900/10 hover:border-green-300 dark:hover:border-green-800 transition-all text-left group">
                      <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center group-hover:bg-green-500 transition-colors">
                        <a.icon size={14} className="text-green-600 dark:text-green-400 group-hover:text-white transition-colors" />
                      </div>
                      <span className="text-sm text-slate-700 dark:text-slate-300">{a.label}</span>
                    </button>
                  ))}
                  <input id="new-file-upload" type="file" accept=".csv,.xlsx" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
