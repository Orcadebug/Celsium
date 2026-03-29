export function validateCliCallbackUrl(input: string): URL {
  const url = new URL(input);
  const allowedHosts = new Set(["127.0.0.1", "localhost"]);

  if (!allowedHosts.has(url.hostname)) {
    throw new Error("callback_url must point to localhost or 127.0.0.1");
  }

  if (url.protocol !== "http:") {
    throw new Error("callback_url must use http");
  }

  return url;
}

export function buildCliCallbackUrl(
  callbackUrl: string,
  payload: { state: string; token: string; projectId: string }
): string {
  const url = validateCliCallbackUrl(callbackUrl);
  url.searchParams.set("state", payload.state);
  url.searchParams.set("token", payload.token);
  url.searchParams.set("project_id", payload.projectId);
  return url.toString();
}
