"use client";

import { createContext, useContext } from "react";

export type SessionUser = { id: string; email: string; name: string | null; role: "owner" | "staff" };

const Ctx = createContext<SessionUser | null>(null);

export function UserProvider({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return <Ctx.Provider value={user}>{children}</Ctx.Provider>;
}

export function useCurrentUser(): SessionUser {
  const user = useContext(Ctx);
  if (!user) throw new Error("useCurrentUser phải nằm trong UserProvider");
  return user;
}
