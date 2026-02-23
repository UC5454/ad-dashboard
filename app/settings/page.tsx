import Link from "next/link";

const cards = [
  {
    href: "/settings/api-keys",
    title: "APIキー管理",
    description: "Google Ads / Meta Ads の認証キーを管理",
  },
  {
    href: "/settings/clients",
    title: "クライアント管理",
    description: "クライアント情報と予算を管理",
  },
  {
    href: "/settings/users",
    title: "ユーザー管理",
    description: "ユーザー作成とロール設定",
  },
];

export default function SettingsTopPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">設定</h2>
        <p className="mt-1 text-sm text-gray-500">管理機能を選択してください</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="bg-white rounded-xl shadow-sm p-5 border border-gray-200 hover:border-blue transition-colors"
          >
            <h3 className="text-base font-semibold text-navy">{card.title}</h3>
            <p className="mt-2 text-sm text-gray-500">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
