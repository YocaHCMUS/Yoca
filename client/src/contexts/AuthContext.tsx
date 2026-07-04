import client from "@/api/main";
import { getUserSubscription, type PlanTier, type Subscription } from "@/services/profile/subscriptionApi";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type AuthUser = {
  userId: string;
  displayName: string | null;
  avatarUrl?: string | null;
};

/** Tier to gate features on: the subscription's plan, or "Free" if there is none/it's not active. */
export type EffectivePlanTier = "Free" | PlanTier;

function resolveEffectiveTier(subscription: Subscription | null): EffectivePlanTier {
  const isCurrent =
    subscription &&
    (subscription.status === "active" || subscription.status === "trialing") &&
    (!subscription.currentPeriodEnd || new Date(subscription.currentPeriodEnd).getTime() > Date.now());
  return isCurrent ? subscription.planTier : "Free";
}

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
  /** Current subscription, shared across the app so every consumer stays in sync. */
  subscription: Subscription | null;
  isSubscriptionLoading: boolean;
  effectiveTier: EffectivePlanTier;
  /** Call after upgrade/cancel so every gate and tag reflects the new tier immediately. */
  refreshSubscription: () => Promise<void>;
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

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(true);

  const refreshSubscription = useCallback(async () => {
    try {
      setIsSubscriptionLoading(true);
      const sub = await getUserSubscription();
      setSubscription(sub);
    } catch (err) {
      console.error("Failed to fetch subscription:", err);
      setSubscription(null);
    } finally {
      setIsSubscriptionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      setSubscription(null);
      setIsSubscriptionLoading(false);
      return;
    }
    refreshSubscription();
  }, [user, isUserLoading, refreshSubscription]);

  const effectiveTier = useMemo(() => resolveEffectiveTier(subscription), [subscription]);

  const signOut = useCallback(async () => {
    await client.api.users.auth.logout.$delete();
    setUser(null);
    setSubscription(null);
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
        isSignUpOpen,
        subscription,
        isSubscriptionLoading,
        effectiveTier,
        refreshSubscription,
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
