"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  Plus,
  Search,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
  Pause,
  Play,
  TrendingUp,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import type { ClientReport } from "@/lib/data";
import { strategySchema } from "@/lib/schemas";
import { money, number, label } from "@/lib/format";
import { useData, api, Badge, Empty, Field, PageTitle } from "./common";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
type Campaign = ClientReport["campaigns"][number];
export default function Campaigns({
  onCreate,
}: {
  onCreate: (id?: string) => void;
}) {
  const { data, refresh } = useData();
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("ALL"),
    [quality, setQuality] = useState("ALL"),
    [product, setProduct] = useState("ALL"),
    [selected, setSelected] = useState<string | null>(null),
    [change, setChange] = useState<"activate" | "pause" | "budget" | null>(
      null,
    ),
    [budget, setBudget] = useState(0),
    [busy, setBusy] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [page, setPage] = useState(1);
  const c = data.campaigns.find((c) => c.id === selected);
  const filtered = data.campaigns.filter(
    (c) =>
      (status === "ALL" || c.status === status) &&
      (quality === "ALL" || c.health === quality) &&
      (product === "ALL" || c.inventoryItemId === product) &&
      c.name.toLowerCase().includes(search.toLowerCase()),
  );
  async function execute() {
    if (!c || !change) return;
    setBusy(true);
    try {
      await api(
        `campaigns/${c.id}`,
        {
          action: change,
          confirmed,
          revision: c.revision,
          dailyBudget: c.dailyBudget,
          newBudget: Math.round(budget * 100),
        },
        "PATCH",
      );
      await refresh();
      setChange(null);
      toast.success(
        c.isDemo
          ? "Demo campaign updated. No real ad spend."
          : "Campaign change applied.",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function review(action: "activate" | "pause" | "budget") {
    setChange(action);
    setBudget((c?.dailyBudget ?? 0) / 100);
    setConfirmed(false);
  }
  return (
    <>
      <PageTitle
        eyebrow="ADVERTISING WITH INTENTION"
        title="Campaigns"
        description="Turn available equipment into qualified conversations."
        action={
          <Button onClick={() => onCreate()}>
            <Plus size={17} />
            Create campaign
          </Button>
        }
      />
      <div className="notice">
        <ShieldCheck size={18} />
        <span>
          Every new campaign starts paused. You decide when it goes live.
        </span>
      </div>
      <div className="toolbar">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Search campaigns"
            placeholder="Search campaigns…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          aria-label="Filter campaign status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          {["ALL", "ACTIVE", "PAUSED", "ERROR"].map((s) => (
            <option key={s} value={s}>
              {s === "ALL" ? "All statuses" : label(s)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter campaign health"
          value={quality}
          onChange={(e) => {
            setQuality(e.target.value);
            setPage(1);
          }}
        >
          {[
            "ALL",
            "EXCELLENT",
            "GOOD",
            "WATCH",
            "POOR",
            "INSUFFICIENT_DATA",
          ].map((s) => (
            <option key={s} value={s}>
              {s === "ALL" ? "All performance" : label(s)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter campaign product"
          value={product}
          onChange={(e) => {
            setProduct(e.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All products</option>
          {data.items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.brand} {i.model}
            </option>
          ))}
        </select>
      </div>
      {!filtered.length ? (
        <Empty
          title="No campaigns yet"
          description="Choose a machine and build a campaign for review."
          action={<Button onClick={() => onCreate()}>Create campaign</Button>}
        />
      ) : (
        <div className="campaign-grid">
          {filtered.slice((page - 1) * 8, page * 8).map((c) => (
            <CampaignCard key={c.id} c={c} onClick={() => setSelected(c.id)} />
          ))}
        </div>
      )}
      <div className="pagination">
        <span>{filtered.length} campaigns</span>
        <Button
          size="sm"
          variant="outline"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page * 8 >= filtered.length}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
      <Dialog
        open={Boolean(c)}
        onOpenChange={(o) => !o && setSelected(null)}
        title={c?.name ?? "Campaign"}
        wide
      >
        {c && (
          <>
            <div className="inline-group">
              <Badge status={c.status} />
              <Badge status={c.health} />
              {c.isDemo && <span className="muted">Demo campaign</span>}
            </div>
            <div className="mini-metrics">
              {[
                ["Daily budget", `${money(c.dailyBudget)}/day`],
                ["Spend", money(c.spend)],
                ["Impressions", number(c.impressions)],
                ["Clicks", number(c.clicks)],
                ["CTR", c.ctr ? `${c.ctr.toFixed(2)}%` : "—"],
                ["CPC", c.cpc ? money(c.cpc) : "—"],
                ["CPM", c.cpm ? money(c.cpm) : "—"],
                ["Leads", c.leads],
                ["Qualified", c.qualified],
                ["Sales", c.sales],
                ["Revenue", money(c.revenue)],
                ["ROAS", c.roas ? `${c.roas.toFixed(1)}×` : "—"],
              ].map(([l, v]) => (
                <div key={l}>
                  <span>{l}</span>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>
            <p className="caption">
              Reach and frequency are not summed across days because people can
              appear on multiple days. Daily reach snapshots are retained;
              deduplicated period reach is not yet displayed.
            </p>
            <div className="review-panel">
              <h3>{c.headline}</h3>
              <p className="preserve">{c.primaryText}</p>
              <small>{c.description}</small>
            </div>
            <dl className="detail-list">
              <div>
                <dt>Goal</dt>
                <dd>{c.goal}</dd>
              </div>
              <div>
                <dt>Audience</dt>
                <dd>{c.audience}</dd>
              </div>
              <div>
                <dt>Destination</dt>
                <dd>{c.destination}</dd>
              </div>
              <div>
                <dt>Language</dt>
                <dd>{c.language}</dd>
              </div>
            </dl>
            {c.health === "INSUFFICIENT_DATA" && (
              <div className="notice">
                Not enough data for a confident budget recommendation. Keep the
                test small and review lead quality.
              </div>
            )}
            {c.status === "ERROR" && (
              <div className="notice warning">
                The last Meta operation failed or has an uncertain outcome. New
                campaign objects are initially paused; a timed-out activation
                may have reached Meta. Read Meta status before retrying.
              </div>
            )}
            <div className="dialog-actions">
              {!c.isDemo && c.metaId && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api(`campaigns/${c.id}/reconcile`, {});
                      await refresh();
                      toast.success("Status reconciled from Meta.");
                    } catch (e) {
                      toast.error((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Read Meta status
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setSelected(null);
                  onCreate(c.inventoryItemId);
                }}
              >
                <Sparkles size={16} />
                New creative
              </Button>
              <Button
                variant="outline"
                disabled={!["ACTIVE", "PAUSED"].includes(c.status)}
                onClick={() => review("budget")}
              >
                <TrendingUp size={16} />
                Edit budget
              </Button>
              {c.status === "PAUSED" ? (
                <Button onClick={() => review("activate")}>
                  <Play size={16} />
                  Review & activate
                </Button>
              ) : c.status === "ACTIVE" ? (
                <Button variant="outline" onClick={() => review("pause")}>
                  <Pause size={16} />
                  Pause campaign
                </Button>
              ) : null}
            </div>
          </>
        )}
      </Dialog>
      <Dialog
        open={Boolean(change)}
        onOpenChange={(o) => !o && setChange(null)}
        title={
          change === "activate"
            ? "Final review · activate campaign"
            : change === "pause"
              ? "Confirm campaign pause"
              : "Review daily budget"
        }
        description="A change is applied only after your explicit confirmation."
      >
        {c && (
          <>
            <div className="review-panel">
              <h3>{c.name}</h3>
              <p>{c.audience}</p>
              <p>
                <strong>{money(c.dailyBudget)}/day</strong> · {c.goal} ·{" "}
                {c.destination}
              </p>
              <p>{c.headline}</p>
              <p>{c.primaryText}</p>
              {c.isDemo && <Badge status="DEMO" />}
            </div>
            {change === "budget" && (
              <Field
                label="New daily budget (THB)"
                hint="Budget increases are capped at 20% per approval."
              >
                <input
                  type="number"
                  min="100"
                  step="1"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                />
              </Field>
            )}
            <label className="check-field">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>
                {c.isDemo
                  ? "I confirm this simulated campaign change."
                  : change === "activate"
                    ? `I approve activation at ${money(c.dailyBudget)} per day. Meta delivery can incur advertising charges.`
                    : "I approve this change to the live Meta campaign."}
              </span>
            </label>
            <div className="dialog-actions">
              <Button variant="outline" onClick={() => setChange(null)}>
                Cancel
              </Button>
              <Button disabled={!confirmed || busy} onClick={execute}>
                {busy
                  ? "Applying…"
                  : change === "activate"
                    ? "Approve & activate"
                    : "Confirm change"}
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
export function CampaignCard({
  c,
  onClick,
}: {
  c: Campaign;
  onClick: () => void;
}) {
  return (
    <button className="campaign-card" onClick={onClick}>
      <div className="card-top">
        <span className="campaign-symbol">
          <Target size={20} />
        </span>
        <Badge status={c.status} />
      </div>
      <h3>{c.name}</h3>
      <p>
        {money(c.dailyBudget)}/day · {c.isDemo ? "Demo campaign" : "Meta Ads"}
      </p>
      <div className="campaign-metrics">
        {[
          ["Spend", money(c.spend)],
          ["Leads", c.leads],
          ["Cost / lead", c.cpl ? money(c.cpl) : "—"],
          ["Qualified", c.qualified],
          ["Revenue", money(c.revenue)],
          ["ROAS", c.roas ? `${c.roas.toFixed(1)}×` : "—"],
        ].map(([l, v]) => (
          <div key={l}>
            <span>{l}</span>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <div className="card-bottom">
        <Badge status={c.health} />
        <ArrowRight size={17} />
      </div>
    </button>
  );
}
export function CampaignBuilder({
  productId,
  close,
}: {
  productId: string | null | undefined;
  close: () => void;
}) {
  const router = useRouter();
  const { data, refresh } = useData();
  const [step, setStep] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [provider, setProvider] = useState(""),
    [strategy, setStrategy] = useState<z.infer<typeof strategySchema> | null>(
      null,
    ),
    [input, setInput] = useState({
      inventoryItemId:
        productId ??
        data.items.find((i) => i.quantity - i.reservedQuantity > 0)?.id ??
        "",
      goal: "Messages",
      dailyBudget: 50000,
      country: "TH",
      language: "Thai + English",
      instructions: "",
    }),
    [text, setText] = useState(""),
    [headline, setHeadline] = useState(""),
    [description, setDescription] = useState(""),
    [audience, setAudience] = useState(""),
    [created, setCreated] = useState(false),
    [operationKey] = useState(() => crypto.randomUUID());
  const item = data.items.find((i) => i.id === input.inventoryItemId);
  async function generate() {
    setBusy(true);
    setError("");
    try {
      const res = await api<{
        strategy: z.infer<typeof strategySchema>;
        provider: string;
      }>("generate", input);
      setStrategy(res.strategy);
      setProvider(res.provider);
      setText(res.strategy.primaryTexts[0]);
      setHeadline(res.strategy.headlines[0]);
      setDescription(res.strategy.descriptions[0]);
      setAudience(res.strategy.audience);
      setStep(2);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    if (!strategy || !item) return;
    setBusy(true);
    setError("");
    try {
      await api("campaigns", {
        ...input,
        name: `${item.brand} ${item.model} · ${input.goal}`,
        primaryText: text,
        headline,
        description,
        audience,
        strategy,
        operationKey,
      });
      await refresh();
      setCreated(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={productId !== undefined}
      onOpenChange={(o) => !o && close()}
      title={
        created
          ? "Your campaign is ready for final review"
          : "Create a campaign"
      }
      description={
        created
          ? "Created in PAUSED state. Open Campaigns to review and explicitly activate."
          : "From your inventory to a considered advertising plan."
      }
      wide
    >
      {created ? (
        <div className="success-state">
          <span>
            <Check size={32} />
          </span>
          <h2>Created. Paused. In your control.</h2>
          <p>
            {data.demo
              ? "This is a simulated demo campaign. No Meta request was made."
              : "The Meta campaign, ad set, and ad were created paused."}
          </p>
          <Button
            onClick={() => {
              close();
              router.push("/campaigns");
            }}
          >
            Review in Campaigns
            <ArrowRight size={17} />
          </Button>
        </div>
      ) : (
        <>
          <div className="stepper">
            {["Campaign brief", "Copy & strategy", "Review"].map((s, i) => (
              <span
                key={s}
                className={
                  step === i + 1 ? "current" : step > i + 1 ? "complete" : ""
                }
              >
                <b>{step > i + 1 ? <Check size={13} /> : i + 1}</b>
                {s}
              </span>
            ))}
          </div>
          {step === 1 && (
            <>
              <div className="form-grid">
                <Field label="Machine">
                  <select
                    value={input.inventoryItemId}
                    onChange={(e) =>
                      setInput({ ...input, inventoryItemId: e.target.value })
                    }
                  >
                    {data.items
                      .filter(
                        (i) =>
                          i.quantity - i.reservedQuantity > 0 &&
                          ![
                            "HIDDEN",
                            "SOLD",
                            "SERVICE_REQUIRED",
                            "COMING_SOON",
                          ].includes(i.status),
                      )
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.brand} {i.model} · {money(i.askingPrice)}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Goal">
                  <select
                    value={input.goal}
                    onChange={(e) =>
                      setInput({ ...input, goal: e.target.value })
                    }
                  >
                    <option>Messages</option>
                    <option>Leads</option>
                  </select>
                </Field>
                <Field label="Daily budget (THB)">
                  <input
                    type="number"
                    min="100"
                    max="10000"
                    value={input.dailyBudget / 100}
                    onChange={(e) =>
                      setInput({
                        ...input,
                        dailyBudget: Math.round(Number(e.target.value) * 100),
                      })
                    }
                  />
                </Field>
                <Field label="Target country">
                  <select
                    value={input.country}
                    onChange={(e) =>
                      setInput({ ...input, country: e.target.value })
                    }
                  >
                    <option value="TH">Thailand</option>
                    <option value="SG">Singapore</option>
                    <option value="MY">Malaysia</option>
                    <option value="US">United States</option>
                  </select>
                </Field>
                <Field label="Copy language">
                  <select
                    value={input.language}
                    onChange={(e) =>
                      setInput({ ...input, language: e.target.value })
                    }
                  >
                    <option>Thai + English</option>
                    <option>Thai</option>
                    <option>English</option>
                  </select>
                </Field>
              </div>
              <Field label="Additional instructions">
                <textarea
                  rows={3}
                  placeholder="เช่น เจ้าของ gym ที่กำลังเปิด gym ใหม่"
                  value={input.instructions}
                  onChange={(e) =>
                    setInput({ ...input, instructions: e.target.value })
                  }
                />
              </Field>
              <div className="notice">
                <ShieldCheck size={18} />
                Only saved product facts are used. No ads will be activated.
              </div>
            </>
          )}
          {step === 2 && strategy && (
            <>
              <div className="provider-label">
                <Sparkles size={15} />
                {provider}
              </div>
              <h3 className="subheading">Three ways to start a conversation</h3>
              <div className="angle-grid">
                {strategy.angles.map((a, i) => (
                  <div key={a}>
                    <span>0{i + 1}</span>
                    <p>{a}</p>
                  </div>
                ))}
              </div>
              <Field label="Primary text variation">
                <select
                  onChange={(e) =>
                    setText(strategy.primaryTexts[Number(e.target.value)])
                  }
                >
                  {strategy.primaryTexts.map((_, i) => (
                    <option key={i} value={i}>
                      Variation {i + 1}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Edit primary text">
                <textarea
                  rows={5}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </Field>
              <Field label="Headline variation">
                <select
                  onChange={(e) =>
                    setHeadline(strategy.headlines[Number(e.target.value)])
                  }
                >
                  {strategy.headlines.map((h, i) => (
                    <option key={i} value={i}>
                      {h}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Edit headline">
                <input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                />
              </Field>
              <Field label="Description variation">
                <select
                  onChange={(e) =>
                    setDescription(
                      strategy.descriptions[Number(e.target.value)],
                    )
                  }
                >
                  {strategy.descriptions.map((h, i) => (
                    <option key={i} value={i}>
                      {h}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Edit description">
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
              <Field label="Audience strategy">
                <textarea
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                />
              </Field>
              <div className="notice">
                <div>
                  <strong>Why this approach</strong>
                  <p>{strategy.reasoning}</p>
                  <p>{strategy.budgetGuidance}</p>
                  <p>{strategy.optimization}</p>
                  <p>{strategy.structure}</p>
                </div>
              </div>
            </>
          )}
          {step === 3 && item && (
            <>
              <div className="review-panel">
                <div className="eyebrow">
                  {data.demo ? "DEMO CAMPAIGN" : "META CAMPAIGN"} · WILL BE
                  CREATED PAUSED
                </div>
                <h2>
                  {item.brand} {item.model}
                </h2>
                <h3>{headline}</h3>
                <p className="preserve">{text}</p>
                <small>{description}</small>
              </div>
              <dl className="detail-list">
                <div>
                  <dt>Daily budget</dt>
                  <dd>{money(input.dailyBudget)} / day</dd>
                </div>
                <div>
                  <dt>30-day planning estimate</dt>
                  <dd>{money(input.dailyBudget * 30)} · not a spending cap</dd>
                </div>
                <div>
                  <dt>Audience</dt>
                  <dd>{audience}</dd>
                </div>
                <div>
                  <dt>Delivery targeting</dt>
                  <dd>{input.country} · Adults 25–65 · Facebook feed</dd>
                </div>
                <div>
                  <dt>Goal / destination</dt>
                  <dd>{input.goal} / Messenger</dd>
                </div>
                <div>
                  <dt>Creative CTA</dt>
                  <dd>Send message</dd>
                </div>
              </dl>
              <p className="caption">
                The audience text is strategic guidance. The exact API targeting
                uses the country and age limits above. Live campaigns currently
                use the approved image configured for your Meta account.
              </p>
            </>
          )}
          {error && (
            <div role="alert" className="error-message">
              {error}
            </div>
          )}
          <div className="dialog-actions">
            {step > 1 && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setStep(step - 1)}
              >
                Back
              </Button>
            )}
            {step === 1 ? (
              <Button disabled={busy || !item} onClick={generate}>
                <Sparkles size={16} />
                {busy
                  ? "Preparing strategy…"
                  : data.aiConfigured
                    ? "Generate with AI"
                    : "Generate demo strategy"}
              </Button>
            ) : step === 2 ? (
              <Button
                disabled={!text || !headline || !audience}
                onClick={() => setStep(3)}
              >
                Review campaign
                <ArrowRight size={16} />
              </Button>
            ) : (
              <Button disabled={busy} onClick={create}>
                <ShieldCheck size={17} />
                {busy ? "Creating paused campaign…" : "Create paused campaign"}
              </Button>
            )}
          </div>
        </>
      )}
    </Dialog>
  );
}
