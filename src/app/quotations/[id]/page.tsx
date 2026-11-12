import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { QuotationEditor } from "@/components/quotations/quotation-editor";
import { listColleges } from "@/lib/colleges";
import { getQuotation, listQuotationFields } from "@/lib/quotations";

export const dynamic = "force-dynamic";

export default async function QuotationPage({ params }: PageProps<"/quotations/[id]">) {
  const { id } = await params;
  const quotation = getQuotation(id);
  if (!quotation) notFound();
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
      <QuotationEditor
        quotation={quotation}
        colleges={colleges}
        fields={listQuotationFields()}
      />
    </AppShell>
  );
}
