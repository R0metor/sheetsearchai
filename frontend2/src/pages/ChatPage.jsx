import { useState, useEffect, useRef, useCallback } from "react";
import { Bot, User, Send, Copy, Check, Sparkles, Table, History, ArrowRight, AlertTriangle, BarChart3, Terminal, ChevronDown, ChevronRight } from "lucide-react";
import { AnimatedBackground } from "../components/AnimatedBackground.jsx";
import { Sidebar } from "../layout/Sidebar.jsx";
import { DashboardHeader } from "../layout/DashboardHeader.jsx";

const API_BASE = "";

/* ───────── Tool Pipeline Badge ───────── */

const ToolsPipeline = ({ tools }) => {
  if (!tools || tools.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
      {tools.map((t, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="px-2 py-0.5 rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-[10px] font-semibold uppercase tracking-wide">
            {t}
          </span>
          {i < tools.length - 1 && <ArrowRight size={10} className="text-green-400" />}
        </span>
      ))}
    </div>
  );
};

/* ───────── Rows Table ───────── */

const RowsTable = ({ rows }) => {
  if (!rows || rows.length === 0) return null;
  const headers = Object.keys(rows[0]);
  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-700/40">
      <table className="chat-table">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="text-green-700 dark:text-green-300 bg-green-50/50 dark:bg-green-900/20 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-green-50/30 dark:hover:bg-green-900/10 transition-colors">
              {headers.map((h, ci) => (
                <td key={ci} className="text-slate-700 dark:text-slate-300 whitespace-nowrap">{row[h] ?? ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ───────── Aggregate Card ───────── */

const AggregateCard = ({ aggregate }) => {
  if (!aggregate) return null;
  return (
    <div className="my-3 p-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200/60 dark:border-green-800/40">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 size={16} className="text-green-500" />
        <span className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">
          {aggregate.op}
        </span>
      </div>
      <div className="text-3xl font-bold text-green-700 dark:text-green-300">
        {typeof aggregate.value === "number" ? aggregate.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : aggregate.value}
      </div>
      <div className="text-xs text-green-600/70 dark:text-green-400/60 mt-1">
        Column: {aggregate.column} · {aggregate.count} rows analyzed
      </div>
    </div>
  );
};

/* ───────── Group Aggregate Table ───────── */

const GroupTable = ({ groups, answer }) => {
  if (!groups || groups.length === 0) return null;
  return (
    <div className="my-3">
      <div className="text-xs font-semibold text-green-700 dark:text-green-300 mb-2 uppercase tracking-wide">
        {answer}
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-700/40">
        <table className="chat-table">
          <thead>
            <tr>
              <th className="text-green-700 dark:text-green-300 bg-green-50/50 dark:bg-green-900/20">Group</th>
              <th className="text-green-700 dark:text-green-300 bg-green-50/50 dark:bg-green-900/20">Value</th>
              <th className="text-green-700 dark:text-green-300 bg-green-50/50 dark:bg-green-900/20">Count</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g, i) => (
              <tr key={i} className="hover:bg-green-50/30 dark:hover:bg-green-900/10 transition-colors">
                <td className="text-slate-700 dark:text-slate-300 font-medium">{g.group}</td>
                <td className="text-slate-700 dark:text-slate-300">
                  {typeof g.value === "number" ? g.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : g.value}
                </td>
                <td className="text-slate-500 dark:text-slate-400">{g.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ───────── Error Card ───────── */

const ErrorCard = ({ message }) => (
  <div className="my-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-800/40 flex items-start gap-3">
    <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
    <span className="text-sm text-red-700 dark:text-red-300">{message}</span>
  </div>
);

/* ───────── Chat Message (with step-by-step animation) ───────── */

const STEP_DELAY = 700;   // ms per step during animation
const REVEAL_DELAY = 400; // ms after last step before showing output

const ChatMessage = ({ msg, index }) => {
  const [copied, setCopied] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const isAI = msg.role === "assistant";
  const data = msg.data;

  // ── Animation state ──
  const [animPhase, setAnimPhase] = useState(null);  // null | "executing" | "done"
  const [stepIdx, setStepIdx] = useState(-1);
  const [revealOutput, setRevealOutput] = useState(false);
  const animIdRef = useRef(0);

  // Run animation on mount for AI messages with trace
  useEffect(() => {
    if (!isAI || !data?.trace || data.trace.length === 0 || data.answer_type === "error") {
      setRevealOutput(true);
      return;
    }

    const id = ++animIdRef.current;
    const traceLen = data.trace.length;
    setAnimPhase("executing");
    setStepIdx(-1);
    setRevealOutput(false);

    const timers = [];

    // Animate each step
    for (let i = 0; i < traceLen; i++) {
      timers.push(setTimeout(() => {
        if (animIdRef.current !== id) return; // cancelled
        setStepIdx(i);
      }, (i + 1) * STEP_DELAY));
    }

    // After all steps, reveal output
    timers.push(setTimeout(() => {
      if (animIdRef.current !== id) return;
      setAnimPhase("done");
      setRevealOutput(true);
    }, traceLen * STEP_DELAY + REVEAL_DELAY));

    return () => {
      animIdRef.current++;
      timers.forEach(clearTimeout);
    };
  }, []); // mount-only

  const handleCopy = () => {
    const text = data?.answer || msg.content || "";
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Skip animation instantly
  const skipAnimation = () => {
    animIdRef.current++;
    setAnimPhase("done");
    setStepIdx((data?.trace?.length ?? 1) - 1);
    setRevealOutput(true);
  };

  // ── Render the live execution plan animation ──
  const renderExecutingPlan = () => {
    if (!data?.trace || animPhase !== "executing") return null;
    const trace = data.trace;
    const total = trace.length;

    return (
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" style={{ animationDuration: "0.8s" }} />
            <span className="text-xs font-semibold text-teal-400 uppercase tracking-wide">Executing plan…</span>
          </div>
          <button onClick={skipAnimation} className="text-[10px] text-slate-500 hover:text-teal-400 transition-colors">
            Skip
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 rounded-full bg-slate-700/50 mb-3 overflow-hidden">
          <div
            className="h-full rounded-full bg-teal-400 transition-all duration-500 ease-out"
            style={{ width: `${((stepIdx + 1) / total) * 100}%` }}
          />
        </div>

        {/* Steps */}
        <div className="space-y-1.5">
          {trace.map((step, idx) => {
            const isActive = idx === stepIdx;
            const isDone = idx < stepIdx;
            const isPending = idx > stepIdx;

            return (
              <div
                key={idx}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono transition-all duration-300 ${isActive
                  ? "bg-teal-900/40 border border-teal-500/40 text-teal-300 shadow-sm shadow-teal-500/10"
                  : isDone
                    ? "bg-slate-800/60 text-slate-400"
                    : "bg-slate-800/20 text-slate-600"
                  }`}
                style={{
                  opacity: isPending ? 0.4 : 1,
                  transform: isActive ? "scale(1.01)" : "scale(1)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isActive ? "bg-teal-500 text-white" : isDone ? "bg-slate-600 text-slate-300" : "bg-slate-700 text-slate-500"
                    }`}>
                    {isDone ? "✓" : idx + 1}
                  </span>
                  <span className={isActive ? "text-teal-200 font-semibold" : ""}>{step.tool}</span>
                </div>
                {(isActive || isDone) && (
                  <span className="text-slate-500">
                    {step.rows_before} → {step.rows_after} · {step.ms}ms
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Step counter */}
        <div className="mt-2 text-[10px] text-slate-500 text-right">
          Step {Math.min(stepIdx + 1, total)}/{total}
        </div>
      </div>
    );
  };

  // ── Render final AI content ──
  const renderAIContent = () => {
    if (!data) return <span className="whitespace-pre-wrap">{msg.content}</span>;

    if (!data.ok || data.answer_type === "error") {
      return <ErrorCard message={data.answer} />;
    }

    if (data.answer_type === "aggregate") {
      return (
        <>
          <AggregateCard aggregate={data.aggregate} />
          <ToolsPipeline tools={data.tools_used} />
        </>
      );
    }

    if (data.answer_type === "group_aggregate") {
      return (
        <>
          <GroupTable groups={data.groups} answer={data.answer} />
          <ToolsPipeline tools={data.tools_used} />
        </>
      );
    }

    if (data.answer_type === "rows") {
      return (
        <>
          <div className="text-sm text-slate-600 dark:text-slate-300 mb-1">{data.answer}</div>
          <RowsTable rows={data.rows} />
          <ToolsPipeline tools={data.tools_used} />
        </>
      );
    }

    return <span className="whitespace-pre-wrap">{data.answer || msg.content}</span>;
  };

  return (
    <div className={`flex gap-3 ${isAI ? "" : "flex-row-reverse"} animate-stream`} style={{ animationDelay: `${index * 0.05}s` }}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1 ${isAI ? "bg-green-100 dark:bg-green-900/40" : "bg-slate-200 dark:bg-slate-700"
        }`}>
        {isAI ? <Bot size={14} className="text-green-600 dark:text-green-400" /> : <User size={14} className="text-slate-600 dark:text-slate-300" />}
      </div>
      <div className={`max-w-3xl ${isAI ? "" : "text-right"}`}>
        <div className={`inline-block rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${isAI
          ? "bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 shadow-sm border border-slate-200/50 dark:border-slate-700/40"
          : "bg-green-600 text-white"
          }`} style={isAI ? { borderLeft: "3px solid #22C55E" } : {}}>

          {/* Live execution animation */}
          {isAI && renderExecutingPlan()}

          {/* Final output with fade-in */}
          {isAI ? (
            <div
              style={{
                opacity: revealOutput ? 1 : 0,
                maxHeight: revealOutput ? "2000px" : "0px",
                overflow: "hidden",
                transition: "opacity 0.4s ease-out, max-height 0.5s ease-out",
              }}
            >
              {renderAIContent()}
            </div>
          ) : (
            <span className="whitespace-pre-wrap">{msg.content}</span>
          )}
        </div>

        {/* Action buttons (show after animation) */}
        {isAI && revealOutput && (
          <div className="flex items-center gap-3 mt-2 animate-fade-in" style={{ opacity: 0.6 }}>
            <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-slate-400 hover:text-green-500 transition-colors">
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
            {data?.trace && data.trace.length > 0 && (
              <button onClick={() => setShowTrace(!showTrace)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-teal-400 transition-colors">
                <Terminal size={12} />
                {showTrace ? "Hide trace" : "Show trace"}
              </button>
            )}
          </div>
        )}

        {/* Expandable trace detail */}
        {showTrace && data?.trace && (
          <div className="mt-3 p-4 rounded-xl bg-slate-800 dark:bg-slate-900 border border-slate-700/60 text-xs animate-fade-in max-w-3xl">
            <div className="flex items-center gap-2 mb-3">
              <Terminal size={13} className="text-teal-400" />
              <span className="font-semibold text-teal-300 uppercase tracking-wide text-[11px]">Execution Trace</span>
            </div>
            {data.trace.map((step, idx) => (
              <div key={idx} className="mb-2 pb-2 border-b border-slate-700/50 last:border-0 last:mb-0 last:pb-0">
                <div className="text-white font-medium">Step {idx + 1}: <span className="text-teal-300">{step.tool}</span></div>
                <div className="text-slate-400 mt-0.5">Rows: {step.rows_before} → {step.rows_after}</div>
                <div className="text-slate-500">{step.ms}ms</div>
              </div>
            ))}
            <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-1">
              {data.confidence !== undefined && (
                <div className="text-slate-400">Confidence: <span className={`font-medium ${data.confidence >= 0.8 ? "text-green-400" : data.confidence >= 0.5 ? "text-yellow-400" : "text-red-400"}`}>{Math.round(data.confidence * 100)}%</span></div>
              )}
              {data.ms_total !== undefined && (
                <div className="text-slate-500">Total time: {data.ms_total}ms</div>
              )}
              {data.debug_id && (
                <div className="text-slate-600 font-mono">Debug ID: {data.debug_id}</div>
              )}
            </div>
            {data.plan && (
              <div className="mt-3 pt-3 border-t border-slate-700/50">
                <button onClick={() => setShowPlan(!showPlan)} className="flex items-center gap-1 text-slate-400 hover:text-teal-300 transition-colors text-[11px]">
                  {showPlan ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  {showPlan ? "Hide plan JSON" : "Show plan JSON"}
                </button>
                {showPlan && (
                  <pre className="mt-2 bg-slate-900 dark:bg-slate-950 p-3 rounded-lg overflow-x-auto text-slate-400 text-[11px] leading-relaxed">
                    {JSON.stringify(data.plan, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ───────── Typing Indicator ───────── */

const TypingIndicator = () => (
  <div className="flex gap-3 animate-stream">
    <div className="w-8 h-8 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
      <Bot size={14} className="text-green-600 dark:text-green-400" />
    </div>
    <div className="bg-white dark:bg-slate-800/80 rounded-2xl px-5 py-4 border border-slate-200/50 dark:border-slate-700/40" style={{ borderLeft: "3px solid #22C55E" }}>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-2 h-2 rounded-full bg-green-400 dark:bg-green-500" style={{ animation: "typing 1.4s infinite", animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  </div>
);

/* ───────── Suggested Questions ───────── */

const SUGGESTIONS = [
  "Show all electronics",
  "What's the average price?",
  "Which category has the most items?",
  "What products should I restock?",
  "Show low stock items sorted by rating",
  "How many products are out of stock?",
];

/* ───────── Chat Page ───────── */

export const ChatPage = ({ dark, setDark, setPage, datasetId }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [lastMeta, setLastMeta] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const askAgent = async (question) => {
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setIsTyping(true);

    try {
      const res = await fetch(`${API_BASE}/agent/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, dataset_id: datasetId }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error (${res.status}): ${text || res.statusText}`);
      }

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(`Unexpected response format: ${text.slice(0, 100)}...`);
      }

      const data = await res.json();
      setLastMeta(data);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer || "No response.", data },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Failed to reach the server.",
          data: { ok: false, answer_type: "error", answer: `Connection error: ${err.message}`, tools_used: [] },
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() || isTyping) return;
    askAgent(input.trim());
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 transition-theme overflow-hidden">
      <AnimatedBackground variant="dashboard" />
      <Sidebar page="chat" setPage={setPage} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader dark={dark} setDark={setDark} title="AI Agent" />
        <div className="flex-1 flex overflow-hidden">
          {/* Chat area */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto space-y-6">
                {messages.length === 0 && (
                  <div className="text-center py-16 animate-fade-in">
                    <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                      <Sparkles size={28} className="text-green-500" />
                    </div>
                    <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white mb-2">Ask anything about your data</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-8">Your Google Sheet is connected. Try a question below.</p>
                    <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
                      {SUGGESTIONS.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => askAgent(q)}
                          className="px-4 py-2 rounded-xl text-sm bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/40 hover:border-green-300 dark:hover:border-green-700 hover:text-green-600 dark:hover:text-green-400 transition-all hover:shadow-sm"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <ChatMessage key={i} msg={msg} index={i} />
                ))}
                {isTyping && <TypingIndicator />}
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-200/60 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Ask about your spreadsheet data..."
                      rows={1}
                      className="w-full px-5 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 border border-slate-200/60 dark:border-slate-700/40 green-focus resize-none transition-all"
                      style={{ minHeight: "48px", maxHeight: "120px" }}
                    />
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={isTyping}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 ${input.trim() && !isTyping
                      ? "bg-green-500 text-white shadow-lg shadow-green-500/30 hover:bg-green-400 active:scale-95"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-400"
                      }`}
                  >
                    <Send size={18} />
                  </button>
                </div>
                <div className="flex items-center gap-4 mt-2 px-2">
                  <span className="text-xs text-slate-400">Connected: {datasetId ? "Uploaded Dataset" : "Google Sheets"}</span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs text-slate-400">Model: GPT-4o-mini</span>
                </div>
              </div>
            </div>
          </div>

          {/* Side panel — live metadata */}
          <div className="hidden xl:block w-80 border-l border-slate-200/60 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 overflow-y-auto p-4">
            <div className="flex items-center gap-2 mb-4">
              <History size={14} className="text-green-500" />
              <span className="text-xs font-semibold text-slate-900 dark:text-white">Query Metadata</span>
            </div>

            {lastMeta ? (
              <div className="space-y-3 animate-fade-in">
                {/* Debug ID + Latency */}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{lastMeta.debug_id || "—"}</span>
                  {lastMeta.ms_total !== undefined && (
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{lastMeta.ms_total}ms</span>
                  )}
                </div>

                {/* Answer type */}
                <MetaRow label="Answer Type" value={lastMeta.answer_type || "—"} />

                {/* Confidence */}
                {lastMeta.confidence !== undefined && (
                  <div className="py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Confidence</span>
                      <span className={`text-xs font-bold ${lastMeta.confidence >= 0.8 ? "text-green-500" : lastMeta.confidence >= 0.5 ? "text-yellow-500" : "text-red-500"}`}>
                        {Math.round(lastMeta.confidence * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${lastMeta.confidence >= 0.8 ? "bg-green-500" : lastMeta.confidence >= 0.5 ? "bg-yellow-500" : "bg-red-500"}`}
                        style={{ width: `${lastMeta.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Tools used */}
                <div className="py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">Pipeline</div>
                  {lastMeta.tools_used && lastMeta.tools_used.length > 0 ? (
                    <div className="flex items-center gap-1 flex-wrap">
                      {lastMeta.tools_used.map((t, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <span className="px-2 py-0.5 rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-[10px] font-semibold uppercase">
                            {t}
                          </span>
                          {i < lastMeta.tools_used.length - 1 && <ArrowRight size={8} className="text-green-400" />}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </div>

                {/* Rows */}
                {lastMeta.total !== undefined && <MetaRow label="Matching Rows" value={lastMeta.total} />}

                {/* Status */}
                <MetaRow label="Status" value={lastMeta.ok ? "✓ Success" : "✗ Error"} highlight={lastMeta.ok} />

                {/* Repair / Attempts */}
                {lastMeta.attempts > 1 && (
                  <MetaRow label="Attempts" value={lastMeta.attempts} />
                )}
                {lastMeta.repaired && (
                  <div className="py-2 px-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200/60 dark:border-yellow-800/40">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">⚡ Self-repaired</span>
                    </div>
                    {lastMeta.repair_reason && (
                      <div className="text-[10px] text-yellow-500/80 dark:text-yellow-500/60 mt-1 truncate" title={lastMeta.repair_reason}>
                        {lastMeta.repair_reason}
                      </div>
                    )}
                  </div>
                )}

                {/* Execution Trace */}
                {lastMeta.trace && lastMeta.trace.length > 0 && (
                  <div className="py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">Execution Trace</div>
                    <div className="space-y-1">
                      {lastMeta.trace.map((t, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px] font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                          <span className="text-slate-600 dark:text-slate-400">{t.tool}</span>
                          <span className="text-slate-400 dark:text-slate-500">
                            {t.rows_before}→{t.rows_after} · {t.ms}ms
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Plan steps */}
                {lastMeta.plan?.steps && (
                  <div className="py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">Plan Steps</div>
                    <div className="space-y-1">
                      {lastMeta.plan.steps.map((step, i) => (
                        <div key={i} className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                          {i + 1}. {step.tool}({Object.keys(step.args || {}).join(", ")})
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            ) : (
              <div className="text-center py-12">
                <Table size={24} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-xs text-slate-400 dark:text-slate-500">Ask a question to see metadata</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ───────── Meta Row Helper ───────── */

const MetaRow = ({ label, value, highlight }) => (
  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
    <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
    <span className={`text-xs font-medium ${highlight === false ? "text-red-500" : highlight ? "text-green-500" : "text-slate-700 dark:text-slate-300"}`}>
      {value}
    </span>
  </div>
);
