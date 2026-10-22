import { HistoryDrop } from "@/components/history-drop";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { evaluateActiveHistory } from "@sponsor-engine/core";
import { readyDb } from "@/lib/request";

export async function AccuracyPanel() {
  const report = evaluateActiveHistory(await readyDb());
  const rows = [
    ...report.scores.map((score) => ({
      name: modelLabel(score.model),
      mae: score.maeGbp,
      mape: score.mapePercent,
    })),
    {
      name: "Median baseline",
      mae: report.baselineMedian.maeGbp,
      mape: report.baselineMedian.mapePercent,
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Accuracy</CardTitle>
        <CardDescription>
          Held-out check on the later {report.testCount} of {report.historyCount} bookings. These figures are calculated now.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left text-[16px] leading-6">
            <thead className="font-mono text-[12px] tracking-[0.08em] text-muted-foreground uppercase">
              <tr>
                <th className="py-2 pr-4 font-normal">Method</th>
                <th className="py-2 pr-4 font-normal">MAE</th>
                <th className="py-2 font-normal">MAPE</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name} className="border-t border-border">
                  <td className="py-3 pr-4">{row.name}</td>
                  <td className="py-3 pr-4">{pounds(row.mae)}</td>
                  <td className="py-3">{percent(row.mape)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          {modelLabel(report.winner)} has the lower error on the held-out rows. The median is only a baseline.
        </p>
        <p className="text-muted-foreground">{report.label} MAPE skips prices of £0.</p>
        <HistoryDrop />
      </CardContent>
    </Card>
  );
}

function modelLabel(model: string): string {
  if (model === "knn-rules") return "Nearest bookings";
  if (model === "gbdt") return "Gradient boosted trees";
  return model;
}

function pounds(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function percent(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return `${value.toFixed(1)}%`;
}
