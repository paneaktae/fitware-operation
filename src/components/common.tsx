"use client";
import {
  createContext,
  useContext,
  cloneElement,
  isValidElement,
  type ReactElement,
} from "react";
import type { ClientReport } from "@/lib/data";
import { label } from "@/lib/format";
import { Package, ArrowUpRight } from "lucide-react";
import { Button } from "./ui/button";
export const DataContext = createContext<{
  data: ClientReport;
  refresh: () => Promise<void>;
}>({} as { data: ClientReport; refresh: () => Promise<void> });
export const useData = () => useContext(DataContext);
export async function api<T = unknown>(
  path: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method,
    headers:
      body instanceof FormData
        ? undefined
        : { "Content-Type": "application/json" },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  const result = await res.json();
  if (!res.ok)
    throw new Error(result.error ?? "Something went wrong. Please retry.");
  return result;
}
export function Badge({ status }: { status: string }) {
  return (
    <span className={`badge badge-${status.toLowerCase()}`}>
      <span />
      {label(status)}
    </span>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Package />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Field({
  label: caption,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{caption}</span>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<{ "aria-label"?: string }>, {
            "aria-label": caption,
          })
        : children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function ProductArt({
  item,
  large = false,
}: {
  item: ClientReport["items"][number];
  large?: boolean;
}) {
  const media = item.media.find((m) => m.type === "image");
  return (
    <div className={`product-art ${large ? "product-art-large" : ""}`}>
      {media ? (
        <img src={media.url} alt={media.alt || `${item.brand} ${item.model}`} />
      ) : (
        <>
          <div className="product-grid" />
          <svg
            viewBox="0 0 300 180"
            role="img"
            aria-label={`${item.model} illustration — not a product photo`}
          >
            <g
              fill="none"
              stroke="currentColor"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M57 152h186M85 151l19-94h59l42 94M109 59l-4-27h51v112M156 39h30l31 78M188 66l47-10M211 115h32M87 113h64" />
              <path d="M100 109l31-36h39" strokeWidth="15" />
              <path d="M131 72l-10-22" strokeWidth="12" />
              <path d="M59 143l-7-14m181 14l7-14" />
            </g>
            <g fill="currentColor">
              <rect x="174" y="112" width="22" height="30" rx="3" />
              <rect x="179" y="95" width="12" height="14" rx="2" />
            </g>
          </svg>
          <span className="art-label">ILLUSTRATION · ADD YOUR PHOTOS</span>
        </>
      )}
    </div>
  );
}
export function TextLink({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} />
    </Button>
  );
}
