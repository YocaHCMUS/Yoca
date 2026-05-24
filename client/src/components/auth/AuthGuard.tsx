import { useAuth } from "@/contexts/AuthContext";
import React from "react";
import { Navigate, useLocation } from "react-router";

interface AuthGuardProps {
  children: React.ReactNode;
}


export function AuthGuard({ children }: AuthGuardProps) {
  const { user } = useAuth();
  const location = useLocation();
  const attemptedPath = `${location.pathname}${location.search}${location.hash}`;

  if (!user) {
    return (
      <Navigate
        to="/unauthorized"
        replace
        state={{ from: attemptedPath }}
      />
    );
  }

  return <>{children}</>;
}
