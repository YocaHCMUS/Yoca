// server/src/routes/users.ts
import { Hono } from "hono";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { sign } from "hono/jwt";

const app = new Hono();

app.onError((err, c) => {
  console.error(`${err}`);
  return c.json({ success: false, error: "Lỗi hệ thống nội bộ" }, 500);
});

// API Đăng ký
app.post("/signup", async (c) => {
  const { email, username, password } = await c.req.json();
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const [newUser] = await db.insert(users).values({
      email,
      username,
      password: hashedPassword,
    }).returning();

    const token = await sign({ id: newUser.id }, "YOUR_SECRET_KEY");
    return c.json({ success: true, user: newUser, token }, 201);
  } catch (err) {
    return c.json({ success: false, error: "Email hoặc Username đã tồn tại" }, 400);
  }
});

// API Đăng nhập
app.post("/signin", async (c) => {
  const { usernameOrEmail, password } = await c.req.json();
  
  const [user] = await db.select().from(users).where(
    or(eq(users.email, usernameOrEmail), eq(users.username, usernameOrEmail))
  );

  if (!user || !(await bcrypt.compare(password, user.password!))) {
    return c.json({ success: false, error: "Thông tin đăng nhập không chính xác" }, 401);
  }

  const token = await sign({ id: user.id }, "YOUR_SECRET_KEY");
  return c.json({ success: true, user, token });
});

export default app;