// server/src/routes/users.ts
import { Hono } from "hono";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { sign, verify } from "hono/jwt";
import { OAuth2Client } from "google-auth-library";

// Env configuration
const JWT_SECRET = process.env.JWT_SECRET || "DEV_SECRET_KEY";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const app = new Hono()
  .onError((err, c) => {
    console.error(`${err}`);
    return c.json({ success: false, error: "Lỗi hệ thống nội bộ" }, 500);
  })

// API Đăng ký
.post("/signup", async (c) => {
  const { email, username, password } = await c.req.json();
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const [newUser] = await db.insert(users).values({
      email,
      username,
      password: hashedPassword,
    }).returning();

    const token = await sign({ id: newUser.id }, JWT_SECRET);
    return c.json({ success: true, user: newUser, token }, 201);
  } catch (err) {
    return c.json({ success: false, error: "Email hoặc Username đã tồn tại" }, 400);
  }
})

// API Đăng nhập
.post("/signin", async (c) => {
  const { usernameOrEmail, password } = await c.req.json();
  
  const [user] = await db.select().from(users).where(
    or(eq(users.email, usernameOrEmail), eq(users.username, usernameOrEmail))
  );

  if (!user || !(await bcrypt.compare(password, user.password!))) {
    return c.json({ success: false, error: "Thông tin đăng nhập không chính xác" }, 401);
  }

  const token = await sign({ id: user.id }, JWT_SECRET);
  return c.json({ success: true, user, token });
})

// Google OAuth Sign-in/Sign-up
.post("/google", async (c) => {
  try {
    const { credential } = await c.req.json();
    if (!credential) {
      return c.json({ success: false, error: "Thiếu mã xác thực Google" }, 400);
    }

    // Verify Google ID Token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID || undefined,
    });
    const payload = ticket.getPayload();

    if (!payload || !payload.sub || !payload.email) {
      return c.json({ success: false, error: "Xác thực Google thất bại" }, 401);
    }

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name || "Google User";
    const usernameBase = (email.split("@")[0] || name.replace(/\s+/g, "")).toLowerCase();

    // Try find existing user by googleId or email
    const [existingByGoogle] = await db.select().from(users).where(eq(users.googleId, googleId));
    let user = existingByGoogle;
    if (!user) {
      const [existingByEmail] = await db.select().from(users).where(eq(users.email, email));
      user = existingByEmail;
    }

    // Create user if not exists
    if (!user) {
      let candidate = usernameBase;
      // Ensure unique username by appending suffix if needed
      let suffix = 0;
      // Try a few times to find an available username
      // (In practice, enforce uniqueness constraint and catch error)
      while (true) {
        const [conflict] = await db.select().from(users).where(eq(users.username, candidate));
        if (!conflict) break;
        suffix += 1;
        candidate = `${usernameBase}_${suffix}`;
      }

      const [newUser] = await db
        .insert(users)
        .values({
          email,
          username: candidate,
          password: null,
          name,
          googleId,
        })
        .returning();

      user = newUser;
    } else if (!user.googleId) {
      // Link Google account if user existed by email
      const [updated] = await db
        .update(users)
        .set({ googleId })
        .where(eq(users.id, user.id))
        .returning();
      user = updated || user;
    }

    const token = await sign({ id: user.id }, JWT_SECRET);
    return c.json({ success: true, user, token });
  } catch (err) {
    console.error("Google OAuth error:", err);
    return c.json({ success: false, error: "Không thể xác thực với Google" }, 500);
  }
})

// Validate JWT token and return user
.post("/validate", async (c) => {
  try {
    // Prefer Authorization header, fallback to JSON body
    const authHeader = c.req.header("Authorization");
    let token: string | undefined;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } else {
      const body = await c.req.json().catch(() => ({}));
      token = body.token;
    }

    if (!token) {
      return c.json({ success: false, error: "Thiếu token" }, 400);
    }

    const payload = await verify(token, JWT_SECRET, 'HS256').catch(() => null);
    if (!payload || typeof payload !== "object" || !("id" in payload)) {
      return c.json({ success: false, error: "Token không hợp lệ" }, 401);
    }

    // Fetch user by id
    const [user] = await db.select().from(users).where(eq(users.id, (payload as any).id));
    if (!user) {
      return c.json({ success: false, error: "Không tìm thấy người dùng" }, 404);
    }

    return c.json({ success: true, user, token });
  } catch (err) {
    console.error("Token validate error:", err);
    return c.json({ success: false, error: "Lỗi xác thực token" }, 500);
  }
})


.post("/wallet-auth", async (c) => {
  const { address, blockchain, walletType } = await c.req.json();

  if (!address) return c.json({ success: false, error: "Thiếu địa chỉ ví" }, 400);

  try {
    // 1. Tìm xem ví này đã liên kết với user nào chưa (giả sử có bảng user_wallets hoặc cột trong users)
    // Ở đây tôi ví dụ tìm trong bảng users có cột walletAddress
    let [user] = await db.select().from(users).where(eq(users.walletAddress, address));

    if (!user) {
      // 2. Nếu chưa có -> ĐĂNG KÝ (Tạo user mới)
      const username = `web3_${address.slice(0, 6)}_${Math.floor(Math.random() * 1000)}`;
      [user] = await db.insert(users).values({
        username,
        email: `${address}@wallet.io`, // Email giả hoặc cho phép null
        walletAddress: address,
        // password để null vì login qua ví
      }).returning();
    }

    // 3. ĐĂNG NHẬP (Tạo JWT)
    const token = await sign({ id: user.id }, JWT_SECRET);
    return c.json({ 
      success: true, 
      user, 
      token,
      message: "Xác thực ví thành công" 
    });
  } catch (err) {
    console.error(err);
    return c.json({ success: false, error: "Lỗi xử lý xác thực ví" }, 500);
  }
});

export default app;