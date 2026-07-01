import type { JwtSessionPayload } from "../services/tokenService";

declare global {
  namespace Express {
    interface Request {
      user?: JwtSessionPayload;
    }
  }
}

export {};
