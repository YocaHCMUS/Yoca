import client from "@/api/main";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type EffectivePlanTier = "Free" | "Lite" | "Plus" | "Pro";

export type AuthUser = {
  userId: string;
  displayName: string | null;
  avatarUrl?: string | null;
  planTier: EffectivePlanTier;
  entitlements: {
    washTradingAi: boolean;
    walletAiAnalysis: boolean;
  };
};

type AuthContextType = {
  user: AuthUser | null;
  isUserLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
  openAuthModal: (mode?: "login" | "register") => void;
  closeAuthModal: () => void;
  isSignInOpen: boolean;
  isSignUpOpen: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      setIsUserLoading(true);

      const resp = await client.api.users.auth.me.$get();

      if (resp.ok) {
        const res = await resp.json();

        if (res) {
          setUser({
            userId: res.id,
            displayName: res.displayName,
            avatarUrl: res.avatarUrl,
            planTier: res.planTier,
            entitlements: res.entitlements,
          });
        } else {
          // API may return null for unauthenticated sessions.
          setUser(null);
        }
      } else {
        // API may return null for unauthenticated sessions.
        setUser(null);
      }
    } catch (err) {
      console.error("Failed to fetch current user:", err);
    } finally {
      setIsUserLoading(false);
    }
  }, []);

  useEffect(() => {
    setUser(null);
    refreshUser();
  }, [refreshUser]);

  const signOut = useCallback(async () => {
    await client.api.users.auth.logout.$delete();
    setUser(null);
  }, []);

  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);

  const openAuthModal = useCallback((mode: "login" | "register" = "login") => {
    if (mode === "login") setIsSignInOpen(true);
    else setIsSignUpOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsSignInOpen(false);
    setIsSignUpOpen(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{ 
        user, 
        isUserLoading,
        setUser, 
        refreshUser, 
        signOut, 
        openAuthModal,
        closeAuthModal,
        isSignInOpen,
        isSignUpOpen 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context == undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
