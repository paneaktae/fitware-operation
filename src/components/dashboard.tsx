"use client";
import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Sparkles,
  ArrowUpRight,
  ArrowRight,
  Package,
  Users,
  TrendingUp,
  Wallet,
  TriangleAlert,
  ShieldCheck,
  Plus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { money, number } from "@/lib/format";
import { useData, api, PageTitle, ProductArt } from "./common";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
const TrendChart = dynamic(() => import("./charts"), {
  ssr: false,
  loading: () => <div className="chart skeleton" />,
});
export default function Dashboard({
  onCreate,
}: {
  onCreate: (id?: string) => void;
}) {
  const { data, refresh } = useData();
  const [refreshing, setRefreshing] = useState(false);
  const t = data.totals,
    p = data.previous;
  const best = [...data.campaigns].sort(
    (a, b) => b.revenue - a.revenue || b.qualified - a.qualified,
  )[0];
  const bestItem = data.items.find((i) => i.id === best?.inventoryItemId);
  const active = data.campaigns.filter((c) => c.status === "ACTIVE").length;
  const metrics = [
    {
      title: "Attributed revenue",
      value: money(t.revenue),
      current: t.revenue,
      previous: p.revenue,
      icon: Wallet,
      caption: `${t.sales} recorded sales`,
      good: true,
    },
    {
      title: "Qualified leads",
      value: number(t.qualified),
      current: t.qualified,
      previous: p.qualified,
      icon: Users,
      caption: `of ${t.leads} total enquiries`,
      good: true,
    },
    {
      title: "Ad spend",
      value: money(t.spend),
      current: t.spend,
      previous: p.spend,
      icon: TrendingUp,
      caption: `${active} active campaigns`,
      good: false,
    },
    {
      title: "Return on ad spend",
      value: t.roas ? `${t.roas.toFixed(1)}×` : "—",
      current: t.roas ?? 0,
      previous: p.roas ?? 0,
      icon: ArrowUpRight,
      caption: "Attributed revenue ÷ spend",
      good: true,
    },
  ];
  return (
    <>
      <PageTitle
        eyebrow="A CLEAR VIEW OF YOUR BUSINESS"
        title="Let’s move good equipment."
        description="Your sales and advertising, connected to what’s in stock."
        action={
          <Button onClick={() => onCreate()}>
            <Plus size={17} />
            Create campaign
          </Button>
        }
      />
      <div className="metrics-grid">
        {metrics.map((m, i) => {
          const trend = m.previous
            ? ((m.current - m.previous) / m.previous) * 100
            : null;
          return (
            <article
              key={m.title}
              className={`metric-card ${i === 0 ? "metric-featured" : ""}`}
            >
              <div>
                <span>{m.title}</span>
                <m.icon size={18} />
              </div>
              <strong>{m.value}</strong>
              <div className="metric-footer">
                <span>{m.caption}</span>
                {trend !== null && (
                  <small
                    className={
                      trend >= 0 === m.good ? "trend-good" : "trend-neutral"
                    }
                  >
                    {trend >= 0 ? "+" : ""}
                    {trend.toFixed(0)}%
                  </small>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <p className="metrics-caption">
        Compared with the previous equivalent period · CRM attribution ·
        Thailand time
      </p>
      <div className="dashboard-columns">
        <section className="daily-brief">
          <div className="section-header">
            <div className="inline-group">
              <span className="sparkle-box">
                <Sparkles size={19} />
              </span>
              <h2>Daily business brief</h2>
            </div>
            <span className="tiny-tag">
              {data.aiConfigured ? "DATA SUMMARY" : "DEMO · RULE-BASED"}
            </span>
          </div>
          <div className="brief-intro">
            <div className="eyebrow">THE BIG PICTURE</div>
            <h3>
              {t.sales > 0
                ? "Your best signal is a sale."
                : "Start with the machines you can sell."}
            </h3>
            <p>
              {t.sales > 0
                ? `Your advertising is connected to ${t.sales} recorded sales and ${money(t.revenue)} in revenue. Keep lead quality at the center of your next decision.`
                : "Add leads and record won sales to measure the business value of your campaigns."}
            </p>
          </div>
          {bestItem && best && (
            <div className="best-product">
              <div className="best-product-art">
                <ProductArt item={bestItem} />
              </div>
              <div>
                <span className="eyebrow">STRONGEST ATTRIBUTED REVENUE</span>
                <h3>
                  {bestItem.brand} {bestItem.series} {bestItem.model}
                </h3>
                <p>
                  {best.qualified} qualified · {best.sales} sales ·{" "}
                  {best.roas?.toFixed(1) ?? "—"}× ROAS
                </p>
                <Link href="/campaigns">
                  Review performance <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          )}
          <div className="brief-footer">
            <ShieldCheck size={15} />
            <span>Small sales samples call for careful budget changes.</span>
            <Link href="/advisor">
              Ask AI
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </section>
        <section className="panel action-panel">
          <div className="section-header">
            <h2>Next best actions</h2>
            <button
              className="icon-button"
              aria-label="Refresh recommendations"
              disabled={refreshing}
              onClick={async () => {
                setRefreshing(true);
                try {
                  await api("recommendations/refresh", {});
                  await refresh();
                  toast.success("Recommendations refreshed.");
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setRefreshing(false);
                }
              }}
            >
              <RefreshCw size={15} className={refreshing ? "spin" : ""} />
            </button>
          </div>
          <Recommendations compact onCreate={onCreate} />
        </section>
      </div>
      <div className="dashboard-columns bottom-columns">
        <section className="panel">
          <div className="section-header">
            <div>
              <h2>Advertising rhythm</h2>
              <p>Daily spend · THB</p>
            </div>
            <Link className="text-link" href="/analytics">
              Analytics
              <ArrowUpRight size={15} />
            </Link>
          </div>
          <TrendChart data={data.days} />
          <div className="chart-summary">
            <div>
              <span>Cost / lead</span>
              <strong>{t.cpl ? money(t.cpl) : "—"}</strong>
            </div>
            <div>
              <span>Qualified rate</span>
              <strong>{t.qualifiedRate?.toFixed(0) ?? "—"}%</strong>
            </div>
            <div>
              <span>Messages</span>
              <strong>{t.messages}</strong>
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="section-header">
            <h2>Inventory pulse</h2>
            <Link href="/inventory" className="text-link">
              View all
              <ArrowUpRight size={15} />
            </Link>
          </div>
          {data.items
            .filter((i) => i.status !== "HIDDEN")
            .slice(0, 4)
            .map((i) => (
              <Link href="/inventory" className="inventory-pulse" key={i.id}>
                <span className="pulse-icon">
                  <Package size={19} />
                </span>
                <div>
                  <h3>
                    {i.brand} {i.model}
                  </h3>
                  <p>{money(i.askingPrice)}</p>
                </div>
                <span
                  className={i.quantity === 0 ? "stock-empty" : "stock-label"}
                >
                  {i.quantity - i.reservedQuantity === 0
                    ? "Sold out"
                    : `${i.quantity - i.reservedQuantity} available`}
                </span>
              </Link>
            ))}
          <div className="inventory-value">
            <span>Available stock value</span>
            <strong>
              {money(
                data.items
                  .filter((i) => i.status === "AVAILABLE")
                  .reduce(
                    (a, i) =>
                      a + i.askingPrice * (i.quantity - i.reservedQuantity),
                    0,
                  ),
              )}
            </strong>
          </div>
        </section>
      </div>
    </>
  );
}
export function Recommendations({
  compact = false,
  onCreate,
}: {
  compact?: boolean;
  onCreate: (id?: string) => void;
}) {
  const { data, refresh } = useData();
  const [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const rec = data.recommendations.find((r) => r.id === selected);
  async function decide(id: string, decision: "approve" | "reject") {
    setBusy(true);
    try {
      await api(`recommendations/${id}`, { decision, confirmed });
      const r = data.recommendations.find((r) => r.id === id);
      await refresh();
      setSelected(null);
      toast.success(
        decision === "reject"
          ? "Recommendation ignored."
          : "Recommendation approved.",
      );
      if (
        decision === "approve" &&
        r &&
        ["GENERATE_CREATIVE", "PROMOTE_INVENTORY"].includes(r.type)
      )
        onCreate(r.inventoryItemId ?? undefined);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {data.recommendations.slice(0, compact ? 3 : 30).map((r, i) => (
        <div className="recommendation" key={r.id}>
          <span
            className={`action-number ${r.type.includes("PAUSE") ? "warning-icon" : ""}`}
          >
            {r.type.includes("PAUSE") ? (
              <TriangleAlert size={17} />
            ) : (
              String(i + 1).padStart(2, "0")
            )}
          </span>
          <div>
            <h3>{r.title}</h3>
            <p>{r.description}</p>
            <div className="recommendation-buttons">
              <button
                onClick={() => {
                  setSelected(r.id);
                  setConfirmed(false);
                }}
              >
                Review action
                <ArrowRight size={13} />
              </button>
              <button disabled={busy} onClick={() => decide(r.id, "reject")}>
                Ignore
              </button>
            </div>
          </div>
        </div>
      ))}
      {!data.recommendations.length && (
        <p className="quiet-state">
          You’re up to date. No pending recommendations.
        </p>
      )}
      <Dialog
        open={Boolean(rec)}
        onOpenChange={(o) => !o && setSelected(null)}
        title={rec?.title ?? "Recommendation"}
      >
        {rec && (
          <>
            <p>{rec.description}</p>
            <div className="notice">
              <div>
                <strong>Why this matters</strong>
                <p>{rec.reason}</p>
              </div>
            </div>
            {rec.currentValue !== null && (
              <p>
                {money(rec.currentValue)} →{" "}
                {money(rec.recommendedValue ?? rec.currentValue)} / day
              </p>
            )}
            <label className="check-field">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>
                {["GENERATE_CREATIVE", "PROMOTE_INVENTORY"].includes(rec.type)
                  ? "Open a new campaign brief. It will still require review."
                  : `I approve this change${data.demo ? " to the simulated campaign" : " to the Meta campaign"}.`}
              </span>
            </label>
            <div className="dialog-actions">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => decide(rec.id, "reject")}
              >
                Ignore
              </Button>
              <Button
                disabled={busy || !confirmed}
                onClick={() => decide(rec.id, "approve")}
              >
                {busy ? "Applying…" : "Approve action"}
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
