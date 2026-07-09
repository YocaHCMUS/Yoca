import "@sv/util/load-env.js";
import authApp from "@sv/routes/auth.js";
import usersApp from "@sv/routes/users.js";
import { PasswordResetError } from "@sv/services/password-reset-errors.js";
import * as userService from "@sv/services/users.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sv/services/users.js", () => ({
  requestPasswordReset: vi.fn(),
  resetPasswordWithCode: vi.fn(),
  verifyUserPassword: vi.fn(),
  getUserById: vi.fn(),
}));

describe("Password reset auth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns generic success for forgot-password requests", async () => {
    vi.mocked(userService.requestPasswordReset).mockResolvedValue(undefined);

    const response = await authApp.request("/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      message: "If this email exists, a reset code has been sent.",
    });
    expect(userService.requestPasswordReset).toHaveBeenCalledWith(
      "test@example.com",
    );
  });

  it("reset fails with a wrong code", async () => {
    vi.mocked(userService.resetPasswordWithCode).mockRejectedValue(
      new PasswordResetError("INVALID_CODE"),
    );

    const response = await authApp.request("/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        code: "123456",
        newPassword: "NewStrongPassword123",
      }),
    });

    expect(response.status).toBe(400);
    expect((await response.json()) as unknown).toEqual({
      errorCode: "PASSWORD_RESET_CODE_INVALID",
    });
  });

  it("reset fails with an expired code", async () => {
    vi.mocked(userService.resetPasswordWithCode).mockRejectedValue(
      new PasswordResetError("EXPIRED_CODE"),
    );

    const response = await authApp.request("/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        code: "123456",
        newPassword: "NewStrongPassword123",
      }),
    });

    expect(response.status).toBe(400);
    expect((await response.json()) as unknown).toEqual({
      errorCode: "PASSWORD_RESET_CODE_EXPIRED",
    });
  });

  it("reset fails after too many attempts", async () => {
    vi.mocked(userService.resetPasswordWithCode).mockRejectedValue(
      new PasswordResetError("TOO_MANY_ATTEMPTS"),
    );

    const response = await authApp.request("/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        code: "123456",
        newPassword: "NewStrongPassword123",
      }),
    });

    expect(response.status).toBe(429);
    expect((await response.json()) as unknown).toEqual({
      errorCode: "PASSWORD_RESET_ATTEMPTS_EXCEEDED",
    });
  });

  it("reset succeeds with a valid code", async () => {
    vi.mocked(userService.resetPasswordWithCode).mockResolvedValue(undefined);

    const response = await authApp.request("/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        code: "123456",
        newPassword: "NewStrongPassword123",
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      message: "Password has been reset successfully.",
    });
  });

  it("allows login with the new password after reset", async () => {
    vi.mocked(userService.resetPasswordWithCode).mockResolvedValue(undefined);
    vi.mocked(userService.verifyUserPassword).mockResolvedValue(
      { userId: "user-id-123" } as Awaited<ReturnType<typeof userService.verifyUserPassword>>
    );
    vi.mocked(userService.getUserById).mockResolvedValue(
      { id: "user-id-123", displayName: "Test User" } as Awaited<ReturnType<typeof userService.getUserById>>
    );

    const resetResponse = await authApp.request("/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        code: "123456",
        newPassword: "NewStrongPassword123",
      }),
    });

    expect(resetResponse.status).toBe(200);

    const loginResponse = await usersApp.request("/auth/password/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "NewStrongPassword123",
      }),
    });

    expect(loginResponse.status).toBe(200);
    const loginData = (await loginResponse.json()) as Record<string, unknown>;
    expect(loginData).toHaveProperty("token");
    expect(loginData.userId).toBe("user-id-123");
  });
});
