// server/src/routes/users.ts
import {
  AUTH_COOKIE_NAME,
  AUTHEN_COOKIE_TTL_MS,
} from "@sv/config/constants.js";
import {
  googleTokenSchema,
  solanaNounceRequestSchema,
  solanaVerificationRequestSchema,
  userCreationSchema,
  UserPayload,
  userPayloadSchema,
  userVerificationSchema,
  validate,
} from "@sv/middlewares/validation.js";
import * as userService from "@sv/services/users.js";
import { serverErr, setErr } from "@sv/util/errors.js";
import env from "@sv/util/load-env";
import { messageText, statusCode } from "@sv/util/responses.js";
import { OAuth2Client } from "google-auth-library";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { jwt, sign } from "hono/jwt";

const jwtSecret = env.JWT_SECRET;
const googleClientId = env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(googleClientId);

async function verifyGoogleToken(idToken: string) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: googleClientId,
  });

  const payload = ticket.getPayload();

  if (!payload) {
    return null;
  }

  return payload;
}

async function setAuthToken(
  c: Context,
  userId: string,
  displayName?: string | null,
) {
  const token = await sign(
    {
      id: userId,
      displayName: displayName || null,
      exp: Math.floor(Date.now() + AUTHEN_COOKIE_TTL_MS) / 1000,
    } satisfies UserPayload,
    jwtSecret,
  );
  setCookie(c, AUTH_COOKIE_NAME, token, {
    secure: true,
    httpOnly: true,
    sameSite: "None",
    maxAge: AUTHEN_COOKIE_TTL_MS / 1000,
  });
  return token;
}

const app = new Hono()
  .post(
    "/auth/password/register",
    validate("json", userCreationSchema),
    async (c) => {
      try {
        const { email, displayName, password } = c.req.valid("json");
        const existingPasswordUser = await userService.findUserByEmail(email);
        if (existingPasswordUser) {
          return c.json(setErr("EMAIL_ALREADY_EXISTED"), statusCode.BadRequest);
        }
        const userId = await userService.createUserWithPassword(
          email,
          displayName || null,
          password,
        );
        const token = await setAuthToken(c, userId, displayName);
        return c.json(
          {
            message: messageText.UserCreatedSuccessfully,
            userId,
            token,
          },
          statusCode.Created,
        );
      } catch (e) {
        return serverErr(c, e);
      }
    },
  )
  .post(
    "/auth/password/login",
    validate("json", userVerificationSchema),
    async (c) => {
      try {
        const { email, password } = c.req.valid("json");
        const passwordUser = await userService.verifyUserPassword(
          email,
          password,
        );
        if (!passwordUser) {
          return c.json(
            setErr("EMAIL_OR_PASSWORD_WAS_INCORRECT"),
            statusCode.Unauthorized,
          );
        }
        const user = await userService.getUserById(passwordUser.userId);
        const token = await setAuthToken(
          c,
          passwordUser.userId,
          user?.displayName,
        );
        return c.json(
          {
            message: messageText.LoggedInSuccessfully,
            userId: passwordUser.userId,
            token,
          },
          statusCode.Ok,
        );
      } catch (e) {
        return serverErr(c, e);
      }
    },
  )
  .post("/auth/google", validate("json", googleTokenSchema), async (c) => {
    try {
      const { token: googleToken } = c.req.valid("json");

      // Verify Google ID Token
      const payload = await verifyGoogleToken(googleToken);

      if (!payload) {
        return c.json(
          setErr("GOOGLE_VERIFICATION_FAILED"),
          statusCode.BadRequest,
        );
      }

      const googleId = payload.sub;

      const googleUser = await userService.findUserByGoogleId(googleId);
      let userId: string = "";
      let displayName: string | null = null;
      if (googleUser) {
        userId = googleUser.account.userId;
        displayName = googleUser.user.displayName;
      } else {
        userId = await userService.createUserWithGoogle(googleId);
      }

      const token = await setAuthToken(c, userId, displayName);
      return c.json(
        {
          message: messageText.GoogleLoggedInSuccessfully,
          userId,
          token,
        },
        statusCode.Ok,
      );
    } catch (e) {
      return serverErr(c, e);
    }
  })
  .post(
    "/auth/solana/nounce",
    validate("json", solanaNounceRequestSchema),
    async (c) => {
      try {
        const { pubKey } = c.req.valid("json");

        const existingWalletUser =
          await userService.findUserByWalletAddress(pubKey);

        if (existingWalletUser) {
          const nounce = await userService.updateWalletLoginNounce(
            existingWalletUser.user.id,
          );
          return c.json(
            {
              signMessage: userService.getSolanaLoginMessage(nounce, pubKey),
              nounce,
            },
            statusCode.Ok,
          );
        }

        const { nounce } = await userService.createUserWithWallet(pubKey);
        return c.json(
          {
            signMessage: userService.getSolanaLoginMessage(nounce, pubKey),
            nounce,
          },
          statusCode.Created,
        );
      } catch (e) {
        if (e instanceof Error && e.message == "WALLET_ALREADY_LINKED") {
          return c.json(setErr("WALLET_ALREADY_LINKED"), statusCode.Conflict);
        }

        return serverErr(c, e);
      }
    },
  )
  .post(
    "/auth/solana/verify",
    validate("json", solanaVerificationRequestSchema),
    async (c) => {
      try {
        const { pubKey, signature } = c.req.valid("json");

        const account = await userService.verifyWalletLoginNounce(
          pubKey,
          signature,
        );

        if (!account) {
          return c.json(setErr("EMAIL_ALREADY_EXISTED"), statusCode.BadRequest);
        }

        const token = await setAuthToken(
          c,
          account.user.id,
          account.user.displayName,
        );

        return c.json(
          {
            message: messageText.WalletVerifiedSuccessfully,
            userId: account.user.id,
            token,
          },
          statusCode.Created,
        );
      } catch (e) {
        return serverErr(c, e);
      }
    },
  )
  .delete("/auth/logout", async (c) => {
    try {
      deleteCookie(c, AUTH_COOKIE_NAME);
      return c.json(messageText.LoggedOutSuccessfully, statusCode.Ok);
    } catch (e) {
      return serverErr(c, e);
    }
  })
  .get("/auth/me", async (c) => {
    try {
      const authCookie = getCookie(c, AUTH_COOKIE_NAME);
      if (!authCookie) {
        return c.json(null, statusCode.Ok);
      }

      const optionalJwt = jwt({
        secret: jwtSecret,
        alg: "HS256",
        cookie: AUTH_COOKIE_NAME,
      });
      const jwtResult = await optionalJwt(c, async () => undefined);
      if (jwtResult instanceof Response) {
        return c.json(null, statusCode.Ok);
      }

      // payload is typed as any, currently there is no typesafety for this yet
      const rawPayload = c.get("jwtPayload");

      const parsedPayload = userPayloadSchema.safeParse(rawPayload);
      if (!parsedPayload.success) {
        return c.json(null, statusCode.Ok);
      }

      const user = await userService.getUserById(parsedPayload.data.id);
      if (!user) {
        return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);
      }

      return c.json(
        {
          id: parsedPayload.data.id,
          exp: parsedPayload.data.exp,
          displayName: user.displayName,
        } satisfies UserPayload,
        statusCode.Ok,
      );
    } catch (e) {
      return serverErr(c, e);
    }
  });

export default app;

export type UsersAppType = typeof app;
