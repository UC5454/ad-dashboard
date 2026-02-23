"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

interface ApiKeyItem {
  id: string;
  platform: "google_ads" | "meta_ads";
  key_name: string;
  created_at: string;
}

type Platform = "google_ads" | "meta_ads";

const googleFields = [
  "developer_token",
  "client_id",
  "client_secret",
  "refresh_token",
  "login_customer_id",
] as const;

const metaFields = ["app_id", "app_secret", "access_token"] as const;

function initialCredentialValues(platform: Platform): Record<string, string> {
  const fields = platform === "google_ads" ? googleFields : metaFields;
  return Object.fromEntries(fields.map((field) => [field, ""]));
}

export default function ApiKeysPage() {
  const { data: session, status } = useSession();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>("google_ads");
  const [keyName, setKeyName] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>(
    initialCredentialValues("google_ads")
  );
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});
  const role = (session?.user as Record<string, string> | undefined)?.role;

  const currentFields = useMemo(
    () => (platform === "google_ads" ? googleFields : metaFields),
    [platform]
  );

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/api-keys");
    if (res.ok) {
      const data = (await res.json()) as ApiKeyItem[];
      setKeys(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (status === "authenticated" && role === "admin") {
      void load();
    } else if (status !== "loading") {
      setLoading(false);
    }
  }, [status, role]);

  const openModal = () => {
    setPlatform("google_ads");
    setKeyName("");
    setCredentials(initialCredentialValues("google_ads"));
    setVisibleFields({});
    setIsModalOpen(true);
  };

  const onSwitchPlatform = (next: Platform) => {
    setPlatform(next);
    setCredentials(initialCredentialValues(next));
    setVisibleFields({});
  };

  const handleSave = async () => {
    const payload = {
      platform,
      key_name: keyName,
      credentials,
    };

    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setIsModalOpen(false);
      await load();
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("このAPIキーを削除しますか？")) return;

    const res = await fetch(`/api/api-keys?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setKeys((prev) => prev.filter((item) => item.id !== id));
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue border-t-transparent" />
      </div>
    );
  }

  if (role !== "admin") {
    return <p className="text-sm text-red-600">権限がありません</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-navy">APIキー管理</h2>
          <p className="mt-1 text-sm text-gray-500">連携先媒体の認証情報を管理します</p>
        </div>
        <button
          type="button"
          className="bg-blue text-white rounded-lg px-4 py-2.5 hover:bg-blue-light"
          onClick={openModal}
        >
          新規登録
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">キー名</th>
              <th className="px-4 py-3 text-left">プラットフォーム</th>
              <th className="px-4 py-3 text-left">作成日</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((item) => (
              <tr key={item.id} className="border-t border-gray-100">
                <td className="px-4 py-3">{item.key_name}</td>
                <td className="px-4 py-3">
                  {item.platform === "google_ads" ? "Google Ads" : "Meta Ads"}
                </td>
                <td className="px-4 py-3">{new Date(item.created_at).toLocaleDateString("ja-JP")}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(item.id)}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  APIキーが登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-navy">APIキー新規登録</h3>

            <div className="mt-4 flex gap-2 rounded-lg bg-gray-100 p-1">
              <button
                type="button"
                className={`flex-1 rounded-md px-3 py-2 text-sm ${
                  platform === "google_ads" ? "bg-white text-navy shadow-sm" : "text-gray-500"
                }`}
                onClick={() => onSwitchPlatform("google_ads")}
              >
                Google Ads
              </button>
              <button
                type="button"
                className={`flex-1 rounded-md px-3 py-2 text-sm ${
                  platform === "meta_ads" ? "bg-white text-navy shadow-sm" : "text-gray-500"
                }`}
                onClick={() => onSwitchPlatform("meta_ads")}
              >
                Meta Ads
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-sm text-gray-700">
                表示名
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                />
              </label>

              {currentFields.map((field) => (
                <label key={field} className="block text-sm text-gray-700">
                  {field}
                  <div className="mt-1 flex gap-2">
                    <input
                      type={visibleFields[field] ? "text" : "password"}
                      value={credentials[field] || ""}
                      onChange={(e) =>
                        setCredentials((prev) => ({ ...prev, [field]: e.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-200 px-3 py-2"
                    />
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 px-3 text-xs"
                      onClick={() =>
                        setVisibleFields((prev) => ({ ...prev, [field]: !prev[field] }))
                      }
                    >
                      {visibleFields[field] ? "非表示" : "表示"}
                    </button>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="border border-gray-200 bg-white rounded-lg px-4 py-2.5 hover:bg-gray-50"
                onClick={() => setIsModalOpen(false)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="bg-blue text-white rounded-lg px-4 py-2.5 hover:bg-blue-light"
                onClick={handleSave}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
