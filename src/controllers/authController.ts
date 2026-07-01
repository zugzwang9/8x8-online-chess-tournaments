import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { getLichessAuthUrl, getLichessProfile, getLichessToken } from "../services/authService";
import { signSessionToken } from "../services/tokenService";
import { env } from "../config/env";
import { HttpError } from "../utils/httpError";

export const lichessLogin = async (_req: Request, res: Response): Promise<void> => {
  res.redirect(getLichessAuthUrl());
};

export const lichessCallback = async (req: Request, res: Response): Promise<void> => {
  const code = req.query.code?.toString();
  const state = req.query.state?.toString();

  if (!code) {
    throw new HttpError(400, "Missing Lichess OAuth code.");
  }

  const lichessAccessToken = await getLichessToken(code, state);
  const profile = await getLichessProfile(lichessAccessToken);

  const user = await prisma.user.upsert({
    where: {
      lichessUsername: profile.lichessUsername
    },
    create: {
      lichessUsername: profile.lichessUsername,
      lichessAccessToken,
      rating: profile.rating,
      bulletRating: profile.bulletRating,
      blitzRating: profile.blitzRating,
      rapidRating: profile.rapidRating
    },
    update: {
      lichessAccessToken,
      rating: profile.rating,
      bulletRating: profile.bulletRating,
      blitzRating: profile.blitzRating,
      rapidRating: profile.rapidRating
    }
  });

  const token = signSessionToken({
    sub: user.id,
    lichessUsername: user.lichessUsername
  });
  res.cookie("session", token, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  // Completes OAuth flow, provisions user session, and redirects to frontend.
  // Auth is carried entirely by the httpOnly session cookie — no token in the URL.
  const redirectUrl = `${env.corsOrigin}/#tournaments`;
  res.redirect(redirectUrl);
};

export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new HttpError(401, "Not authenticated.");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: req.user.sub
    },
    select: {
      id: true,
      lichessUsername: true,
      rating: true,
      bulletRating: true,
      blitzRating: true,
      rapidRating: true,
      isBot: true,
      isAdmin: true,
      bio: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!user) {
    throw new HttpError(404, "Authenticated user not found.");
  }

  res.json({ user });
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  res.clearCookie("session");
  res.status(200).json({ ok: true });
};
