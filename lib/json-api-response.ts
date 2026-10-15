export type JsonApiRead<T> = {
  data: T | null;
  error: string | null;
  status: number;
  contentType: string;
};

/**
 * Read an application API response without assuming an intermediary returned
 * JSON. Hosting proxies and authentication redirects can otherwise turn an
 * HTML error page into an uncaught `Unexpected token '<'` browser error.
 */
export async function readJsonApiResponse<T>(response: Response): Promise<JsonApiRead<T>> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const raw = await response.text();
  if (!contentType.includes("application/json")) {
    const html = /^\s*<(?:!doctype|html|head|body)\b/i.test(raw);
    return {
      data: null,
      error: html
        ? `BubsBookings received an unexpected HTML response (HTTP ${response.status}).`
        : `BubsBookings received an unexpected response (HTTP ${response.status}).`,
      status: response.status,
      contentType,
    };
  }
  try {
    return { data: JSON.parse(raw) as T, error: null, status: response.status, contentType };
  } catch {
    return { data: null, error: `BubsBookings received invalid API data (HTTP ${response.status}).`, status: response.status, contentType };
  }
}
