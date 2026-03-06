import {
  Sparkles, Play, FileSpreadsheet, MessageSquare, Zap, Shield,
  Layers, TrendingUp, Globe, Database, Star, Check, Bot, Send,
  LayoutGrid, Twitter, Github, Linkedin,
} from "lucide-react";
import { GreenButton, Card, Badge, SectionHeading } from "../components/ui/index.jsx";
import { AnimatedBackground } from "../components/AnimatedBackground.jsx";
import { FloatingCells } from "../components/FloatingCells.jsx";
import { TESTIMONIALS } from "../data/constants.js";

/* ───────── Hero ───────── */

const HeroSection = ({ setPage }) => (
  <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
    <FloatingCells />
    <div className="max-w-7xl mx-auto px-6 py-20 text-center relative z-10">
      <div className="animate-fade-in-up">
        <Badge className="mb-6">
          <Sparkles size={12} /> Now with GPT-4o & Gemini Support
        </Badge>
      </div>

      <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold text-slate-900 dark:text-white leading-tight mb-8 animate-fade-in-up delay-100">
        Talk to your<br />
        <span className="bg-gradient-to-r from-green-600 via-emerald-500 to-teal-500 bg-clip-text text-transparent animate-gradient">
          spreadsheets
        </span>
        <br />like a human.
      </h1>

      <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-10 animate-fade-in-up delay-200 leading-relaxed">
        SheetSearch AI uses retrieval-augmented generation to understand your Google Sheets data.
        Ask questions in plain English, get instant insights with source references.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-300">
        <GreenButton size="lg" onClick={() => setPage("chat")}>
          <Play size={18} /> Try Demo
        </GreenButton>
        <GreenButton variant="outline" size="lg" onClick={() => setPage("dashboard")}>
          <FileSpreadsheet size={18} /> Connect Google Sheets
        </GreenButton>
      </div>

      {/* Hero Preview */}
      <div className="mt-20 animate-fade-in-up delay-500">
        <Card className="max-w-4xl mx-auto p-1 overflow-hidden gradient-border" glow>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-4 md:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-800 flex items-center px-3">
                <span className="text-xs text-slate-400 font-mono">sheetsearch.ai/dashboard</span>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 bg-white dark:bg-slate-800/80 rounded-xl p-4 border border-slate-200/60 dark:border-slate-700/40">
                <div className="flex items-center gap-2 mb-3">
                  <Bot size={16} className="text-green-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">SheetSearch AI</span>
                </div>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot size={12} className="text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-left">
                    Based on your Q4 data, <strong className="text-green-600 dark:text-green-400">API Access</strong> grew 67% — the fastest-growing product. It could become your #2 revenue source by Q2.
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <div className="flex-1 h-9 rounded-lg bg-slate-100 dark:bg-slate-700/50 flex items-center px-3">
                    <span className="text-xs text-slate-400">Ask about your data...</span>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-green-500 flex items-center justify-center">
                    <Send size={14} className="text-white" />
                  </div>
                </div>
              </div>
              <div className="hidden md:block w-64 bg-white dark:bg-slate-800/80 rounded-xl p-3 border border-slate-200/60 dark:border-slate-700/40">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Q4 Sales Data.xlsx</div>
                <div className="space-y-0.5">
                  {["Product", "Pro Plan", "Enterprise", "Team"].map((r, i) => (
                    <div key={i} className="flex gap-0.5">
                      {[r, i === 0 ? "Revenue" : `$${(Math.random() * 200 + 50).toFixed(0)}K`, i === 0 ? "Growth" : `+${(Math.random() * 50 + 5).toFixed(0)}%`].map((c, j) => (
                        <div
                          key={j}
                          className={`flex-1 px-2 py-1.5 text-xs rounded ${i === 0
                              ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium"
                              : "bg-slate-50 dark:bg-slate-700/30 text-slate-600 dark:text-slate-400"
                            }`}
                          style={{ animation: `cell-appear 0.3s ease-out both`, animationDelay: `${(i * 3 + j) * 0.05}s` }}
                        >
                          {c}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </section>
);

/* ───────── How It Works ───────── */

const HowItWorks = () => {
  const steps = [
    { icon: FileSpreadsheet, title: "Connect Your Sheets", desc: "Link your Google Sheets with one click. We index every cell, formula, and relationship.", num: "01" },
    { icon: MessageSquare, title: "Ask Questions", desc: "Type natural language queries. Our RAG engine retrieves the most relevant data.", num: "02" },
    { icon: Sparkles, title: "Get AI Insights", desc: "Receive accurate, sourced answers with tables, charts, and actionable recommendations.", num: "03" },
  ];
  return (
    <section className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <SectionHeading badge="How it works" title="Three steps to data clarity" subtitle="From spreadsheet chaos to AI-powered insights in under 60 seconds." />
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((s, i) => (
            <Card key={i} className="p-8 animate-fade-in-up" style={{ animationDelay: `${(i + 1) * 0.2}s` }}>
              <div className="flex items-center justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <s.icon size={24} className="text-green-600 dark:text-green-400" />
                </div>
                <span className="font-display text-4xl font-bold text-green-100 dark:text-green-900/50">{s.num}</span>
              </div>
              <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-white mb-3">{s.title}</h3>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">{s.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ───────── Features ───────── */

const FeaturesGrid = () => {
  const features = [
    { icon: Zap, title: "Instant RAG Retrieval", desc: "Sub-second queries across millions of cells using vector embeddings." },
    { icon: Shield, title: "Enterprise Security", desc: "SOC2 compliant. Your data never leaves your cloud environment." },
    { icon: Layers, title: "Multi-Sheet Context", desc: "Cross-reference data across unlimited linked spreadsheets." },
    { icon: TrendingUp, title: "Trend Detection", desc: "AI automatically surfaces anomalies, trends, and insights." },
    { icon: Globe, title: "40+ Languages", desc: "Ask questions in any language. Answers match your locale." },
    { icon: Database, title: "Smart Caching", desc: "Frequently asked queries are cached for instant responses." },
  ];
  return (
    <section className="py-24 px-6 bg-slate-50/50 dark:bg-slate-900/50">
      <div className="max-w-7xl mx-auto">
        <SectionHeading badge="Features" title="Built for power users" subtitle="Everything you need to turn spreadsheets into a conversational knowledge base." />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <Card key={i} className="p-6 group animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4 group-hover:bg-green-500 group-hover:shadow-lg group-hover:shadow-green-500/20 transition-all duration-300">
                <f.icon size={20} className="text-green-600 dark:text-green-400 group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white mb-2">{f.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{f.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ───────── Testimonials ───────── */

const TestimonialsSection = () => (
  <section className="py-24 px-6">
    <div className="max-w-7xl mx-auto">
      <SectionHeading badge="Loved by teams" title="What our users say" subtitle="Join thousands of teams using SheetSearch AI daily." />
      <div className="grid md:grid-cols-3 gap-8">
        {TESTIMONIALS.map((t, i) => (
          <Card key={i} className="p-8 animate-fade-in-up" style={{ animationDelay: `${(i + 1) * 0.2}s` }}>
            <div className="flex gap-1 mb-4">
              {[...Array(5)].map((_, j) => (
                <Star key={j} size={16} className="fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed italic">"{t.text}"</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                {t.avatar}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">{t.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{t.role}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  </section>
);

/* ───────── Pricing ───────── */

const PricingSection = () => {
  const plans = [
    { name: "Starter", price: "0", desc: "For personal projects", features: ["5 sheets connected", "100 queries/month", "Basic AI model", "Email support"], cta: "Get Started Free" },
    { name: "Pro", price: "29", desc: "For growing teams", features: ["Unlimited sheets", "5,000 queries/month", "GPT-4o & Gemini", "Priority support", "API access", "Team sharing"], cta: "Start Pro Trial", popular: true },
    { name: "Enterprise", price: "Custom", desc: "For organizations", features: ["Everything in Pro", "Unlimited queries", "Custom models", "SSO & SAML", "Dedicated support", "SLA guarantee", "On-premise option"], cta: "Contact Sales" },
  ];
  return (
    <section className="py-24 px-6 bg-slate-50/50 dark:bg-slate-900/50">
      <div className="max-w-7xl mx-auto">
        <SectionHeading badge="Pricing" title="Simple, transparent pricing" subtitle="Start free. Upgrade when you need more power." />
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((p, i) => (
            <Card key={i} className={`p-8 relative animate-fade-in-up ${p.popular ? "ring-2 ring-green-500 dark:ring-green-400" : ""}`} glow={p.popular} style={{ animationDelay: `${(i + 1) * 0.2}s` }}>
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge>Most Popular</Badge>
                </div>
              )}
              <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-white mb-1">{p.name}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{p.desc}</p>
              <div className="mb-6">
                {p.price === "Custom" ? (
                  <span className="font-display text-4xl font-bold text-slate-900 dark:text-white">Custom</span>
                ) : (
                  <>
                    <span className="font-display text-4xl font-bold text-slate-900 dark:text-white">${p.price}</span>
                    <span className="text-slate-500 dark:text-slate-400 text-sm">/month</span>
                  </>
                )}
              </div>
              <ul className="space-y-3 mb-8">
                {p.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <Check size={16} className="text-green-500 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <GreenButton variant={p.popular ? "solid" : "outline"} className="w-full">
                {p.cta}
              </GreenButton>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ───────── Footer ───────── */

const Footer = () => (
  <footer className="py-16 px-6 border-t border-slate-200/60 dark:border-slate-800">
    <div className="max-w-7xl mx-auto">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <LayoutGrid size={16} className="text-white" />
            </div>
            <span className="font-display font-bold text-lg text-slate-900 dark:text-white">SheetSearch</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            AI-powered answers from your spreadsheet data. Built for teams that live in Google Sheets.
          </p>
        </div>
        {[
          { title: "Product", links: ["Features", "Pricing", "API Docs", "Changelog"] },
          { title: "Company", links: ["About", "Blog", "Careers", "Contact"] },
          { title: "Legal", links: ["Privacy", "Terms", "Security", "GDPR"] },
        ].map((col, i) => (
          <div key={i}>
            <h4 className="font-display font-semibold text-slate-900 dark:text-white mb-4">{col.title}</h4>
            <ul className="space-y-2">
              {col.links.map((link, j) => (
                <li key={j}>
                  <a href="#" className="text-sm text-slate-500 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-400 transition-colors">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-between pt-8 border-t border-slate-200/60 dark:border-slate-800">
        <p className="text-sm text-slate-500 dark:text-slate-400">&copy; 2026 SheetSearch AI. All rights reserved.</p>
        <div className="flex items-center gap-4 mt-4 sm:mt-0">
          {[Twitter, Github, Linkedin].map((Icon, i) => (
            <a key={i} href="#" className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all">
              <Icon size={18} />
            </a>
          ))}
        </div>
      </div>
    </div>
  </footer>
);

/* ───────── Page Export ───────── */

export const LandingPage = ({ setPage }) => (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-theme">
    <AnimatedBackground variant="landing" />
    <HeroSection setPage={setPage} />
    <HowItWorks />
    <FeaturesGrid />
    <TestimonialsSection />
    <PricingSection />
    <Footer />
  </div>
);
