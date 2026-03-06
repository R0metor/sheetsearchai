export const FloatingCells = () => {
  const cells = [
    { x: "10%", y: "20%", val: "$284K", delay: "0s", dur: "7s" },
    { x: "75%", y: "15%", val: "+23%", delay: "1s", dur: "6s" },
    { x: "85%", y: "45%", val: "1,240", delay: "2s", dur: "8s" },
    { x: "20%", y: "60%", val: "Q4", delay: "0.5s", dur: "5s" },
    { x: "60%", y: "70%", val: "=SUM", delay: "1.5s", dur: "7s" },
    { x: "40%", y: "25%", val: "#REF", delay: "3s", dur: "6s" },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {cells.map((c, i) => (
        <div
          key={i}
          className="absolute font-mono text-xs px-3 py-1.5 rounded-lg
            bg-white/40 dark:bg-slate-800/40 border border-green-200/30 dark:border-green-800/30
            text-green-700 dark:text-green-400 backdrop-blur-sm"
          style={{
            left: c.x,
            top: c.y,
            animation: `float ${c.dur} ease-in-out infinite`,
            animationDelay: c.delay,
            opacity: 0.6,
          }}
        >
          {c.val}
        </div>
      ))}
    </div>
  );
};
