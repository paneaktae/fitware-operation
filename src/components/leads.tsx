"use client";
import { useState } from "react";
import {
  Plus,
  Search,
  Phone,
  Mail,
  ArrowUpRight,
  Check,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { money, label, localDate } from "@/lib/format";
import { useData, api, Badge, Empty, Field, PageTitle } from "./common";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
const stages = ["NEW", "CONTACTED", "QUALIFIED", "NEGOTIATION", "WON", "LOST"];
export default function Leads() {
  const { data, refresh } = useData();
  const [search, setSearch] = useState(""),
    [stage, setStage] = useState("ALL"),
    [product, setProduct] = useState("ALL"),
    [campaign, setCampaign] = useState("ALL"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [adding, setAdding] = useState(false),
    [itemId, setItemId] = useState(data.items[0]?.id ?? ""),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(""),
    [won, setWon] = useState(false),
    [revenue, setRevenue] = useState(0),
    [units, setUnits] = useState(1),
    [loss, setLoss] = useState(false),
    [lossReason, setLossReason] = useState(""),
    [page, setPage] = useState(1);
  const lead = data.leads.find((l) => l.id === selected);
  const item = data.items.find((i) => i.id === lead?.inventoryItemId);
  const filtered = data.leads.filter(
    (l) =>
      (stage === "ALL" || l.status === stage) &&
      (product === "ALL" || l.inventoryItemId === product) &&
      (campaign === "ALL" || l.campaignId === campaign) &&
      (!from || new Date(l.createdAt) >= new Date(from + "T00:00:00+07:00")) &&
      (!to ||
        new Date(l.createdAt) <
          new Date(+new Date(to + "T00:00:00+07:00") + 86400000)) &&
      `${l.name} ${l.phone}`.toLowerCase().includes(search.toLowerCase()),
  );
  async function update(status: string) {
    if (!lead) return;
    setBusy(true);
    try {
      await api(
        `leads/${lead.id}`,
        {
          status,
          note,
          revenue: status === "WON" ? Math.round(revenue * 100) : undefined,
          quantity: units,
          lossReason,
        },
        "PATCH",
      );
      await refresh();
      setNote("");
      setWon(false);
      setLoss(false);
      toast.success(
        status === "WON" ? "Sale recorded and attributed." : "Lead updated.",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await api("leads", {
        name: f.get("name"),
        phone: f.get("phone"),
        email: f.get("email"),
        source: f.get("source"),
        inventoryItemId: itemId,
        campaignId: f.get("campaignId") || null,
        estimatedValue: Math.round(Number(f.get("estimatedValue")) * 100),
        notes: f.get("notes"),
      });
      await refresh();
      setAdding(false);
      toast.success("Lead added.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="CONVERSATIONS THAT BECOME CUSTOMERS"
        title="Leads"
        description="A clear next step for every enquiry."
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus size={17} />
            Add lead
          </Button>
        }
      />
      <div className="pipeline">
        {stages.slice(0, 5).map((s) => (
          <button
            key={s}
            onClick={() => {
              setStage(s);
              setPage(1);
            }}
            className={stage === s ? "selected" : ""}
          >
            <span>{label(s)}</span>
            <strong>{data.leads.filter((l) => l.status === s).length}</strong>
            <div />
          </button>
        ))}
      </div>
      <div className="toolbar">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Search leads"
            placeholder="Search name or phone…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          aria-label="Lead stage"
          value={stage}
          onChange={(e) => {
            setStage(e.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All stages</option>
          {stages.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
        <select
          aria-label="Lead product"
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
        <select
          aria-label="Lead campaign"
          value={campaign}
          onChange={(e) => {
            setCampaign(e.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All campaigns</option>
          {data.campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <details className="date-filter">
        <summary>Filter by lead received date</summary>
        <div className="inline-group">
          <Field label="From">
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </Field>
          <Field label="Through">
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </Field>
        </div>
      </details>
      <div className="leads-list">
        {filtered.slice((page - 1) * 12, page * 12).map((l) => (
          <button
            key={l.id}
            className="lead-row"
            onClick={() => {
              setSelected(l.id);
              setRevenue((l.actualRevenue || l.estimatedValue) / 100);
              setNote("");
              setUnits(1);
            }}
          >
            <span className="avatar">{l.name.slice(0, 2).toUpperCase()}</span>
            <div className="lead-name">
              <h3>{l.name}</h3>
              <p>
                {data.items.find((i) => i.id === l.inventoryItemId)?.brand} ·{" "}
                {data.items.find((i) => i.id === l.inventoryItemId)?.model}
              </p>
            </div>
            <div className="lead-source">
              <span>{l.source}</span>
              <small>{localDate(l.createdAt)}</small>
            </div>
            <Badge status={l.status} />
            <strong>
              {money(l.status === "WON" ? l.actualRevenue : l.estimatedValue)}
            </strong>
            <ArrowUpRight size={17} />
          </button>
        ))}
      </div>
      {!filtered.length && (
        <Empty
          title="No leads here yet"
          description="Add an enquiry to start tracking the conversation."
        />
      )}
      <div className="pagination">
        <span>{filtered.length} leads</span>
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
          disabled={page * 12 >= filtered.length}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
      <Dialog
        open={Boolean(lead)}
        onOpenChange={(o) => !o && setSelected(null)}
        title={lead?.name ?? "Lead"}
        wide
      >
        {lead && (
          <>
            <div className="lead-detail-head">
              <div>
                <Badge status={lead.status} />
                <p>
                  {item?.brand} {item?.model}
                </p>
                <h2>{money(lead.actualRevenue || lead.estimatedValue)}</h2>
                <small>
                  {lead.status === "WON" ? "Actual revenue" : "Estimated value"}
                </small>
              </div>
              <div className="inline-group">
                {lead.phone && (
                  <a className="btn btn-outline" href={`tel:${lead.phone}`}>
                    <Phone size={16} />
                    Call
                  </a>
                )}
                {lead.email && (
                  <a className="btn btn-outline" href={`mailto:${lead.email}`}>
                    <Mail size={16} />
                    Email
                  </a>
                )}
              </div>
            </div>
            <div className="notice">
              <MessageSquare size={17} />
              <div>
                {lead.source}
                <p>
                  {data.campaigns.find((c) => c.id === lead.campaignId)?.name ??
                    "No campaign attributed"}
                </p>
              </div>
            </div>
            <h3 className="subheading">Move the conversation forward</h3>
            <div className="stage-buttons">
              {stages.map((s) => (
                <Button
                  key={s}
                  variant={lead.status === s ? "default" : "outline"}
                  size="sm"
                  disabled={busy || (lead.status === "WON" && s !== "WON")}
                  onClick={() => {
                    if (s === "WON") setWon(true);
                    else if (s === "LOST") setLoss(true);
                    else void update(s);
                  }}
                >
                  {s === "WON" && <Check size={15} />} {label(s)}
                </Button>
              ))}
            </div>
            <h3 className="subheading">Timeline</h3>
            <div className="timeline">
              {lead.events.map((e) => (
                <div key={e.id}>
                  <span />
                  <small>{localDate(e.createdAt)}</small>
                  <p>{e.message}</p>
                </div>
              ))}
            </div>
            <p className="muted">{lead.notes}</p>
            <Field label="Add a note">
              <textarea
                placeholder="What did the buyer say? What happens next?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </Field>
            <div className="dialog-actions">
              <Button
                variant="outline"
                disabled={busy || !note.trim()}
                onClick={() => update(lead.status)}
              >
                Save note
              </Button>
              {lead.status !== "WON" && (
                <Button onClick={() => setWon(true)}>
                  Record a sale
                  <ArrowUpRight size={16} />
                </Button>
              )}
            </div>
          </>
        )}
      </Dialog>
      <Dialog
        open={won}
        onOpenChange={setWon}
        title={lead?.sale ? "Correct sale revenue" : "Record a won sale"}
        description="Revenue is attributed to this lead, machine, campaign and ad. New sales deduct available stock once."
      >
        <Field label="Actual revenue (THB)">
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={revenue}
            onChange={(e) => setRevenue(Number(e.target.value))}
          />
        </Field>
        {!lead?.sale && (
          <Field label="Units sold">
            <input
              type="number"
              min="1"
              step="1"
              value={units}
              onChange={(e) => setUnits(Number(e.target.value))}
            />
          </Field>
        )}
        <div className="notice">
          <ShieldNote /> {item?.brand} {item?.model} ·{" "}
          {item ? item.quantity - item.reservedQuantity : 0} available
        </div>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setWon(false)}>
            Cancel
          </Button>
          <Button disabled={busy || revenue <= 0} onClick={() => update("WON")}>
            {busy ? "Recording…" : "Confirm sale & revenue"}
          </Button>
        </div>
      </Dialog>
      <Dialog open={loss} onOpenChange={setLoss} title="Mark lead lost">
        <Field label="Reason">
          <textarea
            value={lossReason}
            onChange={(e) => setLossReason(e.target.value)}
            placeholder="Price, timing, another supplier…"
          />
        </Field>
        <div className="dialog-actions">
          <Button
            disabled={busy || !lossReason.trim()}
            onClick={() => update("LOST")}
          >
            Confirm lost lead
          </Button>
        </div>
      </Dialog>
      <Dialog open={adding} onOpenChange={setAdding} title="Add an enquiry">
        <form onSubmit={add}>
          <div className="form-grid">
            <Field label="Buyer / business name">
              <input name="name" required />
            </Field>
            <Field label="Phone">
              <input name="phone" type="tel" />
            </Field>
            <Field label="Email">
              <input name="email" type="email" />
            </Field>
            <Field label="Source">
              <select name="source">
                <option>Facebook Ads</option>
                <option>Instagram</option>
                <option>Referral</option>
                <option>Walk-in</option>
                <option>Other</option>
              </select>
            </Field>
            <Field label="Interested machine">
              <select
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                required
              >
                {data.items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.brand} {i.model}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Campaign">
              <select name="campaignId" key={itemId}>
                <option value="">No campaign / organic</option>
                {data.campaigns
                  .filter((c) => c.inventoryItemId === itemId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Estimated value (THB)">
              <input
                name="estimatedValue"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea name="notes" rows={3} />
          </Field>
          <div className="dialog-actions">
            <Button disabled={busy}>{busy ? "Saving…" : "Save lead"}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
function ShieldNote() {
  return <Check size={17} />;
}
