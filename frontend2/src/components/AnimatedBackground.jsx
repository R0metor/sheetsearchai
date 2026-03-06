export const AnimatedBackground = ({ variant = "landing" }) => {
  if (variant === "landing") {
    return (
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]">
          <div
            className="animate-grid"
            style={{
              width: "200%",
              height: "200%",
              backgroundImage:
                "linear-gradient(#22C55E 1px, transparent 1px), linear-gradient(90deg, #22C55E 1px, transparent 1px)",
              backgroundSize: "80px 80px",
            }}
          />
        </div>
        <div className="absolute top-20 -left-40 w-96 h-96 bg-green-400/20 dark:bg-green-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute top-60 right-0 w-80 h-80 bg-emerald-300/15 dark:bg-emerald-500/8 rounded-full blur-3xl animate-float2" />
        <div className="absolute bottom-40 left-1/3 w-72 h-72 bg-green-500/10 dark:bg-green-400/5 rounded-full blur-3xl animate-glow" />
        <div
          className="absolute top-1/2 right-1/4 w-64 h-64 bg-teal-300/10 dark:bg-teal-500/5 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "2s" }}
        />
      </div>
    );
  }
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      <div className="absolute top-0 right-0 w-96 h-96 bg-green-500/5 dark:bg-green-500/8 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/5 dark:bg-emerald-500/5 rounded-full blur-3xl" />
    </div>
  );
};
