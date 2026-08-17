"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const ADMIN_EMAIL = "jonnyparent6@gmail.com";

// ── Placeholder data ──────────────────────────────────────────────────────────

const STATS = [
  { label: "Total Users", value: "—" },
  { label: "Total Decks", value: "—" },
  { label: "Total Cards", value: "—" },
  { label: "Active Today", value: "—" },
];

const PLACEHOLDER_USERS = [
  { id: "u1", email: "alice@example.com", decks: 12, joined: "2026-01-04", status: "active" },
  { id: "u2", email: "bob@example.com", decks: 3, joined: "2026-03-17", status: "active" },
  { id: "u3", email: "carol@example.com", decks: 0, joined: "2026-07-22", status: "suspended" },
];

const PLACEHOLDER_DECKS = [
  { id: "d1", title: "Spanish Basics", owner: "alice@example.com", cards: 40, visibility: "public" },
  { id: "d2", title: "SAT Vocab", owner: "bob@example.com", cards: 200, visibility: "public" },
  { id: "d3", title: "Private Notes", owner: "carol@example.com", cards: 8, visibility: "private" },
];

// ── Tab type ──────────────────────────────────────────────────────────────────

type Tab = "overview" | "users" | "decks" | "settings";

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user?.email === ADMIN_EMAIL) {
          setAllowed(true);
        } else {
          router.replace("/");
        }
      })
      .catch(() => router.replace("/"));
  }, [router]);

  if (allowed === null) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--color-cream)" }}>
      {/* Header */}
      <header
        className="stripe-bg card-inset"
        style={{
          background: "var(--color-navy)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}
              className="hover:opacity-80 transition-opacity"
            >
              ← Back
            </button>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
            <h1 className="font-semibold" style={{ color: "#fff", fontSize: 16 }}>
              Notara Admin
            </h1>
          </div>
          <span
            className="text-xs px-2 py-1 rounded"
            style={{
              background: "rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.6)",
              fontFamily: "var(--font-mono)",
            }}
          >
            placeholder data
          </span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Tabs */}
        <nav className="flex gap-1 mb-8" style={{ borderBottom: "1px solid rgba(49,74,130,0.15)" }}>
          {(["overview", "users", "decks", "settings"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="capitalize px-4 py-2 text-sm transition-colors"
              style={{
                color: tab === t ? "var(--color-navy)" : "var(--color-slate)",
                borderBottom: tab === t ? "2px solid var(--color-navy)" : "2px solid transparent",
                fontWeight: tab === t ? 600 : 400,
                marginBottom: -1,
                background: "none",
                cursor: "pointer",
              }}
            >
              {t}
            </button>
          ))}
        </nav>

        {/* Overview tab */}
        {tab === "overview" && (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {STATS.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl p-5"
                  style={{
                    background: "#fff",
                    border: "1px solid rgba(49,74,130,0.12)",
                    boxShadow: "0 1px 4px rgba(49,74,130,0.06)",
                  }}
                >
                  <div
                    style={{ fontSize: 28, fontWeight: 700, color: "var(--color-navy)" }}
                  >
                    {s.value}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--color-slate)", marginTop: 2 }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            <PlaceholderChart label="Signups over time" />
            <div className="mt-4">
              <PlaceholderChart label="Study sessions over time" height={120} />
            </div>
          </div>
        )}

        {/* Users tab */}
        {tab === "users" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--color-ink)" }}>Users</h2>
              <button className="btn-hover-glow text-sm px-3 py-1.5 rounded-lg" style={actionBtnStyle}>
                + Invite user
              </button>
            </div>
            <Table
              columns={["Email", "Decks", "Joined", "Status", ""]}
              rows={PLACEHOLDER_USERS.map((u) => [
                u.email,
                String(u.decks),
                u.joined,
                <StatusBadge key={u.id} status={u.status} />,
                <RowActions key={u.id} />,
              ])}
            />
          </div>
        )}

        {/* Decks tab */}
        {tab === "decks" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--color-ink)" }}>All Decks</h2>
              <input
                placeholder="Search decks…"
                className="text-sm px-3 py-1.5 rounded-lg outline-none"
                style={{
                  border: "1px solid rgba(49,74,130,0.2)",
                  background: "#fff",
                  color: "var(--color-ink)",
                  width: 200,
                }}
              />
            </div>
            <Table
              columns={["Title", "Owner", "Cards", "Visibility", ""]}
              rows={PLACEHOLDER_DECKS.map((d) => [
                d.title,
                d.owner,
                String(d.cards),
                <VisibilityBadge key={d.id} v={d.visibility} />,
                <RowActions key={d.id} />,
              ])}
            />
          </div>
        )}

        {/* Settings tab */}
        {tab === "settings" && (
          <div className="max-w-lg">
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--color-ink)", marginBottom: 20 }}>
              Site Settings
            </h2>
            {[
              { label: "Site name", placeholder: "Notara" },
              { label: "Support email", placeholder: "support@example.com" },
              { label: "Max decks per user", placeholder: "50" },
            ].map((f) => (
              <div key={f.label} className="mb-5">
                <label className="block text-sm mb-1" style={{ color: "var(--color-ink)", fontWeight: 500 }}>
                  {f.label}
                </label>
                <input
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    border: "1px solid rgba(49,74,130,0.2)",
                    background: "#fff",
                    color: "var(--color-ink)",
                  }}
                />
              </div>
            ))}
            <div className="mb-5">
              <label className="block text-sm mb-1" style={{ color: "var(--color-ink)", fontWeight: 500 }}>
                Maintenance mode
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-navy" />
                <span className="text-sm" style={{ color: "var(--color-slate)" }}>
                  Show maintenance banner to all users
                </span>
              </label>
            </div>
            <button className="btn-hover-glow text-sm px-4 py-2 rounded-lg" style={actionBtnStyle}>
              Save changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PlaceholderChart({ label, height = 160 }: { label: string; height?: number }) {
  return (
    <div
      className="rounded-xl flex flex-col items-center justify-center gap-2"
      style={{
        height,
        background: "#fff",
        border: "1px dashed rgba(49,74,130,0.2)",
        color: "var(--color-slate)",
        fontSize: 13,
      }}
    >
      <svg width={32} height={32} viewBox="0 0 32 32" fill="none">
        <rect x={2} y={18} width={6} height={12} rx={1} fill="rgba(49,74,130,0.15)" />
        <rect x={10} y={10} width={6} height={20} rx={1} fill="rgba(49,74,130,0.15)" />
        <rect x={18} y={14} width={6} height={16} rx={1} fill="rgba(49,74,130,0.15)" />
        <rect x={26} y={6} width={6} height={24} rx={1} fill="rgba(49,74,130,0.15)" />
      </svg>
      {label}
    </div>
  );
}

function Table({ columns, rows }: { columns: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid rgba(49,74,130,0.12)", background: "#fff" }}
    >
      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(49,74,130,0.1)" }}>
            {columns.map((c) => (
              <th
                key={c}
                className="text-left px-4 py-3"
                style={{ color: "var(--color-slate)", fontWeight: 500, fontSize: 12 }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{ borderBottom: i < rows.length - 1 ? "1px solid rgba(49,74,130,0.07)" : "none" }}
            >
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3" style={{ color: "var(--color-ink)" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full"
      style={{
        background: active ? "rgba(49,74,130,0.1)" : "rgba(200,60,60,0.1)",
        color: active ? "var(--color-navy)" : "#b94040",
        fontWeight: 500,
      }}
    >
      {status}
    </span>
  );
}

function VisibilityBadge({ v }: { v: string }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full"
      style={{
        background: v === "public" ? "rgba(49,74,130,0.1)" : "rgba(0,0,0,0.05)",
        color: v === "public" ? "var(--color-navy)" : "var(--color-slate)",
        fontWeight: 500,
      }}
    >
      {v}
    </span>
  );
}

function RowActions() {
  return (
    <div className="flex gap-2 justify-end">
      <button
        className="text-xs px-2 py-1 rounded"
        style={{ color: "var(--color-slate)", background: "rgba(49,74,130,0.06)", cursor: "pointer" }}
      >
        View
      </button>
      <button
        className="text-xs px-2 py-1 rounded"
        style={{ color: "#b94040", background: "rgba(200,60,60,0.07)", cursor: "pointer" }}
      >
        Delete
      </button>
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  background: "var(--color-navy)",
  color: "#fff",
  border: "none",
  cursor: "pointer",
  fontWeight: 500,
};
