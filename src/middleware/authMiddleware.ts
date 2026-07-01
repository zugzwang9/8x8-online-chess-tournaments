import type { NextFunction, Request, Response } from "express";
import { verifySessionToken } from "../services/tokenService";
import { HttpError } from "../utils/httpError";

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  let token = "";

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice("Bearer ".length);
  } else {
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      const cookies = cookieHeader.split("; ");
      const sessionCookie = cookies.find((c) => c.startsWith("session="));
      if (sessionCookie) {
        // slice past "session=" rather than split("=")[1] — JWT values
        // contain "=" padding characters that split() would silently truncate.
        token = sessionCookie.slice("session=".length);
      }
    }
  }

  if (!token) {
    next(new HttpError(401, "Missing session token."));
    return;
  }

  try {
    req.user = verifySessionToken(token);
    next();
  } catch {
    next(new HttpError(401, "Invalid or expired session token."));
  }
};

export const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  requireAuth(req, _res, async (err) => {
    if (err) {
      next(err);
      return;
    }
    try {
      const { prisma } = await import("../config/prisma");
      const user = await prisma.user.findUnique({
        where: { id: req.user!.sub },
        select: { isAdmin: true }
      });
      if (!user?.isAdmin) {
        next(new HttpError(403, "Admin privileges required."));
        return;
      }
      next();
    } catch {
      next(new HttpError(500, "Failed to verify admin status."));
    }
  });
};
