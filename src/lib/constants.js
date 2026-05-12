export const EMBED_BASE =
  "https://propertymanagerassistant.retool.com/embedded/public/4e047f9e-3469-4c4b-92fb-d7caf37ad5d2";

export const AUTH_REDIRECTS = {
  signupConfirmation: `${EMBED_BASE}/login`,
  workerPasswordReset: `${EMBED_BASE}/reset-password?mode=worker`,
  adminPasswordReset: `${EMBED_BASE}/reset-password?mode=admin`,
};