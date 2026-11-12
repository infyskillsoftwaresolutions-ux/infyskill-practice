import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { InvoiceEditor } from "@/components/invoices/invoice-editor";
import { listColleges } from "@/lib/colleges";
import { getInvoice, getInvoiceSettings, listInvoiceFields } from "@/lib/invoices";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  const { id } = await params;
  const invoice = getInvoice(id);
  if (!invoice) notFound();
  const colleges = listColleges().map((college) => ({
    id: college.id,
    name: college.name,
    programs: college.programs.map((program) => ({
      name: program.name,
      price: program.price,
      currency: program.currency,
    })),
  }));

  return (
    <AppShell>
      <InvoiceEditor
        invoice={invoice}
        colleges={colleges}
        fields={listInvoiceFields()}
        settings={getInvoiceSettings()}
      />
    </AppShell>
  );
}
