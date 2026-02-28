import Sidebar from "@/components/ui/Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Sidebar />
      <main className="ml-64 min-h-screen bg-gray-50 p-6">{children}</main>
    </div>
  );
}
