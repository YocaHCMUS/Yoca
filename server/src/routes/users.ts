// server/src/routes/users.ts
import { AUTHEN_COOKIE_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import { authAccounts, users } from "@sv/db/schema.js";
import {
  googleTokenSchema,
  userCreationSchema,
  userVerificationSchema,
  validate,
} from "@sv/middlewares/validation.js";
import { messageText } from "@sv/util/responses.js";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { OAuth2Client } from "google-auth-library";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { jwt, sign } from "hono/jwt";

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

async function setAuthToken(c: any, userId: string) {
  const token = await sign(
    {
      id: userId,
      exp: Math.floor(Date.now() + AUTHEN_COOKIE_TTL_MS) / 1000, // 7 days
    },
    jwtSecret,
  );
  setCookie(c, "auth_token", token, {
    secure: true,
    httpOnly: true,
    sameSite: "None",
    maxAge: AUTHEN_COOKIE_TTL_MS / 1000,
  });
  return token;
}

const app = new Hono()
  .use(
    "/example/of/protected/url/*",
    jwt({
      alg: "HS256",
      secret: process.env.JWT_SECRET!,
      cookie: "auth_token",
    }),
  )
  .get("/example/of/protected/url/1", async (c) => {
    return c.json("ok you're good", 200);
  })
  .post(
    "/auth/password/register",
    validate("json", userCreationSchema),
    async (c) => {
      try {
        const { email, displayName, password } = c.req.valid("json");

        const [existingPasswordUser] = await db
          .select()
          .from(authAccounts)
          .where(
            and(
              eq(authAccounts.provider, "password"),
              eq(authAccounts.providerUserId, email),
            ),
          )
          .limit(1);

        if (existingPasswordUser) {
          return c.json("Account already existed", 400);
        }

        let userId = "";

        await db.transaction(async (tx) => {
          const [newUser] = await tx
            .insert(users)
            .values({
              email,
              displayName: displayName || null,
            })
            .returning();

          const hashedPassword = await bcrypt.hash(password, 10);

          await tx
            .insert(authAccounts)
            .values({
              userId: newUser.id,
              provider: "password",
              providerUserId: email,
              hashedPassword,
            })
            .returning();

          userId = newUser.id;
        });

        const token = await setAuthToken(c, userId);

        return c.json(
          {
            message: "User created successfully",
            userId,
            token,
          },
          201,
        );
      } catch (err) {
        return c.json("Email or username already existed", 400);
      }
    },
  )
  .post(
    "/auth/password/login",
    validate("json", userVerificationSchema),
    async (c) => {
      const { email, password } = c.req.valid("json");

      const [passwordUser] = await db
        .select()
        .from(authAccounts)
        .where(
          and(
            eq(authAccounts.provider, "password"),
            eq(authAccounts.providerUserId, email),
          ),
        )
        .limit(1);

      if (!passwordUser) {
        return c.json("Email or password was incorrect", 401);
      }

      const passwordMatched = await bcrypt.compare(
        password,
        passwordUser.hashedPassword!,
      );

      if (!passwordMatched) {
        return c.json("Email or password was incorrect", 401);
      }

      const token = await setAuthToken(c, passwordUser.userId);

      return c.json(
        {
          message: "Logged-in Successfully",
          userId: passwordUser.userId,
          token,
        },
        200,
      );
    },
  )
  .post("/auth/google", validate("json", googleTokenSchema), async (c) => {
    try {
      const { token: googleToken } = c.req.valid("json");

      // Verify Google ID Token
      const payload = await verifyGoogleToken(googleToken);

      if (!payload) {
        return c.json("Could not verify Google account", 400);
      }

      const googleId = payload.sub;

      const [googleUser] = await db
        .select()
        .from(authAccounts)
        .where(
          and(
            eq(authAccounts.provider, "google"),
            eq(authAccounts.providerUserId, googleId),
          ),
        )
        .limit(1);

      let userId = "";

      if (googleUser) {
        userId = googleUser.userId;
      } else {
        // Create user if not exist
        await db.transaction(async (tx) => {
          const [newUser] = await tx.insert(users).values({}).returning();

          await tx.insert(authAccounts).values({
            provider: "google",
            userId: newUser.id,
            providerUserId: googleId,
          });

          userId = newUser.id;
        });
      }

      const token = await setAuthToken(c, userId);

      return c.json(
        {
          message: "Google Logged-in Successfully",
          userId,
          token,
        },
        200,
      );
    } catch (err) {
      console.error(err);
      return c.json(messageText.InternalServerError, 500);
    }
  })
  .delete("/auth/logout", async (c) => {
    deleteCookie(c, "auth_token");
    return c.json("Logged out successfully", 200);
  });

// // Wallet auth (MetaMask / EVM)
// .post("/wallet-auth", async (c) => {
//   const { address, blockchain, walletType } = await c.req.json();

//   if (!address)
//     return c.json({ success: false, error: "Thiếu địa chỉ ví" }, 400);

//   try {
//     // Tìm user có chứa địa chỉ ví trong mảng walletAddress (text[])
//     let [user] = await db
//       .select()
//       .from(users)
//       .where(sql`${address} = ANY(${users.walletAddress})`);

//     if (!user) {
//       // Nếu chưa có -> ĐĂNG KÝ (Tạo user mới)
//       const username = `web3_${address.slice(0, 6)}_${Math.floor(Math.random() * 1000)}`;
//       [user] = await db
//         .insert(users)
//         .values({
//           email: `${address}@wallet.io`,
//           username,
//           password: null,
//           walletAddress: [address],
//         })
//         .returning();
//     } else {
//       // Nếu đã có user nhưng chưa chứa địa chỉ ví này, thêm vào mảng
//       const hasAddress = Array.isArray(user.walletAddress)
//         ? user.walletAddress.includes(address)
//         : false;
//       if (!hasAddress) {
//         const [updated] = await db
//           .update(users)
//           .set({
//             walletAddress: sql`array_append(${users.walletAddress}, ${address})`,
//           })
//           .where(eq(users.id, user.id))
//           .returning();
//         if (updated) user = updated;
//       }
//     }

//     // ĐĂNG NHẬP (Tạo JWT)
//     const token = await sign({ id: user.id }, JWT_SECRET);
//     return c.json({
//       success: true,
//       user,
//       token,
//       message: "Xác thực ví thành công",
//     });
//   } catch (err) {
//     console.error(err);
//     return c.json({ success: false, error: "Lỗi xử lý xác thực ví" }, 500);
//   }
// });

export default app;
