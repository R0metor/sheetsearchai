import { useState, useEffect } from "react";
import { Navbar } from "./layout/Navbar.jsx";
import { CommandPalette } from "./components/CommandPalette.jsx";
import { LandingPage } from "./pages/LandingPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { ChatPage } from "./pages/ChatPage.jsx";
import { AnalyticsPage } from "./pages/AnalyticsPage.jsx";

export default function App() {
  const [dark, setDark] = useState(false);
  const [page, setPage] = useState("landing");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [datasetId, setDatasetId] = useState(null);

  // Ctrl+K command palette
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
      if (e.key === "Escape") setCmdOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Scroll to top on page change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const pages = {
    landing: <LandingPage setPage={setPage} />,
    dashboard: <DashboardPage dark={dark} setDark={setDark} setPage={setPage} datasetId={datasetId} setDatasetId={setDatasetId} />,
    chat: <ChatPage dark={dark} setDark={setDark} setPage={setPage} datasetId={datasetId} />,
    analytics: <AnalyticsPage dark={dark} setDark={setDark} setPage={setPage} datasetId={datasetId} />,
  };

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-theme">
        {page === "landing" && (
          <Navbar dark={dark} setDark={setDark} page={page} setPage={setPage} />
        )}
        <CommandPalette
          open={cmdOpen}
          onClose={() => setCmdOpen(false)}
          onNavigate={(p) => {
            setPage(p);
            setCmdOpen(false);
          }}
        />
        <div key={page} className="animate-fade-in">
          {pages[page] || pages.landing}
        </div>
      </div>
    </div>
  );
}
