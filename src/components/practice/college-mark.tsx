"use client";

import { usePracticeSite } from "@/components/practice/practice-site";
import { logoHref } from "@/lib/practice-host";

export function CollegeMark({
  collegeId,
  name,
  hasLogo,
  logoAt,
  onHost,
}: {
  collegeId: string;
  name: string;
  hasLogo: boolean;
  logoAt: string;
  onHost?: boolean;
}) {
  const site = usePracticeSite();
  if (!hasLogo) return null;
  return (
    <img
      src={logoHref(collegeId, logoAt, onHost ?? site.onHost)}
      alt={`${name} logo`}
      className="h-11 w-11 shrink-0 rounded-xl border border-line bg-card object-contain p-1"
    />
  );
}
