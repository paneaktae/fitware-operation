import { auth } from "@/lib/auth";
export async function POST(req: Request) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.DEMO_MODE !== "true" ||
    req.headers.get("origin") !== new URL(process.env.APP_URL ?? req.url).origin
  )
    return new Response("Unavailable", { status: 403 });
  return auth.api.signInEmail({
    body: {
      email: process.env.ADMIN_EMAIL!,
      password: process.env.ADMIN_PASSWORD!,
    },
    headers: req.headers,
    asResponse: true,
  });
}
