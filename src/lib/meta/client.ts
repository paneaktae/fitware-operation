import { createHmac } from "node:crypto";
import { BusinessError } from "../business";
export function metaConfigured() {
  return Boolean(
    process.env.META_ACCESS_TOKEN &&
    process.env.META_APP_SECRET &&
    process.env.META_API_VERSION &&
    process.env.META_AD_ACCOUNT_ID &&
    process.env.META_PAGE_ID,
  );
}
export async function meta<T>(
  path: string,
  method: "GET" | "POST" = "GET",
  values: Record<string, unknown> = {},
): Promise<T> {
  if (!metaConfigured())
    throw new BusinessError(
      "Meta is not configured. Add a token, app secret, account, Page, and supported API version.",
    );
  if (
    !/^[a-zA-Z0-9_/-]+$/.test(path) ||
    !/^v\d+\.\d+$/.test(process.env.META_API_VERSION!)
  )
    throw new BusinessError("Invalid Meta configuration.");
  const token = process.env.META_ACCESS_TOKEN!;
  const params = new URLSearchParams({
    appsecret_proof: createHmac("sha256", process.env.META_APP_SECRET!)
      .update(token)
      .digest("hex"),
  });
  for (const [k, v] of Object.entries(values))
    params.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  const url = `https://graph.facebook.com/${process.env.META_API_VERSION}/${path}`;
  const res = await fetch(method === "GET" ? `${url}?${params}` : url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === "POST"
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
    },
    body: method === "POST" ? params : undefined,
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    console.error("Meta request failed", {
      path,
      code: data.error?.code,
      status: res.status,
    });
    throw new BusinessError(
      data.error?.code === 190
        ? "Meta token expired. Update the server token and retry."
        : "Meta rejected the request. Check account permissions, creative eligibility, and API configuration.",
    );
  }
  return data as T;
}
export const accountId = () =>
  `act_${(process.env.META_AD_ACCOUNT_ID ?? "").replace(/^act_/, "")}`;
