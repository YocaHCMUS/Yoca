// server/src/routes/users.ts
import {
  AUTH_COOKIE_NAME,
  AUTHEN_COOKIE_TTL_MS,
} from "@sv/config/constants.js";
import { setErr } from "@sv/config/errors.js";
import {
  ethereumNounceRequestSchema,
  ethereumVerificationRequestSchema,
  googleTokenSchema,
  solanaNounceRequestSchema,
  solanaVerificationRequestSchema,
  userCreationSchema,
  userVerificationSchema,
  validate,
} from "@sv/middlewares/validation.js";
import * as userService from "@sv/services/users.js";
import { messageText, statusCode } from "@sv/util/responses.js";
import { OAuth2Client } from "google-auth-library";
import { Hono, type Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { sign } from "hono/jwt";

const jwtSecret = process.env.JWT_SECRET!;
const googleClientId = process.env.GOOGLE_CLIENT_ID!;
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

async function setAuthToken(c: Context, userId: string) {
  const token = await sign(
    {
      id: userId,
      exp: Math.floor(Date.now() + AUTHEN_COOKIE_TTL_MS) / 1000,
    },
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
  // .use(
  //   "/example/of/protected/url/*",
  //   jwt({
  //     alg: "HS256",
  //     secret: process.env.JWT_SECRET!,
  //     cookie: AUTH_COOKIE_NAME,
  //   }),
  // )
  // .get("/example/of/protected/url/1", async (c) => {
  //   return c.json("ok you're good", statusCode.Ok);
  // })
  // .get("/hello", (c) => c.json("oke usre", 200))
  .post(
    "/auth/password/register",
    // (c, next) => {
    //   if ((c as any)["hello"]) {
    //     return c.json("hello", statusCode.BadRequest);
    //   }
    //   return next();
    // },
    validate("json", userCreationSchema),
    async (c) => {
      try {
        const { email, displayName, password }: any = c.req.param;
        const existingPasswordUser = await userService.findUserByEmail(email);
        if (existingPasswordUser) {
          return c.json(setErr("EMAIL_ALREADY_EXISTED"), statusCode.BadRequest);
        }
        const userId = await userService.createUserWithPassword(
          email,
          displayName || null,
          password,
        );
        const token = await setAuthToken(c, userId);
        return c.json(
          {
            message: messageText.UserCreatedSuccessfully,
            userId,
            token,
          },
          statusCode.Created,
        );
      } catch (error) {
        return c.json(
          setErr("INTERNAL_SERVER_ERR"),
          statusCode.InternalServerError,
        );
      }
    },
  )
  .post(
    "/auth/password/login",
    validate("json", userVerificationSchema),
    async (c) => {
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
      const token = await setAuthToken(c, passwordUser.userId);
      return c.json(
        {
          message: messageText.LoggedInSuccessfully,
          userId: passwordUser.userId,
          token,
        },
        statusCode.Ok,
      );
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
      let userId = "";
      if (googleUser) {
        userId = googleUser.userId;
      } else {
        userId = await userService.createUserWithGoogle(googleId);
      }
      const token = await setAuthToken(c, userId);
      return c.json(
        {
          message: messageText.GoogleLoggedInSuccessfully,
          userId,
          token,
        },
        statusCode.Ok,
      );
    } catch (err) {
      console.error(err);
      return c.json(
        setErr("INTERNAL_SERVER_ERR"),
        statusCode.InternalServerError,
      );
    }
  })
  .post(
    "/auth/solana/nounce",
    validate("json", solanaNounceRequestSchema),
    async (c) => {
      const { pubKey } = c.req.valid("json");

      const existingWalletUser =
        await userService.findUserByWalletAddress(pubKey);

      if (existingWalletUser) {
        const nounce = await userService.updateWalletLoginNounce(
          existingWalletUser.userId,
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
    },
  )
  .post(
    "/auth/solana/verify",
    validate("json", solanaVerificationRequestSchema),
    async (c) => {
      const { pubKey, signature } = c.req.valid("json");

      const account = await userService.verifyWalletLoginNounce(
        pubKey,
        signature,
      );

      if (!account) {
        return c.json(setErr("EMAIL_ALREADY_EXISTED"), statusCode.BadRequest);
      }

      const token = await setAuthToken(c, account.userId);

      return c.json(
        {
          message: messageText.WalletVerifiedSuccessfully,
          userId: account.userId,
          token,
        },
        201,
      );
    },
  )
  .post(
    "/auth/ethereum/nounce",
    validate("json", ethereumNounceRequestSchema),
    async (c) => {
      const { address } = c.req.valid("json");
      const normalizedAddress = address.toLowerCase();

      const existingWalletUser =
        await userService.findUserByEthereumAddress(normalizedAddress);

      if (existingWalletUser) {
        const nounce = await userService.updateEthereumWalletLoginNounce(
          existingWalletUser.userId,
        );
        return c.json(
          {
            signMessage: userService.getEthereumLoginMessage(
              nounce,
              normalizedAddress,
            ),
            nounce,
          },
          statusCode.Ok,
        );
      }

      const { nounce } =
        await userService.createUserWithEthereumWallet(normalizedAddress);
      return c.json(
        {
          signMessage: userService.getEthereumLoginMessage(
            nounce,
            normalizedAddress,
          ),
          nounce,
        },
        statusCode.Created,
      );
    },
  )
  .post(
    "/auth/ethereum/verify",
    validate("json", ethereumVerificationRequestSchema),
    async (c) => {
      const { address, signature } = c.req.valid("json");
      const normalizedAddress = address.toLowerCase();

      const account = await userService.verifyEthereumWalletLoginNounce(
        normalizedAddress,
        signature,
      );

      if (!account) {
        return c.json(
          setErr("WALLET_VERIFICATION_FAILED"),
          statusCode.BadRequest,
        );
      }

      const token = await setAuthToken(c, account.userId);

      return c.json(
        {
          error: messageText.WalletVerifiedSuccessfully,
          userId: account.userId,
          token,
        },
        statusCode.Created,
      );
    },
  )
  .delete("/auth/logout", async (c) => {
    deleteCookie(c, AUTH_COOKIE_NAME);
    return c.json(messageText.LoggedOutSuccessfully, statusCode.Ok);
  });

export default app;
