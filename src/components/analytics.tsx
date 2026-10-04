"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Download } from "lucide-react";
import { useData, PageTitle, Badge } from "./common";
import { money, number } from "@/lib/format";
import { Button } from "./ui/button";
const Chart = dynamic(() => import("./charts"), { ssr: false });
export default function Analytics() {
  const { data } = useData();
  const [metric, setMetric] = useState<
      "spend" | "leads" | "qualified" | "cpl" | "revenue" | "roas"
    >("revenue"),
    [group, setGroup] = useState("campaign");
  const rows =
    group === "campaign"
      ? data.campaigns.map((c) => ({ name: c.name, ...pick(c) }))
      : Object.values(
          data.campaigns.reduce(
            (acc, c) => {
              const i = data.items.find((i) => i.id === c.inventoryItemId);
              const name =
                group === "brand"
                  ? (i?.brand ?? "Unknown")
                  : `${i?.brand} ${i?.model}`;
              const previous = acc[name] ?? {
                name,
                spend: 0,
                leads: 0,
                qualified: 0,
                sales: 0,
                revenue: 0,
              };
              acc[name] = {
                name,
                spend: previous.spend + c.spend,
                leads: previous.leads + c.leads,
                qualified: previous.qualified + c.qualified,
                sales: previous.sales + c.sales,
                revenue: previous.revenue + c.revenue,
              };
              return acc;
            },
            {} as Record<
              string,
              {
                name: string;
                spend: number;
                leads: number;
                qualified: number;
                sales: number;
                revenue: number;
              }
            >,
          ),
        );
  function download() {
    const csv = [
      ["Name", "Spend THB", "CRM Leads", "Qualified", "Sales", "Revenue THB"],
      ...rows.map((r) => [
        r.name,
        r.spend / 100,
        r.leads,
        r.qualified,
        r.sales,
        r.revenue / 100,
      ]),
    ]
      .map((row) =>
        row
          .map(
            (v) =>
              `"${String(v)
                .replace(/^[=+@-]/, "'")
                .replaceAll('"', '""')}"`,
          )
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "fitware-performance.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <PageTitle
        eyebrow="FOLLOW THE REVENUE"
        title="Analytics"
        description="See what sells, what qualifies, and where the budget goes."
        action={
          <Button variant="outline" onClick={download}>
            <Download size={16} />
            Export report
          </Button>
        }
      />
      <div className="panel">
        <div className="section-header">
          <div>
            <h2>Performance over time</h2>
            <p>
              {metric === "spend" || metric === "revenue" || metric === "cpl"
                ? "Values in THB"
                : metric === "roas"
                  ? "Revenue / spend"
                  : "CRM records"}
            </p>
          </div>
          <select
            aria-label="Chart metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value as typeof metric)}
          >
            {["revenue", "spend", "leads", "qualified", "cpl", "roas"].map(
              (m) => (
                <option key={m} value={m}>
                  {m === "cpl"
                    ? "Cost per lead"
                    : m === "roas"
                      ? "ROAS"
                      : m[0].toUpperCase() + m.slice(1)}
                </option>
              ),
            )}
          </select>
        </div>
        <Chart data={data.days} metric={metric} />
      </div>
      <div className="section-header standalone">
        <div>
          <h2>Compare business outcomes</h2>
          <p>Revenue and qualified enquiries come before clicks.</p>
        </div>
        <select
          aria-label="Compare by"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
        >
          <option value="campaign">By campaign</option>
          <option value="product">By machine</option>
          <option value="brand">By brand</option>
        </select>
      </div>
      <div className="comparison-list">
        <div className="comparison-head">
          <span>{group}</span>
          <span>Spend</span>
          <span>Leads</span>
          <span>Qualified</span>
          <span>Sales</span>
          <span>Revenue</span>
          <span>ROAS</span>
        </div>
        {rows
          .sort((a, b) => b.revenue - a.revenue)
          .map((r) => (
            <div className="comparison-row" key={r.name}>
              <h3>{r.name}</h3>
              {[
                ["Spend", money(r.spend)],
                ["Leads", number(r.leads)],
                ["Qualified", number(r.qualified)],
                ["Sales", number(r.sales)],
                ["Revenue", money(r.revenue)],
                [
                  "ROAS",
                  r.spend ? `${(r.revenue / r.spend).toFixed(1)}×` : "—",
                ],
              ].map(([l, v]) => (
                <div key={l}>
                  <small>{l}</small>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>
          ))}
      </div>
      <div className="notice">
        <div>
          <strong>How to read these numbers</strong>
          <p>
            Lead counts use CRM creation dates; qualified rate measures those
            leads that have ever qualified. Revenue uses the actual sale date.
            These are operational period totals, not a causal or cohort ROI
            analysis. Platform-reported leads are stored separately and are not
            added to CRM leads.
          </p>
        </div>
      </div>
      <div className="section-header standalone">
        <h2>Creative learning</h2>
        <Badge status="INSUFFICIENT_DATA" />
      </div>
      <p className="muted">
        Campaign-level snapshots are available. Individual creative comparison
        needs ad-level insights and enough attributed sales; this version does
        not infer a winning creative from campaign totals.
      </p>
    </>
  );
}
function pick(c: {
  spend: number;
  leads: number;
  qualified: number;
  sales: number;
  revenue: number;
}) {
  return {
    spend: c.spend,
    leads: c.leads,
    qualified: c.qualified,
    sales: c.sales,
    revenue: c.revenue,
  };
}
