
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
