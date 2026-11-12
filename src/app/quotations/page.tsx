import { AppShell } from "@/components/app-shell";
import { QuotationsWorkspace } from "@/components/quotations/quotations-workspace";
import { listQuotationFields, listQuotations } from "@/lib/quotations";

export const dynamic = "force-dynamic";

export default function QuotationsPage() {
  return (
    <AppShell>
      <QuotationsWorkspace
        quotations={listQuotations()}
        fields={listQuotationFields()}
      />
    </AppShell>
  );
}
