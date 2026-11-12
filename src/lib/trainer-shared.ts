export const TRAINER_STATUSES = ["active", "inactive"] as const;
export type TrainerStatus = (typeof TRAINER_STATUSES)[number];

export const TRAINER_STATUS_LABELS: Record<TrainerStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};
