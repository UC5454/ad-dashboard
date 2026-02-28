"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { loadApiKeys, saveApiKeys, type StoredApiKey } from "@/lib/storage";

type Platform = "google" | "meta";

type TestStatus = { state: "success" | "error"; message: string } | null;

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ja-JP");
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}`;
}

export default function ApiKeysPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  const [rows, setRows] = useState<StoredApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [platform, setPlatform] = useState<Platform>("google");
  const [keyName, setKeyName] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>(null);

  const localRows = useMemo(() => loadApiKeys(), []);

  useEffect(() => {
    if (role === "admin") {
      setRows(localRows);
      setLoading(false);
    }
  }, [localRows, role]);

  if (role !== "admin") {
    return <p className="rounded-xl bg-white p-6 text-sm text-gray-600 shadow-sm">権限がありません</p>;
  }

  const resetForm = () => {
    setPlatform("google");
    setKeyName("");
    setFields({});
    setShowSecrets(false);
    setTestStatus(null);
  };

  const onSave = () => {
    if (!keyName.trim()) return;
    const nextKey: StoredApiKey = {
      id: createId(),
      platform,
      keyName: keyName.trim(),
      credentials: { ...fields },
      createdAt: new Date().toISOString(),
    };
    const next = [nextKey, ...rows];
    setRows(next);
    saveApiKeys(next);
    setOpen(false);
    resetForm();
  };

  const onDelete = (id: string) => {
    if (!window.confirm("このキーを削除しますか？")) return;
    const next = rows.filter((row) => row.id !== id);
    setRows(next);
    saveApiKeys(next);
  };

  const onTest = async () => {
    setTesting(true);
    setTestStatus(null);

    try {
      if (platform === "meta") {
        const accessToken = fields.access_token || "";
        const res = await fetch("/api/meta-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!data.ok) {
          setTestStatus({ state: "error", message: data.error || "接続に失敗しました" });
        } else {
          setTestStatus({ state: "success", message: "接続成功" });
        }
      } else {
        const res = await fetch("/api/google-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credentials: fields }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
        if (!data.ok) {
          setTestStatus({ state: "error", message: data.error || "接続に失敗しました" });
        } else {
          setTestStatus({ state: "success", message: data.message || "接続成功" });
        }
      }
    } catch (error) {
      setTestStatus({
        state: "error",
        message: error instanceof Error ? error.message : "接続に失敗しました",
      });
    } finally {
      setTesting(false);
    }
  };

  const googleFields = ["developer_token", "client_id", "client_secret", "refresh_token", "login_customer_id"];
  const metaFields = ["app_id", "app_secret", "access_token"];
  const targetFields = platform === "google" ? googleFields : metaFields;

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-navy">APIキー管理</h2>
            <p className="mt-1 text-sm text-gray-500">認証情報自体は表示せず、キー名のみ管理します</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg bg-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-light"
          >
            新規登録
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl bg-white shadow-sm">
        {loading ? (
          <div className="px-4 py-8 text-sm text-gray-500">読み込み中...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">キー名</th>
                <th className="px-4 py-3 text-left font-medium">プラットフォーム</th>
                <th className="px-4 py-3 text-left font-medium">作成日</th>
                <th className="px-4 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">{row.keyName}</td>
                  <td className="px-4 py-3">{row.platform === "google" ? "Google Ads" : "Meta Ads"}</td>
                  <td className="px-4 py-3">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onDelete(row.id)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-100"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    登録済みのキーはありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-lg">
            <h3 className="text-lg font-semibold text-navy">APIキー新規登録</h3>
            <div className="mt-4 space-y-3">
              <label className="block text-sm text-gray-700">
                プラットフォーム
                <div className="mt-2 inline-flex rounded-lg border border-gray-200 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPlatform("google");
                      setTestStatus(null);
                    }}
                    className={`rounded-md px-3 py-1.5 text-sm ${
                      platform === "google" ? "bg-blue text-white" : "text-gray-600"
                    }`}
                  >
                    Google Ads
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPlatform("meta");
                      setTestStatus(null);
                    }}
                    className={`rounded-md px-3 py-1.5 text-sm ${
                      platform === "meta" ? "bg-blue text-white" : "text-gray-600"
                    }`}
                  >
                    Meta Ads
                  </button>
                </div>
              </label>

              <label className="block text-sm text-gray-700">
                キー名
                <input
                  value={keyName}
                  onChange={(event) => setKeyName(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  placeholder="運用アカウント用"
                />
              </label>

              <button
                type="button"
                onClick={() => setShowSecrets((prev) => !prev)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
              >
                {showSecrets ? "非表示" : "表示"}
              </button>

              {targetFields.map((name) => (
                <label key={name} className="block text-sm text-gray-700">
                  {name}
                  <input
                    type={showSecrets ? "text" : "password"}
                    value={fields[name] || ""}
                    onChange={(event) => {
                      setFields((prev) => ({ ...prev, [name]: event.target.value }));
                      setTestStatus(null);
                    }}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  />
                </label>
              ))}

              {testStatus && (
                <p
                  className={`rounded-lg px-3 py-2 text-sm ${
                    testStatus.state === "success"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {testStatus.message}
                </p>
              )}
            </div>

            <div className="mt-5 flex justify-between gap-2">
              <button
                type="button"
                onClick={onTest}
                disabled={testing}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {testing ? "接続確認中..." : "テスト接続"}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                  }}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-light"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
