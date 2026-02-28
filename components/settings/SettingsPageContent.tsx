"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type FeeCalcMethod, type SlackConfig } from "@/lib/settings";

function percentValue(rate: number): string {
  return Number.isFinite(rate) ? String(Math.round(rate * 1000) / 10) : "";
}

function parseNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function SettingsPageContent() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  const [defaultFeeRate, setDefaultFeeRate] = useState(DEFAULT_SETTINGS.defaultFeeRate);
  const [feeCalcMethod, setFeeCalcMethod] = useState<FeeCalcMethod>(DEFAULT_SETTINGS.feeCalcMethod);
  const [slack, setSlack] = useState<SlackConfig>(DEFAULT_SETTINGS.slack);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  useEffect(() => {
    const settings = loadSettings();
    setDefaultFeeRate(settings.defaultFeeRate);
    setFeeCalcMethod(settings.feeCalcMethod);
    setSlack(settings.slack);
  }, []);

  const canEdit = useMemo(() => role === "admin" || role === "editor", [role]);

  const onSave = () => {
    setSaving(true);
    const prev = loadSettings();
    saveSettings({ ...prev, defaultFeeRate, feeCalcMethod, slack });
    setMessage("保存しました");
    setTimeout(() => setMessage(""), 1800);
    setSaving(false);
  };

  const onTestSlack = async () => {
    setTestResult(null);
    try {
      const res = await fetch("/api/slack-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: slack.webhookUrl }),
      });
      const result = (await res.json()) as { ok: boolean; error?: string };
      setTestResult(result);
    } catch {
      setTestResult({ ok: false, error: "通信エラー" });
    }
  };

  if (!canEdit) {
    return <p className="rounded-xl bg-white p-6 text-sm text-gray-600 shadow-sm">権限がありません</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-bold text-navy">設定</h2>
        <p className="mt-1 text-sm text-gray-500">手数料方式とSlack通知を管理します</p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Link href="/settings/api-keys" className="rounded-lg border border-gray-200 p-3 text-sm text-navy hover:bg-gray-50">APIキー管理</Link>
          <Link href="/settings/clients" className="rounded-lg border border-gray-200 p-3 text-sm text-navy hover:bg-gray-50">クライアント管理</Link>
          <Link href="/settings/users" className="rounded-lg border border-gray-200 p-3 text-sm text-navy hover:bg-gray-50">ユーザー管理</Link>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-navy">手数料設定</h3>
        <p className="mt-1 text-sm text-gray-500">手数料の計算方式とデフォルト手数料率を設定します</p>

        <div className="mt-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700">計算方式</p>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 px-4 py-3 has-[:checked]:border-blue has-[:checked]:bg-blue/5">
                <input
                  type="radio"
                  name="feeCalcMethod"
                  value="markup"
                  checked={feeCalcMethod === "markup"}
                  onChange={() => setFeeCalcMethod("markup")}
                />
                <div>
                  <p className="text-sm font-medium text-navy">外掛け（マークアップ）</p>
                  <p className="text-xs text-gray-500">請求額 = 媒体費 × (1 + 手数料率)</p>
                  <p className="text-xs text-gray-400">例: 100万 × 1.2 = 120万</p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 px-4 py-3 has-[:checked]:border-blue has-[:checked]:bg-blue/5">
                <input
                  type="radio"
                  name="feeCalcMethod"
                  value="margin"
                  checked={feeCalcMethod === "margin"}
                  onChange={() => setFeeCalcMethod("margin")}
                />
                <div>
                  <p className="text-sm font-medium text-navy">内掛け（マージン）</p>
                  <p className="text-xs text-gray-500">請求額 = 媒体費 / (1 - 手数料率)</p>
                  <p className="text-xs text-gray-400">例: 100万 / 0.8 = 125万</p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700">デフォルト手数料率</p>
            <p className="text-xs text-gray-500">予算未設定の案件に適用される手数料率</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={0.1}
                value={percentValue(defaultFeeRate)}
                onChange={(event) => setDefaultFeeRate(parseNumber(event.target.value) / 100)}
                className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue focus:ring-1 focus:ring-blue"
              />
              <span>%</span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-navy">Slack通知設定</h3>
          <button
            type="button"
            onClick={() => setSlack((prev) => ({ ...prev, enabled: !prev.enabled }))}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              slack.enabled ? "bg-blue" : "bg-gray-200"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                slack.enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
          <span className={`text-sm ${slack.enabled ? "font-medium text-blue" : "text-gray-400"}`}>
            {slack.enabled ? "有効" : "無効"}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500">アラート発生時にSlackチャンネルへ通知します</p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Webhook URL</label>
            <p className="mb-1 text-xs text-gray-400">Incoming Webhooks のURLを入力してください</p>
            <input
              type="url"
              value={slack.webhookUrl}
              onChange={(event) => setSlack((prev) => ({ ...prev, webhookUrl: event.target.value }))}
              placeholder="https://hooks.slack.com/services/T.../B.../..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue focus:ring-1 focus:ring-blue"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">チャンネル名（メモ）</label>
            <input
              type="text"
              value={slack.channelName || ""}
              onChange={(event) => setSlack((prev) => ({ ...prev, channelName: event.target.value }))}
              placeholder="#ad-alerts"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue focus:ring-1 focus:ring-blue"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onTestSlack}
              disabled={!slack.webhookUrl}
              className="rounded-lg border border-blue bg-white px-4 py-2 text-sm font-medium text-blue hover:bg-blue/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              テスト通知を送信
            </button>
            {testResult && (
              <span className={`text-sm ${testResult.ok ? "text-emerald-600" : "text-red-600"}`}>
                {testResult.ok ? "送信成功" : testResult.error}
              </span>
            )}
          </div>
        </div>
      </section>

      <section>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-light disabled:opacity-60"
        >
          保存
        </button>
        {message && <span className="ml-3 text-sm text-emerald-600">{message}</span>}
      </section>
    </div>
  );
}
