"use client";
import { useState } from "react";
import {
  Plus,
  Search,
  SlidersHorizontal,
  MapPin,
  ArrowRight,
  Upload,
  Trash2,
  ArrowUp,
  ArrowDown,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import type { ClientReport } from "@/lib/data";
import { money, label } from "@/lib/format";
import {
  useData,
  api,
  Badge,
  Empty,
  Field,
  PageTitle,
  ProductArt,
} from "./common";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
type Item = ClientReport["items"][number];
export default function Inventory({
  onCampaign,
}: {
  onCampaign: (id: string) => void;
}) {
  const { data, refresh } = useData();
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("ALL"),
    [brand, setBrand] = useState("ALL"),
    [category, setCategory] = useState("ALL"),
    [stock, setStock] = useState("ALL"),
    [maxPrice, setMaxPrice] = useState(""),
    [filters, setFilters] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [edit, setEdit] = useState<Item | null | undefined>(undefined),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [archive, setArchive] = useState(false);
  const item = data.items.find((i) => i.id === selected);
  const results = data.items.filter(
    (i) =>
      (status === "ALL" ? i.status !== "HIDDEN" : i.status === status) &&
      (brand === "ALL" || i.brand === brand) &&
      (category === "ALL" || i.category === category) &&
      (stock === "ALL" ||
        (stock === "IN"
          ? i.quantity - i.reservedQuantity > 0
          : i.quantity - i.reservedQuantity === 0)) &&
      (!maxPrice || i.askingPrice <= Number(maxPrice) * 100) &&
      `${i.brand} ${i.model} ${i.series}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const campaigns = data.campaigns.filter(
    (c) => c.inventoryItemId === item?.id,
  );
  const total = (key: "spend" | "leads" | "qualified" | "sales" | "revenue") =>
    campaigns.reduce((a, c) => a + c[key], 0);
  async function upload(files: FileList | null) {
    if (!files || !item) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("file", file);
        await api(`inventory/${item.id}/media`, form);
      }
      await refresh();
      toast.success("Media uploaded.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reorder(media: Item["media"][number], offset: number) {
    if (!item) return;
    const rows = [...item.media];
    const index = rows.findIndex((m) => m.id === media.id);
    const target = index + offset;
    if (target < 0 || target >= rows.length) return;
    [rows[index], rows[target]] = [rows[target], rows[index]];
    setBusy(true);
    try {
      await Promise.all(
        rows.map((m, i) =>
          api(`media/${m.id}`, { alt: m.alt, position: i }, "PATCH"),
        ),
      );
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="YOUR EQUIPMENT, AT A GLANCE"
        title="Inventory"
        description="Every machine. Its stock, story, and sales performance."
        action={
          <Button onClick={() => setEdit(null)}>
            <Plus size={17} />
            Add machine
          </Button>
        }
      />
      <div className="section-stats">
        <span>
          <strong>
            {data.items.filter((i) => i.status !== "HIDDEN").length}
          </strong>{" "}
          machines
        </span>
        <span>
          <strong>
            {data.items.reduce(
              (a, i) => a + i.quantity - i.reservedQuantity,
              0,
            )}
          </strong>{" "}
          units available
        </span>
        <span>
          <strong>
            {money(
              data.items.reduce(
                (a, i) =>
                  a +
                  i.askingPrice * Math.max(0, i.quantity - i.reservedQuantity),
                0,
              ),
              true,
            )}
          </strong>{" "}
          inventory value
        </span>
      </div>
      <div className="toolbar">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Search inventory"
            placeholder="Search brand, model, or series…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Button variant="outline" onClick={() => setFilters(true)}>
          <SlidersHorizontal size={16} />
          Filters
        </Button>
      </div>
      <div className="tabs">
        <button
          onClick={() => {
            setStatus("ALL");
            setPage(1);
          }}
          className={status === "ALL" ? "selected" : ""}
        >
          All machines
        </button>
        {["AVAILABLE", "RESERVED", "SOLD"].map((s) => (
          <button
            key={s}
            className={status === s ? "selected" : ""}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
          >
            {label(s)}
          </button>
        ))}
      </div>
      {!results.length ? (
        <Empty
          title="No machines found"
          description="Try a different filter, or add your first machine."
          action={<Button onClick={() => setEdit(null)}>Add machine</Button>}
        />
      ) : (
        <div className="inventory-grid">
          {results.slice((page - 1) * 9, page * 9).map((i) => (
            <button
              className="inventory-card"
              key={i.id}
              onClick={() => setSelected(i.id)}
            >
              <div className="inventory-visual">
                <ProductArt item={i} />
                <Badge status={i.status} />
              </div>
              <div className="inventory-card-content">
                <div className="eyebrow">
                  {i.brand} · {i.series}
                </div>
                <h3>{i.model}</h3>
                <p>
                  {i.condition} · Condition {i.conditionScore}%
                </p>
                <div className="card-price">
                  <strong>{money(i.askingPrice)}</strong>
                  <span>{i.quantity - i.reservedQuantity} in stock</span>
                </div>
                <div className="card-bottom">
                  <span>
                    <MapPin size={13} />
                    {i.location}
                  </span>
                  <ArrowRight size={17} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      <div className="pagination">
        <span>
          {results.length} machines · Page {page}
        </span>
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
          disabled={page * 9 >= results.length}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
      <Dialog open={filters} onOpenChange={setFilters} title="Filter inventory">
        <div className="form-grid">
          <Field label="Brand">
            <select
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All brands</option>
              {[...new Set(data.items.map((i) => i.brand))].map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All categories</option>
              {[...new Set(data.items.map((i) => i.category))].map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </Field>
          <Field label="Stock">
            <select
              value={stock}
              onChange={(e) => {
                setStock(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Any stock</option>
              <option value="IN">In stock</option>
              <option value="OUT">Sold out</option>
            </select>
          </Field>
          <Field label="Maximum asking price (THB)">
            <input
              type="number"
              min="0"
              value={maxPrice}
              onChange={(e) => {
                setMaxPrice(e.target.value);
                setPage(1);
              }}
            />
          </Field>
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              {[
                "ALL",
                "AVAILABLE",
                "RESERVED",
                "SOLD",
                "COMING_SOON",
                "SERVICE_REQUIRED",
                "HIDDEN",
              ].map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="dialog-actions">
          <Button onClick={() => setFilters(false)}>
            Show {results.length} machines
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={Boolean(item)}
        onOpenChange={(o) => !o && setSelected(null)}
        title={item ? `${item.brand} ${item.series} ${item.model}` : "Machine"}
        wide
      >
        {item && (
          <>
            <div className="detail-grid">
              <ProductArt item={item} large />
              <div>
                <Badge status={item.status} />
                <h2 className="detail-price">{money(item.askingPrice)}</h2>
                <p>{item.description}</p>
                <dl className="detail-list">
                  <div>
                    <dt>Available / reserved</dt>
                    <dd>
                      {item.quantity - item.reservedQuantity} /{" "}
                      {item.reservedQuantity}
                    </dd>
                  </div>
                  <div>
                    <dt>Condition</dt>
                    <dd>
                      {item.condition} · {item.conditionScore}%
                    </dd>
                  </div>
                  <div>
                    <dt>Purchase cost</dt>
                    <dd>{money(item.purchaseCost)}</dd>
                  </div>
                  <div>
                    <dt>Minimum price</dt>
                    <dd>{money(item.minimumPrice)}</dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>{item.location}</dd>
                  </div>
                </dl>
                <Button variant="outline" onClick={() => setEdit(item)}>
                  Edit machine
                </Button>
              </div>
            </div>
            {item.quantity - item.reservedQuantity === 0 &&
              campaigns.some((c) => c.status === "ACTIVE") && (
                <div className="notice warning">
                  Sold out: an active campaign is still spending. Open Campaigns
                  to review and pause it.
                </div>
              )}
            <h3 className="subheading">
              Advertising performance <small>Selected reporting period</small>
            </h3>
            <div className="mini-metrics">
              {[
                ["Ad spend", money(total("spend"))],
                ["Leads", total("leads")],
                ["Qualified", total("qualified")],
                ["Sales", total("sales")],
                ["Revenue", money(total("revenue"))],
                [
                  "ROAS",
                  total("spend")
                    ? `${(total("revenue") / total("spend")).toFixed(1)}×`
                    : "—",
                ],
              ].map(([l, v]) => (
                <div key={l}>
                  <span>{l}</span>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>
            <h3 className="subheading">Linked campaigns</h3>
            {campaigns.map((c) => (
              <div className="list-row" key={c.id}>
                <span>{c.name}</span>
                <Badge status={c.status} />
              </div>
            ))}
            <h3 className="subheading">
              Photos & videos <small>First item is the primary media</small>
            </h3>
            <label className="upload-zone">
              <Upload size={22} />
              <strong>
                {busy ? "Uploading…" : "Add machine photos or videos"}
              </strong>
              <span>JPEG, PNG, WebP or MP4 · up to 20 MB each</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4"
                multiple
                disabled={busy}
                onChange={(e) => upload(e.target.files)}
              />
            </label>
            <div className="media-list">
              {item.media.map((m, i) => (
                <div
                  key={m.id}
                  className="media-row"
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData("text/plain", String(i))
                  }
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = Number(e.dataTransfer.getData("text/plain"));
                    if (Number.isInteger(from) && item.media[from])
                      void reorder(item.media[from], i - from);
                  }}
                >
                  <GripVertical size={15} />
                  {m.type === "image" ? (
                    <img src={m.url} alt={m.alt} />
                  ) : (
                    <video src={m.url} controls />
                  )}
                  <input
                    aria-label="Media alt text"
                    defaultValue={m.alt}
                    onBlur={async (e) => {
                      try {
                        await api(
                          `media/${m.id}`,
                          { alt: e.target.value, position: m.position },
                          "PATCH",
                        );
                        await refresh();
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Move media earlier"
                    disabled={i === 0 || busy}
                    onClick={() => reorder(m, -1)}
                  >
                    <ArrowUp size={16} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Move media later"
                    disabled={i === item.media.length - 1 || busy}
                    onClick={() => reorder(m, 1)}
                  >
                    <ArrowDown size={16} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Remove media"
                    onClick={async () => {
                      try {
                        await api(`media/${m.id}`, undefined, "DELETE");
                        await refresh();
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
            <div className="dialog-actions">
              <Button variant="ghost" onClick={() => setArchive(true)}>
                Archive machine
              </Button>
              <Button
                disabled={item.quantity - item.reservedQuantity <= 0}
                onClick={() => {
                  setSelected(null);
                  onCampaign(item.id);
                }}
              >
                Create campaign
                <ArrowRight size={16} />
              </Button>
            </div>
          </>
        )}
      </Dialog>
      <Dialog
        open={archive}
        onOpenChange={setArchive}
        title="Archive this machine?"
        description="It will be hidden from active inventory. Sales and advertising history will be retained."
      >
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setArchive(false)}>
            Keep machine
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              if (!item) return;
              setBusy(true);
              try {
                await api(`inventory/${item.id}`, undefined, "DELETE");
                setArchive(false);
                setSelected(null);
                await refresh();
                toast.success("Machine archived.");
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Archive
          </Button>
        </div>
      </Dialog>
      <InventoryForm
        key={edit?.id ?? "new"}
        item={edit}
        close={() => setEdit(undefined)}
      />
    </>
  );
}
function InventoryForm({
  item,
  close,
}: {
  item: Item | null | undefined;
  close: () => void;
}) {
  const { refresh } = useData();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "");
    const n = (k: string) => Number(f.get(k) ?? 0);
    try {
      await api(
        item ? `inventory/${item.id}` : "inventory",
        {
          expectedUpdatedAt: item?.updatedAt,
          brand: v("brand"),
          model: v("model"),
          series: v("series"),
          category: v("category"),
          machineType: v("machineType"),
          condition: v("condition"),
          conditionScore: n("conditionScore"),
          manufactureYear: v("manufactureYear") ? n("manufactureYear") : null,
          quantity: n("quantity"),
          reservedQuantity: n("reservedQuantity"),
          purchaseCost: Math.round(n("purchaseCost") * 100),
          askingPrice: Math.round(n("askingPrice") * 100),
          minimumPrice: Math.round(n("minimumPrice") * 100),
          location: v("location"),
          description: v("description"),
          internalNotes: v("internalNotes"),
          status: v("status"),
        },
        item ? "PATCH" : "POST",
      );
      await refresh();
      close();
      toast.success(item ? "Machine updated." : "Machine added.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={item !== undefined}
      onOpenChange={(o) => !o && close()}
      title={item ? "Edit machine" : "Add a machine"}
      description="Start with the facts. Only recorded details will be used in generated ads."
      wide
    >
      <form onSubmit={save}>
        <div className="form-grid">
          {(
            [
              "brand",
              "model",
              "series",
              "category",
              "machineType",
              "condition",
              "location",
            ] as const
          ).map((k) => (
            <Field key={k} label={label(k.replace(/([A-Z])/g, " $1"))}>
              <input
                name={k}
                defaultValue={
                  item?.[k] ??
                  (
                    {
                      category: "Strength",
                      machineType: "Commercial",
                      condition: "Refurbished",
                      location: "Bangkok warehouse",
                    } as Record<string, string>
                  )[k] ??
                  ""
                }
                required={["brand", "model"].includes(k)}
              />
            </Field>
          ))}
          {(
            [
              "askingPrice",
              "purchaseCost",
              "minimumPrice",
              "quantity",
              "reservedQuantity",
              "conditionScore",
              "manufactureYear",
            ] as const
          ).map((k) => (
            <Field
              key={k}
              label={`${label(k.replace(/([A-Z])/g, " $1"))}${k.includes("Price") || k === "purchaseCost" ? " (THB)" : ""}`}
            >
              <input
                name={k}
                type="number"
                min="0"
                max={k === "conditionScore" ? 100 : undefined}
                step={
                  k.includes("Price") || k === "purchaseCost" ? "0.01" : "1"
                }
                defaultValue={
                  item
                    ? (item[k] ?? "") === ""
                      ? ""
                      : Number(item[k]) /
                        (k.includes("Price") || k === "purchaseCost" ? 100 : 1)
                    : k === "quantity"
                      ? 1
                      : k === "conditionScore"
                        ? 90
                        : k === "manufactureYear"
                          ? ""
                          : 0
                }
                required={k !== "manufactureYear"}
              />
            </Field>
          ))}
          <Field label="Status">
            <select name="status" defaultValue={item?.status ?? "AVAILABLE"}>
              {[
                "AVAILABLE",
                "RESERVED",
                "SOLD",
                "COMING_SOON",
                "SERVICE_REQUIRED",
                "HIDDEN",
              ].map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Product description">
          <textarea
            name="description"
            defaultValue={item?.description}
            rows={3}
          />
        </Field>
        <Field label="Internal notes">
          <textarea
            name="internalNotes"
            defaultValue={item?.internalNotes}
            rows={2}
          />
        </Field>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <Button variant="outline" type="button" onClick={close}>
            Cancel
          </Button>
          <Button disabled={busy}>{busy ? "Saving…" : "Save machine"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
