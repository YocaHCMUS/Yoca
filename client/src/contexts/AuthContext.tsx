import client from "@/api/main";
import React, { createContext, useCallback, useContext, useState } from "react";

type AuthUser = {
  userId: string;
  displayName?: string;
};

type AuthContextType = {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const signOut = useCallback(async () => {
    await client.api.users.auth.logout.$delete();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
