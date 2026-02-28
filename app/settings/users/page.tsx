"use client";

import { useSession } from "next-auth/react";

export default function UsersPage() {
  const { data: session, status } = useSession();

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-bold text-navy">アカウント情報</h2>
        <p className="mt-1 text-sm text-gray-500">ログイン中ユーザーのプロフィールを表示します</p>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        {status === "loading" ? (
          <p className="text-sm text-gray-500">読み込み中...</p>
        ) : !session?.user ? (
          <p className="text-sm text-gray-600">ログインしていません</p>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <img
              src={session.user.image || "/globe.svg"}
              alt="プロフィール画像"
              className="h-16 w-16 rounded-full object-cover"
            />
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500">ユーザー名</p>
                <p className="text-base font-semibold text-navy">{session.user.name || "未設定"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">メールアドレス</p>
                <p className="text-sm text-gray-700">{session.user.email || "未設定"}</p>
              </div>
              <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                ログイン中
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
