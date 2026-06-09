import client from "@/api/main";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type AuthUser = {
  userId: string;
  displayName: string | null;
  avatarUrl?: string | null;
};

type AuthContextType = {
  user: AuthUser | null;
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

  const refreshUser = useCallback(async () => {
    try {
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
        setUser(null);
        console.error("Unexpected response while fetching current user:", resp);
      }
    } catch (err) {
      console.error("Failed to fetch current user:", err);
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
    <AuthContext.Provider value={{ 
      user, 
      setUser, 
      refreshUser, 
      signOut, 
      openAuthModal,
      closeAuthModal,
      isSignInOpen,
      isSignUpOpen 
    }}>
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
