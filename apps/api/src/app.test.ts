import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { prisma } from "./db.js";

const app = createApp();
const testPrefix = `test-${Date.now()}`;

describe("GET /links", () => {
  it("lists links with click counts and pagination", async () => {
    const alias = `list-${Date.now()}`;

    await request(app).post("/links").send({
      url: "https://example.com",
      alias,
    });

    await request(app).get(`/${alias}`).set("User-Agent", "List-Test-Agent");

    const response = await request(app).get("/links?page=1&limit=20");

    expect(response.status).toBe(200);
    expect(response.body.links).toBeInstanceOf(Array);
    expect(response.body.pagination.page).toBe(1);
    expect(response.body.pagination.limit).toBe(20);

    const listedLink = response.body.links.find(
      (link: { shortCode: string }) => link.shortCode === alias,
    );

    expect(listedLink).toBeDefined();
    expect(listedLink.originalUrl).toBe("https://example.com");
    expect(listedLink.totalClicks).toBe(1);
    expect(listedLink.expiresAt).toBeNull();
  });

  it("rejects invalid pagination parameters", async () => {
    const response = await request(app).get("/links?page=0&limit=20");

    expect(response.status).toBe(400);
  });

  it("rejects a limit greater than 100", async () => {
    const response = await request(app).get("/links?page=1&limit=101");

    expect(response.status).toBe(400);
  });
});

describe("PATCH /links/:shortCode", () => {
  it("updates the destination URL", async () => {
    const alias = `${testPrefix}-update-url`;

    await request(app).post("/links").send({
      url: "https://example.com",
      alias,
    });

    const response = await request(app)
      .patch(`/links/${alias}`)
      .send({ url: "https://google.com" });

    expect(response.status).toBe(200);
    expect(response.body.originalUrl).toBe("https://google.com");
    expect(response.body.shortCode).toBe(alias);
  });

  it("sets and removes the expiration date", async () => {
    const alias = `${testPrefix}-update-expiry`;

    await request(app).post("/links").send({
      url: "https://example.com",
      alias,
    });

    const expiration = new Date(Date.now() + 86_400_000).toISOString();

    const setResponse = await request(app)
      .patch(`/links/${alias}`)
      .send({ expiresAt: expiration });

    expect(setResponse.status).toBe(200);
    expect(new Date(setResponse.body.expiresAt).toISOString()).toBe(expiration);

    const removeResponse = await request(app)
      .patch(`/links/${alias}`)
      .send({ expiresAt: null });

    expect(removeResponse.status).toBe(200);
    expect(removeResponse.body.expiresAt).toBeNull();
  });

  it("rejects an expiration date in the past", async () => {
    const alias = `${testPrefix}-past-expiry`;

    const createResponse = await request(app).post("/links").send({
      url: "https://example.com",
      alias,
    });

    expect(createResponse.status).toBe(201);

    const response = await request(app)
      .patch(`/links/${alias}`)
      .send({
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      });

    expect(response.status).toBe(400);
  });

  it("rejects an empty update", async () => {
    const alias = `${testPrefix}-update-empty`;

    await request(app).post("/links").send({
      url: "https://example.com",
      alias,
    });

    const response = await request(app).patch(`/links/${alias}`).send({});

    expect(response.status).toBe(400);
  });

  it("rejects an invalid URL", async () => {
    const alias = `${testPrefix}-update-invalid`;

    await request(app).post("/links").send({
      url: "https://example.com",
      alias,
    });

    const response = await request(app)
      .patch(`/links/${alias}`)
      .send({ url: "not-a-url" });

    expect(response.status).toBe(400);
  });

  it("returns 404 for a missing link", async () => {
    const response = await request(app)
      .patch(`/links/${testPrefix}-update-missing`)
      .send({ url: "https://google.com" });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /links/:shortCode", () => {
  it("deletes a link and its click events", async () => {
    const alias = `${testPrefix}-delete`;

    await request(app).post("/links").send({
      url: "https://example.com",
      alias,
    });

    await request(app).get(`/${alias}`);

    const beforeDelete = await prisma.link.findUnique({
      where: { shortCode: alias },
      include: { clicks: true },
    });

    expect(beforeDelete).not.toBeNull();
    expect(beforeDelete!.clicks).toHaveLength(1);

    const response = await request(app).delete(`/links/${alias}`);

    expect(response.status).toBe(200);
    expect(response.body.shortCode).toBe(alias);

    const deletedLink = await prisma.link.findUnique({
      where: { shortCode: alias },
    });

    expect(deletedLink).toBeNull();

    const remainingClicks = await prisma.clickEvent.count({
      where: { linkId: beforeDelete!.id },
    });

    expect(remainingClicks).toBe(0);
  });

  it("returns 404 when deleting a missing link", async () => {
    const response = await request(app).delete(
      `/links/${testPrefix}-delete-missing`,
    );

    expect(response.status).toBe(404);
  });
});

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
    expect(response.body.shortUrl).toBe(`http://localhost:4000/${alias}`);
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
    const response = await request(app).get(`/${testPrefix}-missing`);

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

    const response = await request(app).get(`/links/${alias}/analytics`);

    expect(response.status).toBe(200);
    expect(response.body.shortCode).toBe(alias);
    expect(response.body.originalUrl).toBe("https://example.com");
    expect(response.body.totalClicks).toBe(1);
    expect(response.body.recentClicks).toHaveLength(1);
    expect(response.body.recentClicks[0].referrer).toBe("https://google.com");
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
