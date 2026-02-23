"use client";

import { useEffect, useMemo, useState } from "react";

interface AlertItem {
  id: number;
  client_name: string | null;
  platform: string | null;
  metric: string;
  severity: "warning" | "critical";
  current_value: number | null;
  moving_avg: number | null;
  deviation_pct: number | null;
  message: string | null;
  notified_at: string;
  resolved_at: string | null;
}

function fmtNumber(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "-";
  return value.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
}

function fmtPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [severity, setSeverity] = useState<"all" | "warning" | "critical">("all");
  const [unresolvedOnly, setUnresolvedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      const query = new URLSearchParams({ limit: "100" });
      if (severity !== "all") {
        query.set("severity", severity);
      }

      const res = await fetch(`/api/alerts?${query.toString()}`);
      const data = (await res.json()) as AlertItem[];
      if (mounted) {
        setAlerts(Array.isArray(data) ? data : []);
        setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [severity]);

  const filteredAlerts = useMemo(() => {
    if (!unresolvedOnly) return alerts;
    return alerts.filter((a) => !a.resolved_at);
  }, [alerts, unresolvedOnly]);

  const handleResolve = async (id: number) => {
    setPendingId(id);
    const res = await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (res.ok) {
      setAlerts((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                resolved_at: new Date().toISOString(),
              }
            : item
        )
      );
    }
    setPendingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-navy">アラート履歴</h2>
          <p className="mt-1 text-sm text-gray-500">異常検知の履歴を確認できます</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200 flex flex-wrap items-center gap-4">
        <label className="text-sm text-gray-700">
          重要度
          <select
            className="ml-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as "all" | "warning" | "critical")}
          >
            <option value="all">全て</option>
            <option value="warning">warning</option>
            <option value="critical">critical</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={unresolvedOnly}
            onChange={(e) => setUnresolvedOnly(e.target.checked)}
          />
          未解決のみ
        </label>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const severityClass =
              alert.severity === "critical"
                ? "border-l-4 border-red-400 bg-red-50"
                : "border-l-4 border-yellow-400 bg-yellow-50";
            return (
              <article
                key={alert.id}
                className={`rounded-xl p-4 shadow-sm ${severityClass} ${alert.resolved_at ? "opacity-50" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className={`text-sm font-semibold text-navy ${alert.resolved_at ? "line-through" : ""}`}>
                      {alert.message || "アラート"}
                    </p>
                    <p className="text-xs text-gray-600">
                      クライアント: {alert.client_name || "-"} / 媒体: {alert.platform || "-"}
                    </p>
                    <p className="text-xs text-gray-600">
                      指標: {alert.metric} / 現在値: {fmtNumber(alert.current_value)} / 移動平均: {fmtNumber(alert.moving_avg)} / 乖離率: {fmtPercent(alert.deviation_pct)}
                    </p>
                    <p className="text-xs text-gray-500">
                      通知日時: {new Date(alert.notified_at).toLocaleString("ja-JP")}
                    </p>
                  </div>
                  {!alert.resolved_at && (
                    <button
                      type="button"
                      className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-gray-700 border border-gray-200 hover:bg-gray-100"
                      disabled={pendingId === alert.id}
                      onClick={() => handleResolve(alert.id)}
                    >
                      {pendingId === alert.id ? "処理中..." : "解決済みにする"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}

          {filteredAlerts.length === 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
              表示対象のアラートはありません
            </div>
          )}
        </div>
      )}
    </div>
  );
}
