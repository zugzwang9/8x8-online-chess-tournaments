import axios from "axios";

export interface LichessAccount {
  id: string;
  username: string;
  perfs?: {
    bullet?: { rating?: number };
    blitz?: { rating?: number };
    rapid?: { rating?: number };
  };
}

interface LichessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

const lichessApi = axios.create({
  baseURL: "https://lichess.org",
  timeout: 10000,
  headers: {
    Accept: "application/json"
  }
});

export const exchangeCodeForToken = async (params: {
  code: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
}): Promise<string> => {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    code_verifier: params.codeVerifier,
    client_id: params.clientId,
    redirect_uri: params.redirectUri
  });

  const response = await lichessApi.post<LichessTokenResponse>("/api/token", body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    }
  });

  return response.data.access_token;
};

export const fetchCurrentAccount = async (accessToken: string): Promise<LichessAccount> => {
  const response = await lichessApi.get<LichessAccount>("/api/account", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  return response.data;
};
