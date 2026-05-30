import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Loading } from "@carbon/react";
import React from "react";
import { Navigate, useLocation } from "react-router";

interface AuthGuardProps {
  children: React.ReactNode;
}


export function AuthGuard({ children }: AuthGuardProps) {
  const { user, isUserLoading } = useAuth();
  const {tr} = useLocalization();
  const location = useLocation();
  const attemptedPath = `${location.pathname}${location.search}${location.hash}`;
  if (isUserLoading) {
    return <Loading withOverlay description={tr("auth.authenticating")}/>
  } else if (!user) {
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
