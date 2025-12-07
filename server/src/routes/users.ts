import { userSchema, validate } from "@/middlewares/validation.js";
import { Hono } from "hono";

const app = new Hono()
  // Add a new user
  .post("/", validate("json", userSchema), async (c) => {
    const user = c.req.valid("json");
    // TODO: Implement actual user creation logic

    // - Hash password using bcrypt or similar
    // - Store user in database
    // - Generate authentication token
    // - Send verification email

    // Demo response - don't expose password
    return c.json(
      {
        message: "User created successfully",
        user: {
          email: user.email,
        },
      },
      201,
    );
  });

export default app;
