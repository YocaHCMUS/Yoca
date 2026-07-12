import { describe, expect, it, vi, beforeEach } from "vitest";
type JsonObject = Record<string, unknown>;

vi.mock("@sv/util/load-env.js", () => ({
  default: { JWT_SECRET: "test-secret", GOOGLE_CLIENT_ID: "test-client-id" },
}));

import app from "@sv/routes/users.js";
import * as userService from "@sv/services/users.js";

// Mock the user service
vi.mock("@sv/services/users.js", () => ({
  findUserByEmail: vi.fn(),
  createUserWithPassword: vi.fn(),
  verifyUserPassword: vi.fn(),
  getUserById: vi.fn(),
  findUserByGoogleId: vi.fn(),
  createUserWithGoogle: vi.fn(),
  findUserByWalletAddress: vi.fn(),
  updateWalletLoginNounce: vi.fn(),
  createUserWithWallet: vi.fn(),
  getSolanaLoginMessage: vi.fn((nounce, pubKey) => `Sign this message to login: ${nounce} for ${pubKey}`),
  verifyWalletLoginNounce: vi.fn(),
}));

// Mock Google Auth Library
vi.mock("google-auth-library", () => {
  return {
    OAuth2Client: class {
      verifyIdToken = vi.fn().mockResolvedValue({
        getPayload: () => ({
          sub: "mock-google-id",
          email: "mock-google@example.com",
          name: "Mock Google User",
        }),
      });
    },
  };
});

describe("Hono User Auth Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /auth/password/register", () => {
    it("should successfully register a new password user", async () => {
      vi.mocked(userService.findUserByEmail).mockResolvedValue(null as never);
      vi.mocked(userService.createUserWithPassword).mockResolvedValue("user-id-123");

      const response = await app.request("/auth/password/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          displayName: "Test User",
          password: "SecurePassword123!",
        }),
      });

      expect(response.status).toBe(201);
      const data = (await response.json()) as JsonObject;
      expect(data).toHaveProperty("userId", "user-id-123");
      expect(data).toHaveProperty("token");
      expect(userService.createUserWithPassword).toHaveBeenCalledWith(
        "test@example.com",
        "Test User",
        "SecurePassword123!"
      );
    });

    it("should return 400 Bad Request if email already exists", async () => {
      vi.mocked(userService.findUserByEmail).mockResolvedValue({ id: "user-id-123" } as never);

      const response = await app.request("/auth/password/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          displayName: "Test User",
          password: "SecurePassword123!",
        }),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as JsonObject;
      expect(data.errorCode).toBe("EMAIL_ALREADY_EXISTED");
    });
  });

  describe("POST /auth/password/login", () => {
    it("should login successfully with correct credentials", async () => {
      vi.mocked(userService.verifyUserPassword).mockResolvedValue({ userId: "user-id-123" } as never);
      vi.mocked(userService.getUserById).mockResolvedValue({ id: "user-id-123", displayName: "Test User" } as never);

      const response = await app.request("/auth/password/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          password: "SecurePassword123!",
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("userId", "user-id-123");
      expect(data).toHaveProperty("token");
    });

    it("should return 401 Unauthorized for incorrect credentials", async () => {
      vi.mocked(userService.verifyUserPassword).mockResolvedValue(null);

      const response = await app.request("/auth/password/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          password: "SecurePassword123!",
        }),
      });

      expect(response.status).toBe(401);
      const data = (await response.json()) as JsonObject;
      expect(data.errorCode).toBe("EMAIL_OR_PASSWORD_WAS_INCORRECT");
    });
  });

  describe("POST /auth/google", () => {
    it("should log in or create a user with Google Token", async () => {
      vi.mocked(userService.findUserByGoogleId).mockResolvedValue(null as never); // Register flow
      vi.mocked(userService.createUserWithGoogle).mockResolvedValue("user-id-google");

      const response = await app.request("/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "valid-google-id-token",
        }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as JsonObject;
      expect(data).toHaveProperty("userId", "user-id-google");
      expect(data).toHaveProperty("token");
    });
  });

  describe("POST /auth/solana/nounce", () => {
    it("should return a login challenge for existing wallet user", async () => {
      vi.mocked(userService.findUserByWalletAddress).mockResolvedValue({
        user: { id: "user-id-123" }
      } as never);
      vi.mocked(userService.updateWalletLoginNounce).mockResolvedValue("new-nounce-123" as never);

      const response = await app.request("/auth/solana/nounce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pubKey: "6BCvxUZXhi73HDeoe5metBKWEd5AFmPHNZHTQ98dF2dr",
        }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as JsonObject;
      expect(data.nounce).toBe("new-nounce-123");
      expect(data.signMessage).toContain("new-nounce-123");
    });

    it("should create a user challenge for new wallet", async () => {
      vi.mocked(userService.findUserByWalletAddress).mockResolvedValue(null as never);
      vi.mocked(userService.createUserWithWallet).mockResolvedValue({
        userId: "user-id-new",
        nounce: "new-wallet-nounce",
      } as never);

      const response = await app.request("/auth/solana/nounce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pubKey: "6BCvxUZXhi73HDeoe5metBKWEd5AFmPHNZHTQ98dF2dr",
        }),
      });

      expect(response.status).toBe(201);
      const data = (await response.json()) as JsonObject;
      expect(data.nounce).toBe("new-wallet-nounce");
    });
  });

  describe("POST /auth/solana/verify", () => {
    it("should return JWT token on successful signature verification", async () => {
      vi.mocked(userService.verifyWalletLoginNounce).mockResolvedValue({
        user: { id: "user-id-123", displayName: "Wallet User" }
      } as never);

      const response = await app.request("/auth/solana/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pubKey: "6BCvxUZXhi73HDeoe5metBKWEd5AFmPHNZHTQ98dF2dr",
          signature: "bW9jay1zaWduYXR1cmU=", // Valid base64
        }),
      });

      expect(response.status).toBe(201);
      const data = (await response.json()) as JsonObject;
      expect(data).toHaveProperty("token");
      expect(data.userId).toBe("user-id-123");
    });
  });
});

