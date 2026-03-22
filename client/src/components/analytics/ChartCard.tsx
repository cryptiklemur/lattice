import type { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function ChartCard({ title, children, className, action }: ChartCardProps) {
  return (
    <div className={["rounded-xl border border-base-content/8 bg-base-300/50 p-4", className].filter(Boolean).join(" ")}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-base-content/35">
          {title}
        </span>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  );
}
