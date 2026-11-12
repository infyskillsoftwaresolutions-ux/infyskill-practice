import { AppShell } from "@/components/app-shell";
import { PayrollWorkspace } from "@/components/payroll/payroll-workspace";
import { listEmployees, listFields } from "@/lib/payroll";

export const dynamic = "force-dynamic";

export default function PayrollPage() {
  const employees = listEmployees();
  const fields = listFields();

  return (
    <AppShell>
      <PayrollWorkspace employees={employees} fields={fields} />
    </AppShell>
  );
}
