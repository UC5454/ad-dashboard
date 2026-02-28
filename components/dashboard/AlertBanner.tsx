import Link from "next/link";
import { type AlertItem } from "@/components/dashboard/types";

function dotClass(type: AlertItem["type"]): string {
  if (type === "critical") return "bg-red-500";
  if (type === "warning") return "bg-amber-500";
  return "bg-blue-500";
}

export default function AlertBanner({
  alerts,
  slackEnabled,
}: {
  alerts: AlertItem[];
  slackEnabled: boolean;
}) {
  if (alerts.length === 0) return null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-navy">アラート</h3>
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">{alerts.length}</span>
          {slackEnabled && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Slack通知ON
            </span>
          )}
        </div>
        <Link href="/dashboard/alerts" className="text-xs text-blue hover:text-blue-light hover:underline">
          全て見る →
        </Link>
      </div>
      <div className="space-y-2">
        {alerts.slice(0, 3).map((alert) => (
          <div key={alert.id} className="flex items-start gap-2 text-sm">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass(alert.type)}`} />
            <div className="min-w-0">
              <span className="font-medium text-navy">{alert.title}</span>
              {alert.projectName && <span className="text-gray-500"> / {alert.projectName}</span>}
            </div>
          </div>
        ))}
      </div>
      {alerts.length > 3 && (
        <Link href="/dashboard/alerts" className="mt-2 block text-xs text-gray-500 hover:text-blue">
          他 {alerts.length - 3} 件のアラート →
        </Link>
      )}
    </section>
  );
}
