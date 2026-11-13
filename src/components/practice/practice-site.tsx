"use client";

import { createContext, useContext } from "react";

const PracticeSiteContext = createContext({ onHost: false });

export function PracticeSiteProvider({ onHost, children }: { onHost: boolean; children: React.ReactNode }) {
  return <PracticeSiteContext.Provider value={{ onHost }}>{children}</PracticeSiteContext.Provider>;
}

export function usePracticeSite() {
  return useContext(PracticeSiteContext);
}
