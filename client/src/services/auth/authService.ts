/**
 * Mock Authentication Service
 * Simulates authentication API calls with realistic delays and responses
 */

import type {
  SignInFormData,
  SignUpFormData,
  AuthResponse,
  User,
  GoogleAuthData,
  AuthErrorType,
} from '../../types/auth';

/**
 * Mock delay to simulate network latency (ms)
 */
const MOCK_DELAY = 1000;

/**
 * Mock user database
 */
const mockUsers: User[] = [
  {
    id: '1',
    username: 'demo',
    email: 'demo@yoca.com',
    createdAt: new Date('2024-01-01'),
    lastLogin: new Date(),
  },
  {
    id: '2',
    username: 'testuser',
    email: 'test@example.com',
    createdAt: new Date('2024-01-15'),
    lastLogin: new Date(),
  },
];

/**
 * Simulates API delay
 */
const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Mock sign-in service
 * @param data Sign-in form data
 * @returns Authentication response
 */
export const signIn = async (data: SignInFormData): Promise<AuthResponse> => {
  await delay(MOCK_DELAY);

  // Simulate validation
  if (!data.usernameOrEmail || !data.password) {
    return {
      success: false,
      error: 'Username/email and password are required',
    };
  }

  // Find user by username or email
  const user = mockUsers.find(
    (u) =>
      u.username === data.usernameOrEmail || u.email === data.usernameOrEmail
  );

  // Simulate invalid credentials
  if (!user || data.password !== 'password123') {
    return {
      success: false,
      error: 'Invalid credentials. Please check your username/email and password.',
    };
  }

  // Successful authentication
  return {
    success: true,
    user: {
      ...user,
      lastLogin: new Date(),
    },
    token: `mock-token-${user.id}-${Date.now()}`,
    message: 'Sign in successful',
  };
};

/**
 * Mock sign-up service
 * @param data Sign-up form data
 * @returns Authentication response
 */
export const signUp = async (data: SignUpFormData): Promise<AuthResponse> => {
  await delay(MOCK_DELAY);

  // Simulate validation
  if (!data.email || !data.username || !data.password) {
    return {
      success: false,
      error: 'All fields are required',
    };
  }

  // Check if email already exists
  const emailExists = mockUsers.some((u) => u.email === data.email);
  if (emailExists) {
    return {
      success: false,
      error: 'Email already registered. Please use a different email or sign in.',
    };
  }

  // Check if username already exists
  const usernameExists = mockUsers.some((u) => u.username === data.username);
  if (usernameExists) {
    return {
      success: false,
      error: 'Username is already taken. Please choose a different username.',
    };
  }

  // Password strength check
  if (data.password.length < 8) {
    return {
      success: false,
      error: 'Password must be at least 8 characters long.',
    };
  }

  // Create new user
  const newUser: User = {
    id: `${mockUsers.length + 1}`,
    username: data.username,
    email: data.email,
    createdAt: new Date(),
    lastLogin: new Date(),
  };

  // Add to mock database
  mockUsers.push(newUser);

  // Successful registration
  return {
    success: true,
    user: newUser,
    token: `mock-token-${newUser.id}-${Date.now()}`,
    message: 'Account created successfully',
  };
};

/**
 * Mock Google OAuth sign-in service
 * @param data Google authentication data
 * @returns Authentication response
 */
export const googleSignIn = async (
  data: GoogleAuthData
): Promise<AuthResponse> => {
  await delay(MOCK_DELAY);

  // Simulate validation
  if (!data.credential) {
    return {
      success: false,
      error: 'Google authentication failed. Please try again.',
    };
  }

  // Simulate Google user creation/login
  const googleUser: User = {
    id: 'google-user-1',
    username: 'google_user',
    email: 'user@gmail.com',
    createdAt: new Date(),
    lastLogin: new Date(),
    googleAuth: true,
  };

  return {
    success: true,
    user: googleUser,
    token: `mock-google-token-${Date.now()}`,
    message: 'Google sign in successful',
  };
};

/**
 * Mock sign-out service
 */
export const signOut = async (): Promise<void> => {
  await delay(300);
  // Clear any stored tokens or session data
  localStorage.removeItem('auth_token');
};

/**
 * Mock token validation service
 * @param token Authentication token
 * @returns User data if token is valid
 */
export const validateToken = async (
  token: string
): Promise<AuthResponse> => {
  await delay(500);

  // Simple mock validation - check if token format is correct
  if (!token || !token.startsWith('mock-token-') && !token.startsWith('mock-google-token-')) {
    return {
      success: false,
      error: 'Invalid or expired token',
    };
  }

  // Return mock user for valid token
  const user = mockUsers[0]; // Return first user for demo
  return {
    success: true,
    user,
    token,
  };
};

/**
 * Get error message for authentication error type
 */
export const getAuthErrorMessage = (errorType: AuthErrorType): string => {
  const errorMessages: Record<AuthErrorType, string> = {
    INVALID_CREDENTIALS: 'Invalid username/email or password',
    USER_NOT_FOUND: 'User not found',
    EMAIL_ALREADY_EXISTS: 'Email is already registered',
    USERNAME_TAKEN: 'Username is already taken',
    WEAK_PASSWORD: 'Password does not meet security requirements',
    NETWORK_ERROR: 'Network error. Please check your connection and try again.',
    WALLET_CONNECTION_FAILED: 'Failed to connect wallet',
    WALLET_REJECTED: 'Wallet connection was rejected',
    GOOGLE_AUTH_FAILED: 'Google authentication failed',
    UNKNOWN_ERROR: 'An unexpected error occurred',
  };

  return errorMessages[errorType] || errorMessages.UNKNOWN_ERROR;
};
