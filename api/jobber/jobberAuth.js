const JOBBER_TOKEN_URL = "https://api.getjobber.com/api/oauth/token";

export function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

async function parseJobberTokenResponse(response) {
  const text = await response.text();

  let json = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    console.error("Jobber token response failed:", json);
    throw new Error(
      json.error_description ||
        json.error ||
        json.message ||
        json.raw ||
        "Jobber token request failed"
    );
  }

  return json;
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

  return parseJobberTokenResponse(response);
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

  return parseJobberTokenResponse(response);
}