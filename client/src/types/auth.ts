/**
 * Authentication Type Definitions
 * Shared types for authentication flows and user management
 */

/**
 * User authentication data
 */
export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  createdAt: Date;
  lastLogin?: Date;
  wallets?: WalletConnection[];
  googleAuth?: boolean;
}

/**
 * Sign-in form data
 */
export interface SignInFormData {
  usernameOrEmail: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Sign-up form data
 */
export interface SignUpFormData {
  email: string;
  username: string;
  password: string;
  retypePassword: string;
  acceptTerms?: boolean;
}

/**
 * Authentication response from API
 */
export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
  error?: string;
}

/**
 * Authentication state
 */
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Wallet connection data
 */
export interface WalletConnection {
  address: string;
  blockchain: BlockchainType;
  walletType: WalletType;
  connected: boolean;
  connectedAt?: Date;
}

/**
 * Supported blockchain types
 * Currently Solana only
 */
export type BlockchainType = 'solana';

/**
 * Supported wallet types
 */
export type WalletType =
  | 'phantom'
  | 'solflare'
  | 'ledger'
  | 'trezor'
  | 'metamask'
  | 'walletconnect'
  | 'other';

/**
 * Wallet info for display
 */
export interface WalletInfo {
  name: string;
  type: WalletType;
  icon: string;
  detected: boolean;
  installUrl?: string;
  blockchain: BlockchainType[];
}

/**
 * Google OAuth response data
 */
export interface GoogleAuthData {
  credential: string;
  clientId: string;
  select_by?: string;
}

/**
 * Authentication context type
 */
export interface AuthContextType {
  authState: AuthState;
  signIn: (data: SignInFormData) => Promise<AuthResponse>;
  signUp: (data: SignUpFormData) => Promise<AuthResponse>;
  signOut: () => void;
  connectWallet: (wallet: WalletType, blockchain: BlockchainType) => Promise<AuthResponse>;
  disconnectWallet: (address: string) => void;
  googleSignIn: (data: GoogleAuthData) => Promise<AuthResponse>;
}

/**
 * Form validation errors
 */
export interface ValidationErrors {
  [field: string]: string | undefined;
}

/**
 * Authentication error types
 */
export enum AuthErrorType {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  USERNAME_TAKEN = 'USERNAME_TAKEN',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  NETWORK_ERROR = 'NETWORK_ERROR',
  WALLET_CONNECTION_FAILED = 'WALLET_CONNECTION_FAILED',
  WALLET_REJECTED = 'WALLET_REJECTED',
  GOOGLE_AUTH_FAILED = 'GOOGLE_AUTH_FAILED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Authentication error
 */
export interface AuthError {
  type: AuthErrorType;
  message: string;
  details?: Record<string, unknown>;
}
