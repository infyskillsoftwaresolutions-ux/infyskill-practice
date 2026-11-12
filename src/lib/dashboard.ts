import { listColleges } from "@/lib/colleges";
import { listCredits } from "@/lib/credits";
import { listExpenses } from "@/lib/expenses";
import { invoiceTotal } from "@/lib/invoice-shared";
import { listInvoices } from "@/lib/invoices";
import { listEmployees } from "@/lib/payroll";
import { quotationFigures } from "@/lib/quotation-shared";
import { listQuotations } from "@/lib/quotations";
import { listTrainers } from "@/lib/trainers";

export type DashboardRow = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  date: string;
  amount: number | null;
  currency: string;
  status: string;
};

export type DashboardData = {
  trainers: { total: number; active: number };
  employees: {
    total: number;
    active: number;
    monthlySalaryInr: number;
    hourlyCount: number;
    otherPay: { currency: string; monthly: number }[];
  };
  colleges: { total: number; programs: number };
  expenses: DashboardRow[];
  credits: DashboardRow[];
  invoices: DashboardRow[];
  quotations: DashboardRow[];
};

function monthlyAmount(salary: number, frequency: string) {
  if (frequency === "monthly") return salary;
  if (frequency === "yearly") return salary / 12;
  return 0;
}

export function loadDashboard(): DashboardData {
  const trainers = listTrainers();
  const employees = listEmployees();
  const colleges = listColleges();
  const otherPay = new Map<string, number>();
  let monthlySalaryInr = 0;
  let hourlyCount = 0;
  for (const employee of employees) {
    if (employee.status !== "active") continue;
    if (employee.payFrequency === "hourly") {
      hourlyCount += 1;
      continue;
    }
    const monthly = monthlyAmount(employee.salary, employee.payFrequency);
    if (employee.currency === "INR") monthlySalaryInr += monthly;
    else otherPay.set(employee.currency, (otherPay.get(employee.currency) ?? 0) + monthly);
  }

  return {
    trainers: {
      total: trainers.length,
      active: trainers.filter((trainer) => trainer.status === "active").length,
    },
    employees: {
      total: employees.length,
      active: employees.filter((employee) => employee.status === "active").length,
      monthlySalaryInr,
      hourlyCount,
      otherPay: [...otherPay.entries()].map(([currency, monthly]) => ({ currency, monthly })),
    },
    colleges: {
      total: colleges.length,
      programs: colleges.reduce((sum, college) => sum + college.programs.length, 0),
    },
    expenses: listExpenses().map((expense) => ({
      id: expense.id,
      href: `/expenses?edit=${expense.id}`,
      title: expense.description,
      subtitle: expense.spentOn ? "" : "No date",
      date: expense.spentOn,
      amount: expense.cost,
      currency: expense.currency,
      status: "",
    })),
    credits: listCredits().map((credit) => ({
      id: credit.id,
      href: `/credits?edit=${credit.id}`,
      title: credit.fromName,
      subtitle: credit.receivedOn ? "" : "No date",
      date: credit.receivedOn,
      amount: credit.amount,
      currency: credit.currency,
      status: "",
    })),
    invoices: listInvoices().map((invoice) => ({
      id: invoice.id,
      href: `/invoices/${invoice.id}`,
      title: invoice.number,
      subtitle: invoice.billToName,
      date: invoice.issuedOn,
      amount: invoiceTotal(invoice.lines),
      currency: invoice.currency,
      status: invoice.status,
    })),
    quotations: listQuotations().map((quotation) => ({
      id: quotation.id,
      href: `/quotations/${quotation.id}`,
      title: quotation.number,
      subtitle: quotation.preparedFor || quotation.body.programTitle,
      date: quotation.issuedOn,
      amount: quotationFigures(quotation.body).total,
      currency: "INR",
      status: quotation.status,
    })),
  };
}
