"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/common";
export default function LoginForm({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      if (!r.ok)
        throw new Error("Unable to sign in. Check your email and password.");
      router.push("/dashboard");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function openDemo() {
    setBusy(true);
    try {
      const r = await fetch("/api/demo-login", { method: "POST" });
      if (!r.ok) throw new Error("Local demo sign-in is unavailable.");
      router.push("/dashboard");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <section className="login-story">
        <div className="brand">
          <Dumbbell />
          <span>
            fitware<span className="brand-dot">.</span>
          </span>
        </div>
        <div>
          <div className="eyebrow">BUILT AROUND YOUR INVENTORY</div>
          <h1>
            Good equipment.
            <br />
            Better decisions.
          </h1>
          <p>
            Your machines, advertising, and customers.
            <br />
            One focused workspace to move your business forward.
          </p>
        </div>
        <span className="login-foot">USED EQUIPMENT. RENEWED POTENTIAL.</span>
      </section>
      <section className="login-form">
        <div className="eyebrow">YOUR BUSINESS WORKSPACE</div>
        <h2>Welcome back</h2>
        <p>Sign in to Fitware Sales & Ads.</p>
        <form onSubmit={submit}>
          <Field label="Email">
            <input
              name="email"
              type="email"
              autoComplete="username"
              defaultValue={demo ? "owner@fitware.local" : ""}
              required
            />
          </Field>
          <Field label="Password">
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <Button disabled={busy} type="submit">
            {busy ? "Signing in…" : "Sign in"}
            <ArrowRight size={17} />
          </Button>
        </form>
        {demo && (
          <Button variant="outline" disabled={busy} onClick={openDemo}>
            Explore local demo
            <ArrowRight size={17} />
          </Button>
        )}
        <small>
          <ShieldCheck size={15} /> Private workspace · administrator access
          only
        </small>
      </section>
    </main>
  );
}
