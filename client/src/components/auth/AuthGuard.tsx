import { useAuth } from "@/contexts/AuthContext";
import React from "react";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user } = useAuth();

  if (!user) {
    return <p>Unauthorized</p>;
  }

  return <>{children}</>;
}
