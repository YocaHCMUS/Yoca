import { useAuth } from "@/contexts/AuthContext";
import React from "react";
import { Navigate, useLocation } from "react-router";

interface AuthGuardProps {
  children: React.ReactNode;
}

const UNAUTHORIZED_ROUTE = "/unauthorized";

export function AuthGuard({ children }: AuthGuardProps) {
  const { user } = useAuth();
  const location = useLocation();
  const attemptedPath = `${location.pathname}${location.search}${location.hash}`;

  if (!user) {
    return (
      <Navigate
        to={UNAUTHORIZED_ROUTE}
        replace
        state={{ from: attemptedPath }}
      />
    );
  }

  return <>{children}</>;
}
