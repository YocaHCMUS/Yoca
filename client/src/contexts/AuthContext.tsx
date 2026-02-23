/**
 * Authentication Context Provider
 * Manages global authentication state and operations
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import * as authService from "../services/auth/authService";
import * as walletService from "../services/auth/walletService";
import type {
  AuthContextType,
  AuthResponse,
  AuthState,
  BlockchainType,
  GoogleAuthData,
  SignInFormData,
  SignUpFormData,
  WalletType,
} from "../types/auth";

const initialAuthState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  loading: false,
  error: null,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(initialAuthState);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("auth_token");
      if (token) {
        setAuthState((prev) => ({ ...prev, loading: true }));
        try {
          const response = await authService.validateToken(token);
          if (response.success && response.user) {
            setAuthState({
              isAuthenticated: true,
              user: response.user,
              token,
              loading: false,
              error: null,
            });
          } else {
            // Invalid token, clear storage
            localStorage.removeItem("auth_token");
            setAuthState(initialAuthState);
          }
        } catch (error) {
          console.error("Token validation failed:", error);
          localStorage.removeItem("auth_token");
          setAuthState(initialAuthState);
        }
      }
    };

    initAuth();
  }, []);

  const signIn = useCallback(
    async (data: SignInFormData): Promise<AuthResponse> => {
      setAuthState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const response = await authService.signIn(data);

        if (response.success && response.user && response.token) {
          // Store token
          localStorage.setItem("auth_token", response.token);

          // Update state
          setAuthState({
            isAuthenticated: true,
            user: response.user,
            token: response.token,
            loading: false,
            error: null,
          });
        } else {
          setAuthState((prev) => ({
            ...prev,
            loading: false,
            error: response.error || "Sign in failed",
          }));
        }

        return response;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred";
        setAuthState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));

        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    [],
  );

  const signUp = useCallback(
    async (data: SignUpFormData): Promise<AuthResponse> => {
      setAuthState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const response = await authService.signUp(data);

        if (response.success && response.user && response.token) {
          // Store token
          localStorage.setItem("auth_token", response.token);

          // Update state
          setAuthState({
            isAuthenticated: true,
            user: response.user,
            token: response.token,
            loading: false,
            error: null,
          });
        } else {
          setAuthState((prev) => ({
            ...prev,
            loading: false,
            error: response.error || "Sign up failed",
          }));
        }

        return response;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred";
        setAuthState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));

        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    [],
  );

  const googleSignIn = useCallback(
    async (data: GoogleAuthData): Promise<AuthResponse> => {
      setAuthState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const response = await authService.googleSignIn(data);

        if (response.success && response.user && response.token) {
          // Store token
          localStorage.setItem("auth_token", response.token);

          // Update state
          setAuthState({
            isAuthenticated: true,
            user: response.user,
            token: response.token,
            loading: false,
            error: null,
          });
        } else {
          setAuthState((prev) => ({
            ...prev,
            loading: false,
            error: response.error || "Google sign in failed",
          }));
        }

        return response;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred";
        setAuthState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));

        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    [],
  );

  const connectWallet = useCallback(
    async (
      wallet: WalletType,
      blockchain: BlockchainType = "solana",
    ): Promise<AuthResponse> => {
      setAuthState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const response = await walletService.connectWallet(wallet, blockchain);

        if (response.success && response.user && response.token) {
          // Store token
          localStorage.setItem("auth_token", response.token);

          // Update state
          setAuthState({
            isAuthenticated: true,
            user: response.user,
            token: response.token,
            loading: false,
            error: null,
          });
        } else {
          setAuthState((prev) => ({
            ...prev,
            loading: false,
            error: response.error || "Wallet connection failed",
          }));
        }

        return response;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred";
        setAuthState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));

        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    [],
  );

  const disconnectWallet = useCallback(
    (address: string): void => {
      walletService.disconnectWallet(address);

      // Update user's wallet list
      if (authState.user?.wallets) {
        const updatedWallets = authState.user.wallets.filter(
          (w) => w.address !== address,
        );
        setAuthState((prev) => ({
          ...prev,
          user: prev.user ? { ...prev.user, wallets: updatedWallets } : null,
        }));
      }
    },
    [authState.user],
  );

  const signOut = useCallback((): void => {
    // Clear stored token
    localStorage.removeItem("auth_token");

    // Call sign out service
    authService.signOut();

    // Reset state
    setAuthState(initialAuthState);
  }, []);

  const contextValue: AuthContextType = {
    authState,
    signIn,
    signUp,
    signOut,
    connectWallet,
    disconnectWallet,
    googleSignIn,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const useAuthState = (): AuthState => {
  const { authState } = useAuth();
  return authState;
};
