import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export interface JwtSessionPayload {
  sub: string;
  lichessUsername: string;
}

export interface OAuthStatePayload {
  codeVerifier: string;
  nonce: string;
}

export const signSessionToken = (payload: JwtSessionPayload): string => {
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"]
  };

  return jwt.sign(payload, env.jwtSecret, options);
};

export const verifySessionToken = (token: string): JwtSessionPayload => {
  return jwt.verify(token, env.jwtSecret) as JwtSessionPayload;
};

export const signOAuthState = (payload: OAuthStatePayload): string => {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "10m" });
};

export const verifyOAuthState = (state: string): OAuthStatePayload => {
  return jwt.verify(state, env.jwtSecret) as OAuthStatePayload;
};
