import { formatDate, formatMoney } from "@/lib/format";
import {
  LETTERHEAD,
  quotationFigures,
  rupeesInWords,
  textLines,
  type QuotationBody,
} from "@/lib/quotation-shared";
import type { CustomValue, FieldDefinition } from "@/lib/payroll-types";

function customText(field: FieldDefinition, value: CustomValue | undefined) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (field.type === "date" && typeof value === "string") return formatDate(value) || value;
  return String(value);
}

function money(amount: number | null) {
  return amount === null ? "—" : formatMoney(amount, "INR");
}

export function QuotationSheet({
  number,
  issuedOn,
  collegeName,
  body,
  customFields,
  fields,
}: {
  number: string;
  issuedOn: string;
  collegeName: string;
  body: QuotationBody;
  customFields: Record<string, CustomValue>;
  fields: FieldDefinition[];
}) {
  const figures = quotationFigures(body);
  const areas = body.areas
    .map((area) => ({ title: area.title.trim(), points: textLines(area.points) }))
    .filter((area) => area.title || area.points.length > 0);
  const deliverables = textLines(body.deliverables);
  const terms = textLines(body.terms);
  const extras = fields
    .map((field) => ({ label: field.label, value: customText(field, customFields[field.key]) }))
    .filter((field) => field.value);
  const program = body.programTitle.trim();
  const college = collegeName.trim();
  const sections = [
    "details",
    ...(areas.length > 0 ? ["areas"] : []),
    "commercial",
    ...(extras.length > 0 ? ["extra"] : []),
    ...(deliverables.length > 0 ? ["deliverables"] : []),
    ...(terms.length > 0 ? ["terms"] : []),
  ];
  const sectionNo = (name: string) => sections.indexOf(name) + 1;
  const detailRows = [
    ["Program Name", program],
    ["Training Duration", body.duration.trim()],
    ["Number of Batches", body.batches.trim()],
    ["Batch Size", body.batchSize.trim() ? `${body.batchSize.trim()} Students` : ""],
    ["Total Students", figures.totalStudents === null ? body.totalStudents.trim() : `${figures.totalStudents} Students`],
    ["Training Mode", body.mode.trim()],
    ["Target Audience", body.audience.trim()],
  ];
  return (
    <article className="invoice-sheet mx-auto w-full max-w-[210mm] bg-white px-8 py-8 text-[15px] leading-7 text-ink shadow-lg print:max-w-none print:shadow-none sm:px-10 sm:py-10">
      <header className="border-b border-[#d7d0c4] pb-4">
        <div className="flex items-center justify-between gap-6">
          <img
            src="/infyskill-logo.png"
            alt="Infyskill EduTech Pvt. Ltd."
            className="h-16 w-auto max-w-[46%] shrink-0 object-contain object-left"
          />
          <address className="text-right text-[13px] leading-5 text-[#243140] not-italic">
            <p>{LETTERHEAD.website}</p>
            {LETTERHEAD.emails.map((email) => (
              <p key={email}>{email}</p>
            ))}
            <p className="mt-2">{LETTERHEAD.phone}</p>
          </address>
        </div>
        <p className="mt-4 text-[13px] leading-5 text-[#243140]">{LETTERHEAD.address.join(" ")}</p>
        <p className="mt-1 text-[13px]">CIN: {LETTERHEAD.cin}</p>
      </header>

      <div className="mt-6 text-center">
        <h2 className="text-xl font-semibold tracking-[0.14em]">QUOTATION</h2>
        {program ? <p className="mt-1 text-base font-medium">{program}</p> : null}
        <p className="mt-1 text-sm text-[#4d5966]">
          {number}
          {issuedOn ? ` · ${formatDate(issuedOn)}` : ""}
        </p>
      </div>

      <section className="mt-6">
        <p>To</p>
        <p>{body.addressee.trim() || "The Management"},</p>
        <p>{college || "College name"}.</p>
      </section>

      {program ? (
        <p className="mt-4">
          <span className="font-semibold">Subject: </span>
          Quotation for {program}.
        </p>
      ) : null}

      <section className="mt-4">
        <p>Dear Sir/Madam,</p>
        <p className="mt-3">Greetings from {LETTERHEAD.shortName}.</p>
        <p className="mt-3">
          We are pleased to submit our quotation for conducting
          {program ? ` a ${program}` : " a training program"}
          {college ? ` for the students of ${college}` : ""}.
        </p>
      </section>

      <section className="mt-6">
        <h3 className="font-semibold">{sectionNo("details")}. Program Details:</h3>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="border border-[#d9d3c7] bg-[#f7f4ee] text-left">
              <th className="w-1/2 border border-[#d9d3c7] px-3 py-1.5 font-semibold">Particulars</th>
              <th className="border border-[#d9d3c7] px-3 py-1.5 font-semibold">Details</th>
            </tr>
          </thead>
          <tbody>
            {detailRows.map(([label, value]) => (
              <tr key={label}>
                <td className="border border-[#d9d3c7] px-3 py-1.5">{label}</td>
                <td className="border border-[#d9d3c7] px-3 py-1.5">{value || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {areas.length > 0 ? (
        <section className="mt-6">
          <h3 className="font-semibold">{sectionNo("areas")}. Training Areas:</h3>
          <div className="mt-2 grid gap-3">
            {areas.map((area) => (
              <div key={area.title || area.points[0]}>
                {area.title ? <p className="font-medium">{area.title}</p> : null}
                {area.points.length > 0 ? (
                  <ul className="mt-1 list-disc pl-5">
                    {area.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <h3 className="font-semibold">{sectionNo("commercial")}. Commercial Proposal</h3>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="border border-[#d9d3c7] bg-[#f7f4ee] text-left">
              <th className="w-1/2 border border-[#d9d3c7] px-3 py-1.5 font-semibold">Description</th>
              <th className="border border-[#d9d3c7] px-3 py-1.5 font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-[#d9d3c7] px-3 py-1.5">Cost per Student</td>
              <td className="border border-[#d9d3c7] px-3 py-1.5">{money(figures.costPerStudent)}</td>
            </tr>
            <tr>
              <td className="border border-[#d9d3c7] px-3 py-1.5">Students per Batch</td>
              <td className="border border-[#d9d3c7] px-3 py-1.5">{figures.batchSize ?? "—"}</td>
            </tr>
            <tr>
              <td className="border border-[#d9d3c7] px-3 py-1.5">Cost per Batch</td>
              <td className="border border-[#d9d3c7] px-3 py-1.5">{money(figures.costPerBatch)}</td>
            </tr>
            <tr>
              <td className="border border-[#d9d3c7] px-3 py-1.5">Number of Batches</td>
              <td className="border border-[#d9d3c7] px-3 py-1.5">{figures.batches ?? "—"}</td>
            </tr>
            <tr>
              <td className="border border-[#d9d3c7] px-3 py-1.5">Total Students</td>
              <td className="border border-[#d9d3c7] px-3 py-1.5">{figures.totalStudents ?? "—"}</td>
            </tr>
            <tr>
              <td className="border border-[#d9d3c7] px-3 py-1.5 font-semibold">Total Training Cost</td>
              <td className="border border-[#d9d3c7] px-3 py-1.5 font-semibold">{money(figures.total)}</td>
            </tr>
          </tbody>
        </table>
        {figures.total !== null ? (
          <p className="mt-3 font-semibold">
            Total Quotation Value: {formatMoney(figures.total, "INR")} ({rupeesInWords(figures.total)}).
          </p>
        ) : null}
        <p className="mt-1">Applicable taxes, if any, will be charged extra.</p>
      </section>

      {extras.length > 0 ? (
        <section className="mt-6">
          <h3 className="font-semibold">{sectionNo("extra")}. Additional Details</h3>
          <dl className="mt-2 grid gap-1">
            {extras.map((field) => (
              <div key={field.label} className="grid grid-cols-[10rem_minmax(0,1fr)] gap-2">
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {deliverables.length > 0 ? (
        <section className="mt-6">
          <h3 className="font-semibold">{sectionNo("deliverables")}. Program Deliverables</h3>
          <ul className="mt-1 list-disc pl-5">
            {deliverables.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {terms.length > 0 ? (
        <section className="mt-6">
          <h3 className="font-semibold">{sectionNo("terms")}. Terms & Conditions</h3>
          <ol className="mt-1 list-decimal pl-5">
            {terms.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>
      ) : null}

      {body.closing.trim() ? <p className="mt-6 whitespace-pre-wrap">{body.closing.trim()}</p> : null}

      <section className="mt-10">
        <p>For {LETTERHEAD.legalName}</p>
        <p className="mt-8">Authorized Signatory</p>
        <p className="mt-3">Name: {body.signatoryName.trim() || "—"}</p>
        <p>Designation: {body.signatoryTitle.trim() || "—"}</p>
      </section>
    </article>
  );
}
