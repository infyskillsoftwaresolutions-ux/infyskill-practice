import { AppShell } from "@/components/app-shell";
import { ExpensesWorkspace } from "@/components/expenses/expenses-workspace";
import { listExpenseFields, listExpenses } from "@/lib/expenses";

export const dynamic = "force-dynamic";

export default async function ExpensesPage(props: PageProps<"/expenses">) {
  const query = await props.searchParams;
  const edit = typeof query.edit === "string" ? query.edit : "";
  return (
    <AppShell>
      <ExpensesWorkspace expenses={listExpenses()} fields={listExpenseFields()} editId={edit} />
    </AppShell>
  );
}
