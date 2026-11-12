import { AppShell } from "@/components/app-shell";
import { InvoicesWorkspace } from "@/components/invoices/invoices-workspace";
import { getInvoiceSettings, listInvoiceFields, listInvoices } from "@/lib/invoices";

export const dynamic = "force-dynamic";

export default function InvoicesPage() {
  return (
    <AppShell>
      <InvoicesWorkspace invoices={listInvoices()} fields={listInvoiceFields()} settings={getInvoiceSettings()} />
    </AppShell>
  );
}
