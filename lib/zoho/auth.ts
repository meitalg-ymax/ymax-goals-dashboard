// Zoho OAuth: this is a separate Self Client credential from the Claude MCP
// connector -- the MCP proxy URL in .mcp.json only works for Claude's own
// tool-calling, not for a server calling Zoho's REST API directly.
//
// Zoho rate-limits the token endpoint itself (separate from API call limits),
// so this caches the access token in module scope -- a sync run makes many
// paginated COQL calls, and fetching a fresh token per call was enough to
// trip "You have made too many requests continuously." The cache also
// survives across warm serverless invocations, which is a bonus, not a
// requirement (a cold start just refetches).
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export async function getZohoAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.ZOHO_CLIENT_ID!,
    client_secret: process.env.ZOHO_CLIENT_SECRET!,
    refresh_token: process.env.ZOHO_REFRESH_TOKEN!,
  });

  const res = await fetch("https://accounts.zoho.com/oauth/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Zoho token refresh failed: ${JSON.stringify(data)}`);
  }

  // expires_in is seconds (3600 typically); refresh 5 minutes early to be safe.
  cachedToken = {
    accessToken: data.access_token as string,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };
  return cachedToken.accessToken;
}
