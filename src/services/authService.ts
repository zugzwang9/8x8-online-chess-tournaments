import crypto from "node:crypto";
import { env } from "../config/env";
import { exchangeCodeForToken, fetchCurrentAccount, type LichessAccount } from "./lichessService";
import { signOAuthState, verifyOAuthState } from "./tokenService";
import { HttpError } from "../utils/httpError";

const base64UrlEncode = (buffer: Buffer): string =>
  buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const createCodeVerifier = (): string => base64UrlEncode(crypto.randomBytes(64));

const createCodeChallenge = (codeVerifier: string): string =>
  base64UrlEncode(crypto.createHash("sha256").update(codeVerifier).digest());

export interface LichessProfile {
  lichessUsername: string;
  bulletRating: number | null;
  blitzRating: number | null;
  rapidRating: number | null;
  rating: number;
}

const mapLichessProfile = (account: LichessAccount): LichessProfile => {
  const bulletRating = account.perfs?.bullet?.rating ?? null;
  const blitzRating = account.perfs?.blitz?.rating ?? null;
  const rapidRating = account.perfs?.rapid?.rating ?? null;
  const availableRatings = [bulletRating, blitzRating, rapidRating].filter((rating): rating is number => rating !== null);

  return {
    lichessUsername: account.username,
    bulletRating,
    blitzRating,
    rapidRating,
    rating: availableRatings.length > 0 ? Math.max(...availableRatings) : 1500
  };
};

export const getLichessAuthUrl = (): string => {
  const codeVerifier = createCodeVerifier();
  const codeChallenge = createCodeChallenge(codeVerifier);
  const state = signOAuthState({
    codeVerifier,
    nonce: crypto.randomUUID()
  });

  const url = new URL("https://lichess.org/oauth");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.lichessClientId);
  url.searchParams.set("redirect_uri", env.lichessRedirectUri);
  url.searchParams.set("scope", "preference:read challenge:write");
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("state", state);

  return url.toString();
};

export const getLichessToken = async (code: string, state?: string): Promise<string> => {
  if (!code || !state) {
    throw new HttpError(400, "Missing Lichess OAuth code or state.");
  }

  const oauthState = verifyOAuthState(state);
  return exchangeCodeForToken({
    code,
    codeVerifier: oauthState.codeVerifier,
    clientId: env.lichessClientId,
    redirectUri: env.lichessRedirectUri
  });
};

export const getLichessProfile = async (token: string): Promise<LichessProfile> => {
  const account = await fetchCurrentAccount(token);
  return mapLichessProfile(account);
};
