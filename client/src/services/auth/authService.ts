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
import client from "@/api/main";

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
// client/src/services/auth/authService.ts
// Tự động xác định API base URL
const API_URL = (() => {
  const domain = import.meta.env.CLIENT_API_DOMAIN as string | undefined;
  if (domain && domain.length > 0) {
    return `${domain.replace(/\/+$/, '')}/api`;
  }
  // Trong môi trường dev, dùng proxy của Vite
  if (import.meta.env.DEV) {
    return '/api';
  }
  // Fallback an toàn khi không có cấu hình
  return 'http://localhost:4000/api';
})();


export const signIn = async (data: SignInFormData): Promise<AuthResponse> => {
  try {
    const response = await fetch(`${API_URL}/users/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        success: false, 
        error: errorData.error || 'Đăng nhập thất bại' 
      };
    }

    return await response.json();
  } catch (error) {
    console.error("Fetch error:", error);
    return { success: false, error: "Không thể kết nối đến máy chủ" };
  }
};
export const signUp = async (data: SignUpFormData): Promise<AuthResponse> => {
  try {
    const response = await fetch(`${API_URL}/users/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    // Thêm kiểm tra response.ok để tránh lỗi "Unexpected end of JSON input"
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        success: false, 
        error: errorData.error || 'Đăng ký thất bại' 
      };
    }

    return await response.json();
  } catch (error) {
    console.error("Signup error:", error);
    return { success: false, error: "Không thể kết nối đến máy chủ" };
  }
};
/**
 * Google OAuth sign-in service (server-backed)
 */
export const googleSignIn = async (data: GoogleAuthData): Promise<AuthResponse> => {
  try {
    // Lấy Google credential từ component (GIS returns `credential`)
    const tokenToSend =
      (data as any).credential || (data as any).token || (data as any).idToken;

    if (!tokenToSend || typeof tokenToSend !== 'string') {
      return {
        success: false,
        error: 'Thiếu thông tin Google credential',
      };
    }

    const resp = await client.api.users.auth.google.$post({
      json: { token: tokenToSend },
    });

    if (resp.ok) {
      const res = await resp.json();
      // Dựa trên lỗi "Property 'user' does not exist", server trả về userId và token
      return {
        success: true,
        user: { id: res.userId } as any, // Ép kiểu hoặc map lại cho đúng định dạng User của bạn
        token: res.token,
      };
    }

    return {
      success: false,
      error: 'Xác thực Google thất bại trên máy chủ',
    };
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể kết nối đến máy chủ',
    };
  }
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
export const validateToken = async (token: string): Promise<AuthResponse> => {
  try {
    const response = await fetch(`${API_URL}/users/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      // Allow server to also accept body token
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.error || 'Token không hợp lệ' };
    }

    return await response.json();
  } catch (error) {
    console.error('Token validate error:', error);
    return { success: false, error: 'Không thể kết nối đến máy chủ' };
  }
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
