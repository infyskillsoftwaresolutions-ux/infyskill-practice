import { AppShell } from "@/components/app-shell";
import { CreditsWorkspace } from "@/components/credits/credits-workspace";
import { listColleges } from "@/lib/colleges";
import { listCreditFields, listCredits } from "@/lib/credits";
import { listInvoices } from "@/lib/invoices";

export const dynamic = "force-dynamic";

export default async function CreditsPage(props: PageProps<"/credits">) {
  const query = await props.searchParams;
  const edit = typeof query.edit === "string" ? query.edit : "";
  const colleges = listColleges().map((college) => ({ id: college.id, name: college.name }));
  const invoices = listInvoices().map((invoice) => ({
    id: invoice.id,
    number: invoice.number,
    name: invoice.billToName,
  }));
  return (
    <AppShell>
      <CreditsWorkspace
        credits={listCredits()}
        fields={listCreditFields()}
        colleges={colleges}
        invoices={invoices}
        editId={edit}
      />
    </AppShell>
  );
}
