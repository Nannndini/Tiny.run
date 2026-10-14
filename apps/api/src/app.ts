
import cors from "cors";
import express from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { HealthResponse } from "@tiny.run/shared";
import { prisma } from "./db.js";

const createLinkSchema = z.object({
  url: z.string().trim().url().max(2048),
  alias: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
});

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get("/health", (_req, res) => {
    const body: HealthResponse = {
      status: "ok",
      service: "tiny.run-api",
    };

    res.status(200).json(body);
  });


  // List short links with pagination and click counts
  app.get("/links", async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      res.status(400).json({
        error: "Page must be positive and limit must be between 1 and 100.",
      });
      return;
    }

    try {
      const [total, links] = await prisma.$transaction([
        prisma.link.count(),
        prisma.link.findMany({
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            _count: {
              select: { clicks: true },
            },
          },
        }),
      ]);

      res.status(200).json({
        links: links.map((link) => ({
          id: link.id,
          originalUrl: link.originalUrl,
          shortCode: link.shortCode,
          shortUrl: `http://localhost:4000/${link.shortCode}`,
          createdAt: link.createdAt,
          expiresAt: link.expiresAt,
          totalClicks: link._count.clicks,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Failed to list short links:", error);
      res.status(500).json({ error: "Unable to list short links." });
    }
  });

  // Create a short link
  app.post("/links", async (req, res) => {
    const parsed = createLinkSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Please provide a valid URL and optional alias.",
        details: parsed.error.flatten(),
      });
      return;
    }

    const { url, alias } = parsed.data;
    const originalUrl = url;
    const shortCode = alias ?? randomBytes(5).toString("hex");

    try {
      const link = await prisma.link.create({
        data: {
          originalUrl,
          shortCode,
        },
      });

      res.status(201).json({
        id: link.id,
        originalUrl: link.originalUrl,
        shortCode: link.shortCode,
        shortUrl: `http://localhost:4000/${link.shortCode}`,
        createdAt: link.createdAt,
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        res.status(409).json({
          error: "That short alias is already taken. Please choose another.",
        });
        return;
      }

      console.error("Failed to create short link:", error);
      res.status(500).json({ error: "Unable to create short link." });
    }
  });

  // Get analytics for a short link

  // Update a short link
  const updateLinkSchema = z
    .object({
      url: z.string().trim().url().max(2048).optional(),
      expiresAt: z
        .union([z.string().datetime(), z.null()])
        .optional(),
    })
    .refine(
      (data) => data.url !== undefined || data.expiresAt !== undefined,
      { message: "Provide a URL or expiration date to update." },
    );

  // Delete a short link
  app.delete("/links/:shortCode", async (req, res) => {
    try {
      const link = await prisma.link.findUnique({
        where: { shortCode: req.params.shortCode },
      });

      if (!link) {
        res.status(404).json({ error: "Short link not found." });
        return;
      }

      await prisma.link.delete({
        where: { shortCode: req.params.shortCode },
      });

      res.status(200).json({
        message: "Short link deleted successfully.",
        shortCode: link.shortCode,
      });
    } catch (error) {
      console.error("Failed to delete short link:", error);
      res.status(500).json({ error: "Unable to delete short link." });
    }
  });

  app.patch("/links/:shortCode", async (req, res) => {
    const parsed = updateLinkSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Provide a valid URL or expiration date.",
        details: parsed.error.flatten(),
      });
      return;
    }

    try {
      const existingLink = await prisma.link.findUnique({
        where: { shortCode: req.params.shortCode },
      });

      if (!existingLink) {
        res.status(404).json({ error: "Short link not found." });
        return;
      }

      const link = await prisma.link.update({
        where: { shortCode: req.params.shortCode },
        data: {
          ...(parsed.data.url !== undefined && {
            originalUrl: parsed.data.url,
          }),
          ...(parsed.data.expiresAt !== undefined && {
            expiresAt:
              parsed.data.expiresAt === null
                ? null
                : new Date(parsed.data.expiresAt),
          }),
        },
      });

      res.status(200).json({
        id: link.id,
        originalUrl: link.originalUrl,
        shortCode: link.shortCode,
        shortUrl: `http://localhost:4000/${link.shortCode}`,
        createdAt: link.createdAt,
        expiresAt: link.expiresAt,
      });
    } catch (error) {
      console.error("Failed to update short link:", error);
      res.status(500).json({ error: "Unable to update short link." });
    }
  });

  app.get("/links/:shortCode/analytics", async (req, res) => {
    try {
      const link = await prisma.link.findUnique({
        where: {
          shortCode: req.params.shortCode,
        },
        include: {
          _count: {
            select: {
              clicks: true,
            },
          },
          clicks: {
            orderBy: {
              clickedAt: "desc",
            },
            take: 10,
            select: {
              clickedAt: true,
              referrer: true,
              userAgent: true,
            },
          },
        },
      });

      if (!link) {
        res.status(404).json({ error: "Short link not found." });
        return;
      }

      res.status(200).json({
        shortCode: link.shortCode,
        originalUrl: link.originalUrl,
        totalClicks: link._count.clicks,
        recentClicks: link.clicks,
      });
    } catch (error) {
      console.error("Failed to fetch link analytics:", error);
      res.status(500).json({ error: "Unable to fetch link analytics." });
    }
  });

  // Redirect to the original URL and record the click
  app.get("/:shortCode", async (req, res) => {
    try {
      const link = await prisma.link.findUnique({
        where: {
          shortCode: req.params.shortCode,
        },
      });

      if (!link) {
        res.status(404).json({ error: "Short link not found." });
        return;
      }

      if (link.expiresAt && link.expiresAt <= new Date()) {
        res.status(410).json({ error: "This short link has expired." });
        return;
      }

      await prisma.clickEvent.create({
        data: {
          linkId: link.id,
          referrer: req.get("referer") ?? null,
          userAgent: req.get("user-agent") ?? null,
        },
      });

      res.redirect(302, link.originalUrl);
    } catch (error) {
      console.error("Failed to resolve short link:", error);
      res.status(500).json({ error: "Unable to resolve short link." });
    }
  });

  return app;
}
