import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Sidebar from "@/components/ui/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  return (
    <div>
      <Sidebar />
      <main className="ml-64 min-h-screen bg-gray-50 p-6">{children}</main>
    </div>
  );
}
