import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      NODE_ENV: "test",
      RATE_LIMIT_CREATE_MAX: "1000",
      RATE_LIMIT_REDIRECT_MAX: "1000",
      PORT: "4000",
      DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://tiny:tiny@127.0.0.1:5434/tinyrun",
    },
  },
});



