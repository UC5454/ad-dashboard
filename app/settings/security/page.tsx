"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { loadApiKeys, loadClients, saveApiKeys } from "@/lib/storage";

const LAST_LOGIN_KEY = "ad-dashboard-last-login-at";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "不明";
  return date.toLocaleString("ja-JP");
}

export default function SecuritySettingsPage() {
  const { data: session } = useSession();
  const [apiKeyCount, setApiKeyCount] = useState(0);
  const [clientCount, setClientCount] = useState(0);
  const [lastLoginAt, setLastLoginAt] = useState<string>("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setApiKeyCount(loadApiKeys().length);
    setClientCount(loadClients().length);

    const previous = localStorage.getItem(LAST_LOGIN_KEY) || "";
    setLastLoginAt(previous);
    localStorage.setItem(LAST_LOGIN_KEY, new Date().toISOString());
  }, []);

  const clearAllApiKeys = () => {
    if (!window.confirm("ローカル保存されたAPIキーをすべて削除しますか？")) return;
    saveApiKeys([]);
    setApiKeyCount(0);
    setMessage("全APIキーを削除しました");
    setTimeout(() => setMessage(""), 2000);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-bold text-navy">セキュリティ</h2>
        <p className="mt-1 text-sm text-gray-500">認証状態とセキュリティ設定の確認</p>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-navy">セッション情報</h3>
        <dl className="mt-3 grid gap-2 text-sm text-gray-700">
          <div className="flex items-center justify-between border-b border-gray-100 py-2">
            <dt>ログインユーザー名</dt>
            <dd className="font-medium text-navy">{session?.user?.name || "-"}</dd>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 py-2">
            <dt>メールアドレス</dt>
            <dd className="font-medium text-navy">{session?.user?.email || "-"}</dd>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 py-2">
            <dt>最終ログイン情報</dt>
            <dd className="font-medium text-navy">{lastLoginAt ? formatDateTime(lastLoginAt) : "初回表示"}</dd>
          </div>
          <div className="flex items-center justify-between py-2">
            <dt>APIキー登録数</dt>
            <dd className="font-medium text-navy">{apiKeyCount}件</dd>
          </div>
        </dl>

        <div className="mt-4">
          <button
            type="button"
            onClick={clearAllApiKeys}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 hover:bg-red-100"
          >
            全APIキーを削除
          </button>
          {message && <p className="mt-2 text-sm text-emerald-600">{message}</p>}
        </div>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-navy">セキュリティチェックリスト</h3>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          <li>✅ Google OAuth認証: 有効</li>
          <li>✅ ドメイン制限: digital-gorilla.co.jp のみ</li>
          <li>✅ HTTPS強制: 有効</li>
          <li>✅ CSRF保護: 有効</li>
          <li>APIキー登録数: {apiKeyCount}件</li>
          <li>クライアント登録数: {clientCount}件</li>
        </ul>
      </section>
    </div>
  );
}
