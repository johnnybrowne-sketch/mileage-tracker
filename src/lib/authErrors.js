export function getFriendlyAuthError(error) {
  const message = error?.message?.toLowerCase() || "";
  const code = error?.code || "";

  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "Please check your email and click the confirmation link before logging in.";
  }

  if (
    message.includes("invalid login credentials") ||
    message.includes("invalid credentials")
  ) {
    return "The email or password is incorrect. Please try again.";
  }

  if (
    code === "over_email_send_rate_limit" ||
    message.includes("rate limit") ||
    message.includes("too many")
  ) {
    return "Too many email requests were sent. Please wait a few minutes before trying again.";
  }

  return error?.message || "Something went wrong. Please try again.";
}