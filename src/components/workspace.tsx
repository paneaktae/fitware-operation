"use client";
import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Dumbbell,
  LayoutDashboard,
  Package,
  Target,
  Users,
  Sparkles,
  ChartNoAxesCombined,
  Settings as SettingsIcon,
  ChevronDown,
  Search,
  Sun,
  Moon,
  LogOut,
  Menu,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import type { ClientReport } from "@/lib/data";
import { DataContext } from "./common";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import Dashboard from "./dashboard";
import Inventory from "./inventory";
import Campaigns, { CampaignBuilder } from "./campaigns";
import Leads from "./leads";
import Advisor from "./advisor";
import Analytics from "./analytics";
import Settings from "./settings";
const navigation = [
  { id: "dashboard", label: "Overview", mobile: "Home", icon: LayoutDashboard },
  { id: "inventory", label: "Inventory", mobile: "Inventory", icon: Package },
  { id: "campaigns", label: "Campaigns", mobile: "Campaigns", icon: Target },
  { id: "leads", label: "Leads & sales", mobile: "Leads", icon: Users },
  { id: "advisor", label: "AI Advisor", mobile: "AI", icon: Sparkles },
  {
    id: "analytics",
    label: "Analytics",
    mobile: "Analytics",
    icon: ChartNoAxesCombined,
  },
];
export default function Workspace({
  initialData,
  section,
  owner,
}: {
  initialData: ClientReport;
  section: string;
  owner: string;
}) {
  const router = useRouter();
  const [data, setData] = useState(initialData),
    [period, setPeriod] = useState("30d"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [busy, setBusy] = useState(false),
    [builder, setBuilder] = useState<string | null | undefined>(undefined),
    [mobileMore, setMobileMore] = useState(false),
    [dark, setDark] = useState(false),
    [search, setSearch] = useState(""),
    [searchOpen, setSearchOpen] = useState(false);
  const refresh = useCallback(async () => {
    const p = new URLSearchParams({
      period,
      ...(start && end ? { start, end } : {}),
    });
    const r = await fetch(`/api/report?${p}`);
    if (r.status === 401) {
      router.push("/login");
      return;
    }
    const result = await r.json();
    if (!r.ok) throw new Error(result.error);
    setData(result);
  }, [period, start, end, router]);
  async function changePeriod(next: string) {
    setPeriod(next);
    if (next === "custom") return;
    setBusy(true);
    try {
      const res = await fetch(`/api/report?period=${next}`);
      if (!res.ok) throw new Error("Could not load the reporting period.");
      setData(await res.json());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function create(id?: string) {
    setBuilder(id ?? null);
  }
  const matches = search.trim()
    ? data.items
        .filter((i) =>
          `${i.brand} ${i.model}`.toLowerCase().includes(search.toLowerCase()),
        )
        .slice(0, 5)
    : [];
  return (
    <DataContext.Provider value={{ data, refresh }}>
      <div className={`app-shell ${dark ? "dark" : ""}`}>
        <aside className="sidebar">
          <Link href="/dashboard" className="brand">
            <span className="brand-icon">
              <Dumbbell size={24} />
            </span>
            <span>
              fitware<span className="brand-dot">.</span>
            </span>
          </Link>
          <div className="workspace-selector">
            <span className="workspace-avatar">F</span>
            <div>
              <strong>{data.settings?.companyName ?? "Fitware Used"}</strong>
              <small>Business workspace</small>
            </div>
            <ChevronDown size={14} />
          </div>
          <div className="nav-label">WORKSPACE</div>
          <nav aria-label="Main navigation">
            {navigation.map((n) => (
              <Link
                key={n.id}
                href={`/${n.id}`}
                className={section === n.id ? "active" : ""}
              >
                <n.icon size={19} />
                <span>{n.label}</span>
                {n.id === "advisor" && <span className="nav-ai">AI</span>}
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-note">
              <ShieldIcon />
              <strong>You’re in control.</strong>
              <p>
                AI recommends.
                <br />
                You approve every change.
              </p>
            </div>
            <Link
              className={
                section === "settings"
                  ? "active settings-link"
                  : "settings-link"
              }
              href="/settings"
            >
              <SettingsIcon size={18} />
              Settings & integrations
            </Link>
            <div className="owner">
              <span className="avatar">FW</span>
              <div>
                <strong>{owner}</strong>
                <small>Administrator</small>
              </div>
              <button
                aria-label="Sign out"
                className="icon-button"
                onClick={async () => {
                  await fetch("/api/auth/sign-out", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: "{}",
                  });
                  router.push("/login");
                }}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumbs">
              <span>Workspace</span>
              <span>/</span>
              <strong>
                {navigation.find((n) => n.id === section)?.label ?? "Settings"}
              </strong>
            </div>
            <Link href="/dashboard" className="mobile-brand">
              <Dumbbell size={21} />
              fitware.
            </Link>
            <div className="topbar-actions">
              <button
                className="header-search"
                onClick={() => setSearchOpen(true)}
                aria-label="Search workspace"
              >
                <Search size={16} />
                <span>Search your workspace</span>
              </button>
              {data.demo && (
                <span className="demo-badge">
                  <span />
                  Demo mode
                </span>
              )}
              <button
                className="icon-button"
                aria-label={dark ? "Use light theme" : "Use dark theme"}
                onClick={() => setDark(!dark)}
              >
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                className="icon-button mobile-menu"
                aria-label="More navigation"
                onClick={() => setMobileMore(true)}
              >
                <Menu size={20} />
              </button>
            </div>
          </header>
          <main id="main-content">
            <div className="workspace-status">
              <span>
                <span className="status-dot" />
                {data.demo
                  ? "Demo workspace · simulated data"
                  : "Business workspace"}
                <span className="desktop-only"> · Asia/Bangkok</span>
              </span>
              {section !== "advisor" && section !== "settings" && (
                <div className="period-control">
                  <select
                    aria-label="Reporting period"
                    value={period}
                    onChange={(e) => changePeriod(e.target.value)}
                    disabled={busy}
                  >
                    <option value="today">Today</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="month">This month</option>
                    <option value="previous">Previous month</option>
                    <option value="custom">Custom dates</option>
                  </select>
                  {busy && <RefreshCw size={14} className="spin" />}
                </div>
              )}
            </div>
            {period === "custom" && (
              <form
                className="custom-range"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try {
                    await refresh();
                  } catch (e) {
                    toast.error((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  From
                  <input
                    type="date"
                    required
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </label>
                <label>
                  Through
                  <input
                    type="date"
                    required
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </label>
                <Button size="sm" disabled={busy}>
                  Apply dates
                </Button>
              </form>
            )}
            {section === "dashboard" ? (
              <Dashboard onCreate={create} />
            ) : section === "inventory" ? (
              <Inventory onCampaign={create} />
            ) : section === "campaigns" ? (
              <Campaigns onCreate={create} />
            ) : section === "leads" ? (
              <Leads />
            ) : section === "advisor" ? (
              <Advisor />
            ) : section === "analytics" ? (
              <Analytics />
            ) : (
              <Settings />
            )}
            <footer className="workspace-footer">
              FITWARE · EQUIPMENT TO OPPORTUNITY
              <span>
                {data.demo
                  ? "Demo data. No real advertising spend."
                  : "Private business workspace"}
              </span>
            </footer>
          </main>
        </div>
        <nav className="bottom-nav" aria-label="Mobile navigation">
          {navigation.slice(0, 5).map((n) => (
            <Link
              key={n.id}
              href={`/${n.id}`}
              className={section === n.id ? "active" : ""}
            >
              <n.icon size={21} />
              <span>{n.mobile}</span>
            </Link>
          ))}
        </nav>
        <Dialog
          open={mobileMore}
          onOpenChange={setMobileMore}
          title="Your workspace"
        >
          <div className="mobile-links">
            <Link href="/analytics" onClick={() => setMobileMore(false)}>
              <ChartNoAxesCombined />
              Analytics
            </Link>
            <Link href="/settings" onClick={() => setMobileMore(false)}>
              <SettingsIcon />
              Settings & integrations
            </Link>
            <button
              onClick={async () => {
                await fetch("/api/auth/sign-out", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: "{}",
                });
                router.push("/login");
              }}
            >
              <LogOut />
              Sign out
            </button>
          </div>
        </Dialog>
        <Dialog
          open={searchOpen}
          onOpenChange={setSearchOpen}
          title="Search your workspace"
        >
          <div className="search-input">
            <Search size={18} />
            <input
              autoFocus
              aria-label="Search machines and buyers"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a machine or buyer…"
            />
          </div>
          {matches.map((i) => (
            <Link
              className="list-row"
              key={i.id}
              href="/inventory"
              onClick={() => setSearchOpen(false)}
            >
              {i.brand} {i.model}
              <Package size={15} />
            </Link>
          ))}
          {search &&
            data.leads
              .filter((l) =>
                l.name.toLowerCase().includes(search.toLowerCase()),
              )
              .slice(0, 5)
              .map((l) => (
                <Link
                  className="list-row"
                  key={l.id}
                  href="/leads"
                  onClick={() => setSearchOpen(false)}
                >
                  {l.name}
                  <Users size={15} />
                </Link>
              ))}
        </Dialog>
        {builder !== undefined && (
          <CampaignBuilder
            key={builder ?? "new"}
            productId={builder}
            close={() => setBuilder(undefined)}
          />
        )}
      </div>
    </DataContext.Provider>
  );
}
function ShieldIcon() {
  return (
    <span className="sidebar-note-icon">
      <Sparkles size={18} />
    </span>
  );
}
