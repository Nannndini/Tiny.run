import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      NODE_ENV: "test",
      PORT: "4000",
      DATABASE_URL: "postgresql://tiny:tiny@127.0.0.1:5434/tinyrun",
    },
  },
});

