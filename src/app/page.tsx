import { AppShell } from "@/components/app-shell";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { loadDashboard } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default function Home() {
  const today = new Date();
  const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return (
    <AppShell>
      <DashboardView data={loadDashboard()} today={stamp} />
    </AppShell>
  );
}
