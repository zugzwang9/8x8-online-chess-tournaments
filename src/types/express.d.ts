import type { JwtSessionPayload } from "../features/auth/token.service";

declare global {
  namespace Express {
    interface Request {
      user?: JwtSessionPayload;
    }
  }
}

export {};
