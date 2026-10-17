import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { rateLimit } from "./rate-limit.js";

function createMockClient(counts: number[], failure?: Error) {
  let index = 0;
  return {
    status: "ready",
    connect: vi.fn(async () => undefined),
    eval: vi.fn(async () => {
      if (failure) throw failure;
      const count = counts[Math.min(index++, counts.length - 1)]!;
      return [count, 30_000];
    }),
  };
}

describe("rateLimit", () => {
  it("allows requests within the configured limit", async () => {
    const client = createMockClient([1]);
    const app = express();
    app.get(
      "/limited",
      rateLimit({ windowMs: 60_000, max: 2, keyPrefix: "test" }, client),
      (_req, res) => res.status(200).json({ ok: true }),
    );

    const response = await request(app).get("/limited");

    expect(response.status).toBe(200);
    expect(response.headers["ratelimit-limit"]).toBe("2");
    expect(response.headers["ratelimit-remaining"]).toBe("1");
    expect(client.eval).toHaveBeenCalledTimes(1);
  });

  it("returns 429 and Retry-After when the limit is exceeded", async () => {
    const client = createMockClient([3]);
    const app = express();
    app.get(
      "/limited",
      rateLimit({ windowMs: 60_000, max: 2, keyPrefix: "test" }, client),
      (_req, res) => res.status(200).json({ ok: true }),
    );

    const response = await request(app).get("/limited");

    expect(response.status).toBe(429);
    expect(response.headers["retry-after"]).toBe("30");
    expect(response.body.error).toMatch(/too many requests/i);
  });

  it("returns 503 if Redis fails instead of allowing an unprotected request", async () => {
    const client = createMockClient([], new Error("Redis unavailable"));
    const app = express();
    app.get(
      "/limited",
      rateLimit({ windowMs: 60_000, max: 2, keyPrefix: "test" }, client),
      (_req, res) => res.status(200).json({ ok: true }),
    );

    const response = await request(app).get("/limited");

    expect(response.status).toBe(503);
    expect(response.body.error).toMatch(/rate limiting is temporarily unavailable/i);
  });
});
