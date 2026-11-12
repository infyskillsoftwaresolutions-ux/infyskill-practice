import { AppShell } from "@/components/app-shell";
import { CollegesWorkspace } from "@/components/colleges/colleges-workspace";
import { listColleges } from "@/lib/colleges";

export const dynamic = "force-dynamic";

export default function CollegesPage() {
  return (
    <AppShell>
      <CollegesWorkspace colleges={listColleges()} />
    </AppShell>
  );
}
