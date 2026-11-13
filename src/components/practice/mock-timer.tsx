"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function MockTimer({ endsAt }: { endsAt: string }) {
  const router = useRouter();
  const [left, setLeft] = useState("");

  useEffect(() => {
    const tick = () => {
      const remaining = new Date(endsAt).getTime() - Date.now();
      if (remaining <= 0) {
        setLeft("0:00");
        router.refresh();
        return;
      }
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setLeft(`${minutes}:${String(seconds).padStart(2, "0")}`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [endsAt, router]);

  return <p className="text-sm font-semibold text-ink">{left}</p>;
}
