import {
  forgotPasswordSchema,
  resetPasswordSchema,
  validate,
} from "@sv/middlewares/validation.js";
import { PasswordResetError } from "@sv/services/password-reset-errors.js";
import * as userService from "@sv/services/users.js";
import { serverErr, setErr } from "@sv/util/errors.js";
import { statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";

const FORGOT_PASSWORD_MESSAGE =
  "If this email exists, a reset code has been sent.";

const app = new Hono()
  .post(
    "/forgot-password",
    validate("json", forgotPasswordSchema),
    async (c) => {
      try {
        const { email } = c.req.valid("json");
        await userService.requestPasswordReset(email);

        return c.json(
          {
            message: FORGOT_PASSWORD_MESSAGE,
          },
          statusCode.Ok,
        );
      } catch (e) {
        return serverErr(c, e);
      }
    },
  )
  .post(
    "/reset-password",
    validate("json", resetPasswordSchema),
    async (c) => {
      try {
        const { email, code, newPassword } = c.req.valid("json");
        await userService.resetPasswordWithCode({
          email,
          code,
          newPassword,
        });

        return c.json(
          {
            message: "Password has been reset successfully.",
          },
          statusCode.Ok,
        );
      } catch (e) {
        if (e instanceof PasswordResetError) {
          if (e.reason === "EXPIRED_CODE") {
            return c.json(
              setErr("PASSWORD_RESET_CODE_EXPIRED"),
              statusCode.BadRequest,
            );
          }

          if (e.reason === "TOO_MANY_ATTEMPTS") {
            return c.json(
              setErr("PASSWORD_RESET_ATTEMPTS_EXCEEDED"),
              statusCode.TooManyRequests,
            );
          }

          return c.json(
            setErr("PASSWORD_RESET_CODE_INVALID"),
            statusCode.BadRequest,
          );
        }

        return serverErr(c, e);
      }
    },
  );

export default app;
export type AuthAppType = typeof app;
