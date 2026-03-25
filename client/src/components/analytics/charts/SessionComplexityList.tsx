import { getScoreColor } from "../chartTokens";

interface SessionComplexityListProps {
  data: Array<{ id: string; title: string; score: number; messages: number; tools: number; contextPercent: number }>;
}

export function SessionComplexityList({ data }: SessionComplexityListProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-base-content/25 font-mono text-[11px]">
        No session data
      </div>
    );
  }

  const maxScore = data.length > 0 ? data[0].score : 1;

  return (
    <div className="overflow-x-auto">
    <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto min-w-[370px]">
      <div className="grid grid-cols-[2.5rem_1fr_4rem_3rem_3rem_3.5rem] gap-2 px-2 py-1 text-[10px] font-mono text-base-content/30 uppercase tracking-wider">
        <span>Rank</span>
        <span>Session</span>
        <span className="text-right">Score</span>
        <span className="text-right">Msgs</span>
        <span className="text-right">Tools</span>
        <span className="text-right">Ctx%</span>
      </div>
      {data.map(function (entry, index) {
        return (
          <div
            key={entry.id}
            className="grid grid-cols-[2.5rem_1fr_4rem_3rem_3rem_3.5rem] gap-2 px-2 py-1.5 rounded hover:bg-base-content/[0.03] transition-colors"
          >
            <span className="font-mono text-[11px] text-base-content/40 font-bold tabular-nums">
              #{index + 1}
            </span>
            <span className="font-mono text-[11px] text-base-content/70 truncate" title={entry.title}>
              {entry.title}
            </span>
            <span className="text-right">
              <span
                className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-white/90 tabular-nums"
                style={{ background: getScoreColor(entry.score, maxScore) }}
              >
                {entry.score}
              </span>
            </span>
            <span className="text-right font-mono text-[10px] text-base-content/50 tabular-nums self-center">
              {entry.messages}
            </span>
            <span className="text-right font-mono text-[10px] text-base-content/50 tabular-nums self-center">
              {entry.tools}
            </span>
            <span className="text-right font-mono text-[10px] text-base-content/50 tabular-nums self-center">
              {entry.contextPercent}%
            </span>
          </div>
        );
      })}
    </div>
    </div>
  );
}
