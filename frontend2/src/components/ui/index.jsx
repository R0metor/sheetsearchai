import { Sparkles } from "lucide-react";

export const GreenButton = ({
  children,
  variant = "solid",
  size = "md",
  onClick,
  className = "",
}) => {
  const base =
    "relative overflow-hidden font-display font-medium rounded-xl transition-all duration-300 inline-flex items-center justify-center gap-2 cursor-pointer";
  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-sm",
    lg: "px-8 py-4 text-base",
  };
  const variants = {
    solid:
      "bg-green-600 text-white hover:bg-green-500 hover:shadow-lg hover:shadow-green-500/20 active:scale-95",
    outline:
      "border-2 border-green-500/30 text-green-600 dark:text-green-400 hover:bg-green-500/10 hover:border-green-500/60 active:scale-95",
    ghost: "text-green-600 dark:text-green-400 hover:bg-green-500/10 active:scale-95",
  };
  return (
    <button
      onClick={onClick}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

export const Card = ({
  children,
  className = "",
  glow = false,
  hover = true,
  style,
}) => (
  <div
    className={`
      rounded-2xl border transition-theme
      bg-white/70 dark:bg-slate-800/50
      border-slate-200/60 dark:border-slate-700/50
      backdrop-blur-sm
      ${glow ? "green-glow" : ""}
      ${hover ? "hover-lift" : ""}
      ${className}
    `}
    style={style}
  >
    {children}
  </div>
);

export const Badge = ({ children, className = "" }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
    bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 ${className}`}
  >
    {children}
  </span>
);

export const SectionHeading = ({ badge, title, subtitle }) => (
  <div className="text-center mb-16 animate-fade-in-up">
    {badge && <Badge className="mb-4">{badge}</Badge>}
    <h2 className="font-display text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
      {title}
    </h2>
    {subtitle && (
      <p className="text-slate-500 dark:text-slate-400 text-lg max-w-2xl mx-auto">
        {subtitle}
      </p>
    )}
  </div>
);
