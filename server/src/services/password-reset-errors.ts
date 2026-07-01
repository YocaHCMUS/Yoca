export type PasswordResetFailure =
  | "INVALID_CODE"
  | "EXPIRED_CODE"
  | "TOO_MANY_ATTEMPTS";

export class PasswordResetError extends Error {
  constructor(public readonly reason: PasswordResetFailure) {
    super(reason);
    this.name = "PasswordResetError";
  }
}
