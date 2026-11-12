import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TrainerDetail } from "@/components/trainers/trainer-detail";
import { getTrainer, listTrainerFields, listTrainerSkillNames } from "@/lib/trainers";

export const dynamic = "force-dynamic";

export default async function TrainerPage({ params }: PageProps<"/trainers/[id]">) {
  const { id } = await params;
  const trainer = getTrainer(id);
  if (!trainer) notFound();

  return (
    <AppShell>
      <TrainerDetail trainer={trainer} fields={listTrainerFields()} skillSuggestions={listTrainerSkillNames()} />
    </AppShell>
  );
}
