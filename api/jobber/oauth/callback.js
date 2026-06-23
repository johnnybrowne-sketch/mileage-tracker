import { exchangeCodeForTokens } from "../jobberAuth.js";

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

    console.log("JOBBER_ACCESS_TOKEN:", tokens.access_token);
    console.log("JOBBER_REFRESH_TOKEN:", tokens.refresh_token);

    return res.status(200).send(`
      <h1>Jobber Connected Successfully</h1>
      <p>Tokens were generated. Check the Vercel/terminal logs and save JOBBER_REFRESH_TOKEN securely.</p>
      <p>You can close this window.</p>
    `);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Jobber OAuth callback failed.");
  }
}