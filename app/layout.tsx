import type { Metadata } from "next";
import "./globals.css";
import SessionProvider from "@/components/auth/SessionProvider";

export const metadata: Metadata = {
  title: "広告ダッシュボード | Digital Gorilla",
  description: "Google Ads / Meta Ads 統合管理ダッシュボード",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="font-sans antialiased bg-gray-50">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
