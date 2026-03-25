import { getChartColors } from "../chartTokens";

interface DailySummaryDatum {
  date: string;
  sessions: number;
  cost: number;
  tokens: number;
  topTool: string;
  modelMix: Record<string, number>;
}

interface DailySummaryCardsProps {
  data: DailySummaryDatum[];
}

function formatCardDate(dateStr: string): string {
  var d = new Date(dateStr + "T00:00:00");
  var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[d.getDay()] + " " + (d.getMonth() + 1) + "/" + d.getDate();
}

export function DailySummaryCards({ data }: DailySummaryCardsProps) {
  var colors = getChartColors();
  var MODEL_COLORS: Record<string, string> = {
    opus: colors.model.opus,
    sonnet: colors.model.sonnet,
    haiku: colors.model.haiku,
    other: colors.model.other,
  };
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[100px] text-base-content/25 font-mono text-[11px]">
        No data for this period
      </div>
    );
  }

  var reversed = data.slice().reverse();

  return (
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-thin">
      {reversed.map(function (d) {
        var mixEntries = Object.entries(d.modelMix);

        return (
          <div
            key={d.date}
            className="flex-shrink-0 snap-start rounded-lg bg-base-300 border border-base-content/5 px-3 py-2.5 w-[140px]"
          >
            <p className="text-[11px] font-mono font-bold text-base-content/60 mb-1.5">
              {formatCardDate(d.date)}
            </p>

            <div className="text-[10px] font-mono text-base-content/50 space-y-0.5">
              <p><span className="text-base-content/30">sessions </span>{d.sessions}</p>
              <p><span className="text-base-content/30">cost </span>${d.cost.toFixed(2)}</p>
              {d.topTool && (
                <p className="truncate"><span className="text-base-content/30">tool </span>{d.topTool}</p>
              )}
            </div>

            {mixEntries.length > 0 && (
              <div className="mt-2 h-[4px] rounded-full overflow-hidden flex bg-base-content/5">
                {mixEntries.map(function (entry) {
                  var model = entry[0];
                  var pct = entry[1];
                  if (pct <= 0) return null;
                  return (
                    <div
                      key={model}
                      style={{
                        width: (pct * 100) + "%",
                        backgroundColor: MODEL_COLORS[model] || MODEL_COLORS.other,
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
