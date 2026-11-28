/**
 * E21 21-06 (live on EAD Factory INT, 2026-11-28): the generated fetch client returns the raw `ReadableStream`
 * as `data` when a response carries no Content-Type (EAD Factory answers its 201s that way, with an empty body).
 * A tool must never return that stream as its result: read it, parse JSON when it is JSON, and turn an empty body
 * into `{}`. Anything already parsed passes through unchanged.
 */
export async function normalizeResponseData(
  data: unknown,
  opts: { text?: boolean } = {},
): Promise<unknown> {
  // A text body (operations whose response schema is a plain string ask for text): unquote a JSON string literal.
  // Only then — a string the client decoded from JSON is the real value, quotes included.
  if (typeof data === "string") {
    if (opts.text && data.length >= 2 && data.startsWith('"') && data.endsWith('"')) {
      try {
        return JSON.parse(data) as unknown;
      } catch {
        return data;
      }
    }
    return data;
  }
  // On a 204 the client's 'stream' branch hands back response.body, which is null.
  if (data === null) return {};
  if (!isReadableStream(data)) return data;
  const text = await new Response(data).text();
  if (text.trim() === "") return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function isReadableStream(value: unknown): value is ReadableStream {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { getReader?: unknown }).getReader === "function"
  );
}
