"use client";

import { SessionProvider } from "next-auth/react";

export default function AuthSessionProvider({ children }) {
  return <SessionProvider refetchOnWindowFocus={false}>{children}</SessionProvider>;
}
