import { exchangeCodeForTokens } from "../jobberAuth.js";
import { saveJobberTokens } from "../tokenStore.js";

export default async function handler(req, res) {
  try {
    const { code, error } = req.query;

    if (error) {
      return res.status(400).send(`Jobber OAuth error: ${error}`);
    }

    if (!code) {
      return res.status(400).send("Missing Jobber authorization code.");
    }

    const tokens = await exchangeCodeForTokens(code);

    await saveJobberTokens(tokens);

    return res.status(200).send(`
      <h1>Jobber Connected Successfully</h1>
      <p>Tokens were saved securely in Supabase.</p>
      <p>You can close this window.</p>
    `);
  } catch (error) {
    console.error("Jobber OAuth callback failed:", error);

    return res.status(500).send(`
      <h1>Jobber OAuth Callback Failed</h1>
      <p>${error.message}</p>
    `);
  }
}