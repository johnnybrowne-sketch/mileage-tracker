const JOBBER_TOKEN_URL = "https://api.getjobber.com/api/oauth/token";

export function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

export async function exchangeCodeForTokens(code) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: getRequiredEnv("JOBBER_CLIENT_ID"),
    client_secret: getRequiredEnv("JOBBER_CLIENT_SECRET"),
    code,
    redirect_uri: getRequiredEnv("JOBBER_CALLBACK_URL"),
  });

  const response = await fetch(JOBBER_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const json = await response.json();

  if (!response.ok) {
    console.error("Jobber token exchange failed:", json);
    throw new Error("Jobber token exchange failed");
  }

  return json;
}

export async function refreshJobberToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: getRequiredEnv("JOBBER_CLIENT_ID"),
    client_secret: getRequiredEnv("JOBBER_CLIENT_SECRET"),
    refresh_token: refreshToken,
  });

  const response = await fetch(JOBBER_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const json = await response.json();

  if (!response.ok) {
    console.error("Jobber token refresh failed:", json);
    throw new Error("Jobber token refresh failed");
  }

  return json;
}