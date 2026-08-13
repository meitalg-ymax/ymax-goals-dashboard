import { getZohoAccessToken } from "./auth";

const COQL_URL = "https://www.zohoapis.com/crm/v6/coql";
const PAGE_SIZE = 200;

// Runs a COQL select_query, paginating with limit/offset until
// info.more_records is false, and returns every row concatenated.
// The caller's query must NOT include its own limit/offset -- this appends them.
export async function runCoqlAll(baseQuery: string): Promise<Record<string, unknown>[]> {
  const accessToken = await getZohoAccessToken();
  const rows: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    const query = `${baseQuery} limit ${PAGE_SIZE} offset ${offset}`;
    const res = await fetch(COQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ select_query: query }),
    });

    // Zoho sometimes returns a genuinely empty body (e.g. a 204, or a range
    // with zero matching rows) instead of the documented {code: "NO_CONTENT"}
    // JSON -- res.json() throws "Unexpected end of JSON input" on that, which
    // otherwise surfaces as a confusing top-level error for a perfectly valid
    // "no results" case (a future date range, an empty day, etc).
    const text = await res.text();
    if (!text) break;
    const body = JSON.parse(text);

    if (!res.ok) {
      // Zoho returns {code: "NO_CONTENT", ...} or similar when the range has no rows left.
      if (body.code === "NO_CONTENT" || body.code === "INVALID_DATA") {
        break;
      }
      throw new Error(`COQL query failed: ${JSON.stringify(body)} -- query: ${query}`);
    }

    const pageRows = (body.data ?? []) as Record<string, unknown>[];
    rows.push(...pageRows);

    if (!body.info?.more_records) break;
    offset += PAGE_SIZE;
  }

  return rows;
}
