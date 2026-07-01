import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/httpError";
import { env } from "../config/env";

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler = (error: Error, _req: Request, res: Response, _next: NextFunction): void => {
  const statusCode = error instanceof HttpError ? error.statusCode : 500;

  res.status(statusCode).json({
    error: {
      message: error.message,
      ...(env.nodeEnv === "development" ? { stack: error.stack } : {})
    }
  });
};
