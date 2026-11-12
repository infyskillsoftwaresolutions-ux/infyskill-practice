import { AppShell } from "@/components/app-shell";
import { TrainersWorkspace } from "@/components/trainers/trainers-workspace";
import { listTrainerFields, listTrainers } from "@/lib/trainers";

export const dynamic = "force-dynamic";

export default function TrainersPage() {
  return (
    <AppShell>
      <TrainersWorkspace trainers={listTrainers()} fields={listTrainerFields()} />
    </AppShell>
  );
}
