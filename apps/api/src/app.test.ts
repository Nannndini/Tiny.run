
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { prisma } from "./db.js";

const app = createApp();
const testPrefix = `test-${Date.now()}`;

describe("GET /health", () => {
  it("returns a JSON success response", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/json/);
    expect(response.body).toEqual({
      status: "ok",
      service: "tiny.run-api",
    });
  });
});

describe("POST /links", () => {
  it("creates a short link", async () => {
    const alias = `${testPrefix}-create`;

    const response = await request(app).post("/links").send({
      url: "https://example.com",
      alias,
    });

    expect(response.status).toBe(201);
    expect(response.body.originalUrl).toBe("https://example.com");
    expect(response.body.shortCode).toBe(alias);
    expect(response.body.shortUrl).toBe(
      `http://localhost:4000/${alias}`,
    );
  });

  it("rejects an invalid URL", async () => {
    const response = await request(app).post("/links").send({
      url: "not-a-valid-url",
    });

    expect(response.status).toBe(400);
  });

  it("rejects a duplicate alias", async () => {
    const alias = `${testPrefix}-duplicate`;

    await request(app).post("/links").send({
      url: "https://example.com",
      alias,
    });

    const response = await request(app).post("/links").send({
      url: "https://google.com",
      alias,
    });

    expect(response.status).toBe(409);
  });
});

describe("GET /:shortCode", () => {
  it("redirects and records a click event", async () => {
    const alias = `${testPrefix}-redirect`;

    await request(app).post("/links").send({
      url: "https://example.com",
      alias,
    });

    const response = await request(app)
      .get(`/${alias}`)
      .set("Referer", "https://google.com")
      .set("User-Agent", "TinyRun-Test-Agent");

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("https://example.com");

    const link = await prisma.link.findUnique({
      where: { shortCode: alias },
      include: { clicks: true },
    });

    expect(link).not.toBeNull();
    expect(link!.clicks).toHaveLength(1);
    expect(link!.clicks[0]!.referrer).toBe("https://google.com");
    expect(link!.clicks[0]!.userAgent).toBe("TinyRun-Test-Agent");
  });

  it("returns 404 for a missing short link", async () => {
    const response = await request(app).get(
      `/${testPrefix}-missing`,
    );

    expect(response.status).toBe(404);
  });

  it("returns 410 for an expired short link", async () => {
    const alias = `${testPrefix}-expired`;

    await request(app).post("/links").send({
      url: "https://example.com",
      alias,
    });

    await prisma.link.update({
      where: { shortCode: alias },
      data: {
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const response = await request(app).get(`/${alias}`);

    expect(response.status).toBe(410);
  });
});

describe("GET /links/:shortCode/analytics", () => {
  it("returns click counts and recent click details", async () => {
    const alias = `${testPrefix}-analytics`;

    await request(app).post("/links").send({
      url: "https://example.com",
      alias,
    });

    await request(app)
      .get(`/${alias}`)
      .set("Referer", "https://google.com")
      .set("User-Agent", "Analytics-Test-Agent");

    const response = await request(app).get(
      `/links/${alias}/analytics`,
    );

    expect(response.status).toBe(200);
    expect(response.body.shortCode).toBe(alias);
    expect(response.body.originalUrl).toBe("https://example.com");
    expect(response.body.totalClicks).toBe(1);
    expect(response.body.recentClicks).toHaveLength(1);
    expect(response.body.recentClicks[0].referrer).toBe(
      "https://google.com",
    );
    expect(response.body.recentClicks[0].userAgent).toBe(
      "Analytics-Test-Agent",
    );
  });

  it("returns 404 when analytics are requested for a missing link", async () => {
    const response = await request(app).get(
      `/links/${testPrefix}-missing/analytics`,
    );

    expect(response.status).toBe(404);
  });
});

afterAll(async () => {
  await prisma.link.deleteMany({
    where: {
      shortCode: {
        startsWith: testPrefix,
      },
    },
  });

  await prisma.$disconnect();
});
