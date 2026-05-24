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
};

type AuthContextType = {
  user: AuthUser | null;
  isUserLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
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

  return (
    <AuthContext.Provider value={{ user, isUserLoading, setUser, refreshUser, signOut }}>
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
