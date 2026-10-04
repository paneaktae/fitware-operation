"use client";
import { useState } from "react";
import {
  PlugZap,
  ShieldCheck,
  RefreshCw,
  History,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useData, api, PageTitle, Field, Badge } from "./common";
import { Button } from "./ui/button";
import { localDate, label } from "@/lib/format";
export default function Settings() {
  const { data, refresh } = useData();
  const [busy, setBusy] = useState(false),
    [audit, setAudit] = useState<
      | {
          id: string;
          actor: string;
          action: string;
          entity: string;
          createdAt: string;
          before: unknown;
          after: unknown;
        }[]
      | null
    >(null);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await api(
        "settings",
        {
          companyName: f.get("companyName"),
          currency: "THB",
          timezone: "Asia/Bangkok",
          defaultCountry: f.get("defaultCountry"),
        },
        "PATCH",
      );
      await refresh();
      toast.success("Business settings saved.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function sync() {
    setBusy(true);
    try {
      const r = await api<{ message: string }>("sync", {});
      await refresh();
      toast.success(r.message);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="SET UP FOR YOUR BUSINESS"
        title="Settings & integrations"
        description="Your business defaults, connections, and activity history."
      />
      <div className="settings-grid">
        <section className="panel">
          <div className="section-header">
            <h2>Business details</h2>
          </div>
          <form onSubmit={save}>
            <Field label="Company name">
              <input
                name="companyName"
                defaultValue={data.settings?.companyName ?? "Fitware Used"}
                required
              />
            </Field>
            <Field label="Currency">
              <input value="THB · Thai baht" readOnly />
            </Field>
            <Field label="Timezone">
              <input value="Asia/Bangkok · UTC+7" readOnly />
            </Field>
            <Field label="Default country">
              <select
                name="defaultCountry"
                defaultValue={data.settings?.defaultCountry ?? "TH"}
              >
                <option value="TH">Thailand</option>
                <option value="SG">Singapore</option>
                <option value="MY">Malaysia</option>
                <option value="US">United States</option>
              </select>
            </Field>
            <Button disabled={busy}>Save settings</Button>
          </form>
        </section>
        <div className="settings-stack">
          <section className="panel">
            <div className="section-header">
              <h2>
                <PlugZap size={18} />
                Meta Ads
              </h2>
              <Badge
                status={
                  data.demo
                    ? "DEMO"
                    : data.metaConfigured
                      ? "CONFIGURED"
                      : "DISCONNECTED"
                }
              />
            </div>
            <p>
              {data.demo
                ? "Demo mode is enabled. Campaigns and metrics are simulated."
                : "Meta credentials are configured on the server and never sent to your browser."}
            </p>
            <dl className="detail-list">
              <div>
                <dt>Last successful sync</dt>
                <dd>
                  {data.integration?.lastSync
                    ? localDate(data.integration.lastSync)
                    : "Not synced"}
                </dd>
              </div>
              <div>
                <dt>Scheduled sync</dt>
                <dd>Hourly when deployed with cron</dd>
              </div>
            </dl>
            {data.integration?.lastError && (
              <p className="error-message">{data.integration.lastError}</p>
            )}
            <Button disabled={busy} variant="outline" onClick={sync}>
              <RefreshCw size={16} />
              {busy ? "Syncing…" : "Sync performance"}
            </Button>
            <p className="caption">
              Live mode requires a Meta ad account, Page, approved image, app
              secret, access token and API version in server configuration.
            </p>
          </section>
          <section className="panel">
            <div className="section-header">
              <h2>OpenAI</h2>
              <Badge status={data.aiConfigured ? "CONFIGURED" : "DEMO"} />
            </div>
            <p>
              {data.aiConfigured
                ? "Server-side Responses API with validated campaign output and read-only business tools."
                : "No API key configured. Demo copy templates and calculated analyst summaries remain available."}
            </p>
            <a
              className="text-link"
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noreferrer"
            >
              OpenAI Platform
              <ExternalLink size={14} />
            </a>
          </section>
          <section className="panel">
            <div className="section-header">
              <h2>
                <ShieldCheck size={18} />
                Workspace safety
              </h2>
            </div>
            <p>
              Administrator only. New campaigns are paused. Budget and status
              changes require confirmation and are audited.
            </p>
            <p>
              Media storage:{" "}
              <strong>
                {data.storage === "local"
                  ? "Local development storage"
                  : "Vercel Blob"}
              </strong>
            </p>
            <p className="caption">
              Demo mode is a server setting. Switching to live mode requires a
              separate, unseeded database so demo records cannot be mistaken for
              business data.
            </p>
          </section>
        </div>
      </div>
      <section className="panel audit-panel">
        <div className="section-header">
          <h2>
            <History size={18} />
            Audit history
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                setAudit(await api("audit", undefined, "GET"));
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Load latest activity
          </Button>
        </div>
        {audit === null ? (
          <p className="muted">
            Review who changed campaign spending, inventory, lead stages, or
            revenue.
          </p>
        ) : audit.length ? (
          audit.map((a) => (
            <details key={a.id} className="audit-row">
              <summary>
                <strong>{label(a.action)}</strong>
                <span>
                  {a.actor} · {localDate(a.createdAt)}
                </span>
              </summary>
              <pre>
                {JSON.stringify({ before: a.before, after: a.after }, null, 2)}
              </pre>
            </details>
          ))
        ) : (
          <p>No activity recorded yet.</p>
        )}
      </section>
    </>
  );
}
