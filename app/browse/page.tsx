"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface DeckSummary {
  id: string;
  title: string;
  description: string | null;
  cardCount: number;
  ownerUsername: string | null;
  createdAt: string;
  type: "flashcard" | "library";
  visibility?: "public" | "private";
  setNames?: string[];
  hasCode?: boolean;
}

interface CardField { question: string; answer: string; }
interface SetField  { name: string; cards: CardField[]; }

// Module-level cache so deck list survives tab switches without re-flashing skeletons
let cachedPublicDecks: DeckSummary[] | null = null;

// ── Deck card ─────────────────────────────────────────────────────────────────

function DeckCard({ deck, onClick }: { deck: DeckSummary; onClick: () => void }) {
  const isPrivate = deck.visibility === "private";
  return (
    <div
      onClick={onClick}
      className="h-full flex flex-col gap-3 p-5 rounded-2xl border border-white/[0.08] bg-surface/60 card-inset stripe-bg card-hover-glow cursor-pointer hover:border-white/20 transition-colors min-h-[160px]"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-mist text-sm leading-snug">{deck.title}</h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {deck.type === "library" && (
            <span className="text-[9px] font-semibold uppercase tracking-widest text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded-full border border-indigo-400/20">
              Library
            </span>
          )}
          {isPrivate && (
            <span className="text-[9px] font-semibold uppercase tracking-widest text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-400/20 flex items-center gap-1">
              <LockIcon size={7} />
              Private
            </span>
          )}
          <span className="text-[10px] font-medium text-tomato bg-tomato/10 px-2 py-0.5 rounded-full">
            {deck.cardCount} {deck.cardCount === 1 ? "card" : "cards"}
          </span>
        </div>
      </div>
      {deck.description && (
        <p className="text-xs text-white/50 leading-relaxed line-clamp-2">{deck.description}</p>
      )}
      {deck.type === "library" && !isPrivate && deck.setNames && deck.setNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {deck.setNames.slice(0, 6).map((name, i) => (
            <span key={i} className="text-[10px] font-medium text-indigo-300/70 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-400/15">
              {name}
            </span>
          ))}
          {deck.setNames.length > 6 && (
            <span className="text-[10px] font-medium text-white/30 px-2.5 py-1">
              +{deck.setNames.length - 6} more
            </span>
          )}
        </div>
      )}
      <div className="flex items-center justify-between mt-auto pt-1">
        {deck.ownerUsername && (
          <span className="text-[10px] text-navy/40">by {deck.ownerUsername}</span>
        )}
        {deck.type === "library" ? (
          <span className="text-[10px] text-indigo-300/50 ml-auto flex items-center gap-1">
            {isPrivate
              ? <><LockIcon size={8} /> Enter code to view</>
              : <>{deck.setNames?.length ?? 0} sets</>
            }
          </span>
        ) : (
          <span className="text-[10px] text-navy/30 ml-auto">
            {new Date(deck.createdAt).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            })}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Small icons ───────────────────────────────────────────────────────────────

function LockIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor">
      <path d="M9 5V3.5a3 3 0 1 0-6 0V5H2v6h8V5H9ZM5 3.5a1 1 0 0 1 2 0V5H5V3.5Z"/>
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 10 10"
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
    >
      <path d="M2 3.5l3 3 3-3"/>
    </svg>
  );
}

// ── Library modal ─────────────────────────────────────────────────────────────

interface LibraryModalProps {
  deck: DeckSummary;
  onClose: () => void;
  onStudy: (id: string) => void;
}

function LibraryModal({ deck, onClose, onStudy }: LibraryModalProps) {
  const isPrivate = deck.visibility === "private";

  // Code-prompt state (private libraries only)
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetched full set data
  const [sets, setSets] = useState<SetField[] | null>(null);
  const [fetchLoading, setFetchLoading] = useState(!isPrivate);
  const [expandedSets, setExpandedSets] = useState<Record<number, boolean>>({});

  // Auto-fetch for public libraries on mount
  useEffect(() => {
    if (!isPrivate) {
      fetch(`/api/decks/${deck.id}/view`)
        .then((r) => r.json())
        .then((data) => { if (data.sets) setSets(data.sets); })
        .catch(() => {})
        .finally(() => setFetchLoading(false));
    } else {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [deck.id, isPrivate]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setCodeLoading(true);
    setCodeError("");
    try {
      const res = await fetch(`/api/decks/${deck.id}/view?code=${encodeURIComponent(code.trim())}`);
      const data = await res.json();
      if (res.ok && data.sets) {
        setSets(data.sets);
      } else {
        setCodeError(data.error ?? "Incorrect code.");
        inputRef.current?.focus();
      }
    } catch {
      setCodeError("Something went wrong.");
    } finally {
      setCodeLoading(false);
    }
  }

  function handleStudy() {
    if (code.trim()) {
      try { sessionStorage.setItem(`notara_code_${deck.id}`, code.trim()); } catch {}
    }
    onStudy(deck.id);
  }

  function toggleSet(i: number) {
    setExpandedSets((prev) => ({ ...prev, [i]: !prev[i] }));
  }

  const unlocked = sets !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#0f1117] shadow-2xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <span className="text-[9px] font-semibold uppercase tracking-widest text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded-full border border-indigo-400/20">
                  Library
                </span>
                {isPrivate && (
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-400/20 flex items-center gap-1">
                    <LockIcon size={7} /> Private
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-mist">{deck.title}</h2>
              {deck.description && (
                <p className="text-xs text-white/40 mt-1 leading-relaxed">{deck.description}</p>
              )}
              {deck.ownerUsername && (
                <p className="text-[10px] text-white/25 mt-1">by {deck.ownerUsername}</p>
              )}
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors shrink-0 mt-0.5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M12.7 3.3a1 1 0 0 0-1.4 0L8 6.6 4.7 3.3a1 1 0 0 0-1.4 1.4L6.6 8l-3.3 3.3a1 1 0 1 0 1.4 1.4L8 9.4l3.3 3.3a1 1 0 0 0 1.4-1.4L9.4 8l3.3-3.3a1 1 0 0 0 0-1.4Z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">

          {/* ── Lock screen ── */}
          {isPrivate && !unlocked && (
            <form onSubmit={handleUnlock} className="flex flex-col gap-4">
              <div className="flex flex-col items-center gap-3 py-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-400/20 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="text-amber-300">
                    <path d="M14 8V6a4 4 0 1 0-8 0v2H4v10h12V8h-2ZM8 6a2 2 0 0 1 4 0v2H8V6Z"/>
                  </svg>
                </div>
                <p className="text-sm text-white/55 text-center leading-relaxed">
                  This library is private. Enter the access code to browse its sets.
                </p>
              </div>
              <input
                ref={inputRef}
                type="text"
                value={code}
                onChange={(e) => { setCode(e.target.value); setCodeError(""); }}
                placeholder="Access code"
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-white/[0.1] bg-white/[0.04] text-mist placeholder:text-white/25 focus:outline-none focus:border-indigo-400/50 transition-colors"
                autoComplete="off"
              />
              {codeError && <p className="text-xs text-red-400 -mt-2">{codeError}</p>}
              <button
                type="submit"
                disabled={codeLoading || !code.trim()}
                className="w-full py-2.5 text-sm font-semibold rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 hover:bg-indigo-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {codeLoading ? "Checking…" : "Unlock"}
              </button>
            </form>
          )}

          {/* ── Loading ── */}
          {fetchLoading && (
            <div className="flex flex-col gap-2 py-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl border border-white/[0.06] bg-white/[0.03] animate-pulse" />
              ))}
            </div>
          )}

          {/* ── Sets list ── */}
          {unlocked && !fetchLoading && (
            sets.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-white/35">No sets in this library yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">
                  {sets.length} {sets.length === 1 ? "set" : "sets"} · {deck.cardCount} cards total
                </p>

                {sets.map((set, i) => (
                  <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.03] overflow-hidden">
                    {/* Set header */}
                    <button
                      onClick={() => toggleSet(i)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.04] transition-colors text-left"
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-sm font-semibold text-mist/90 truncate">{set.name}</span>
                        <span className="text-[10px] text-white/30">
                          {set.cards.length} {set.cards.length === 1 ? "card" : "cards"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); handleStudy(); }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleStudy(); } }}
                          className="text-[10px] font-semibold text-indigo-300/70 hover:text-indigo-200 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-500/15 cursor-pointer"
                        >
                          Study
                        </span>
                        <span className="text-white/30">
                          <ChevronIcon open={!!expandedSets[i]} />
                        </span>
                      </div>
                    </button>

                    {/* Cards inside set */}
                    {expandedSets[i] && (
                      <div className="border-t border-white/[0.06] flex flex-col divide-y divide-white/[0.04]">
                        {set.cards.map((card, ci) => (
                          <div key={ci} className="px-4 py-2.5 flex flex-col gap-1">
                            <p className="text-xs text-mist/80 leading-snug">{card.question}</p>
                            <p className="text-xs text-white/35 leading-snug">{card.answer}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Study all */}
                <button
                  onClick={handleStudy}
                  className="mt-1 w-full py-2.5 text-sm font-semibold rounded-xl bg-indigo-500/15 border border-indigo-400/25 text-indigo-200 hover:bg-indigo-500/25 transition-colors"
                >
                  Study all sets
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ── Browse page ───────────────────────────────────────────────────────────────

export default function Browse() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [decks, setDecks] = useState<DeckSummary[]>(cachedPublicDecks ?? []);
  const [loading, setLoading] = useState(cachedPublicDecks === null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "az" | "cards">("newest");
  const [openLibrary, setOpenLibrary] = useState<DeckSummary | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  function navigateTo(path: string) {
    setLeaving(true);
    setTimeout(() => router.push(path), 220);
  }

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          sessionStorage.setItem("notara_user", data.user.username);
          setCurrentUser(data.user.username);
        } else {
          sessionStorage.removeItem("notara_user");
          setCurrentUser(null);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/decks/public")
      .then((r) => r.json())
      .then((data) => {
        if (data.decks) {
          cachedPublicDecks = data.decks;
          setDecks(data.decks);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    sessionStorage.removeItem("notara_user");
    navigateTo("/");
  }

  function handleDeckClick(deck: DeckSummary) {
    if (deck.type === "library") {
      setOpenLibrary(deck);
    } else {
      navigateTo(`/study/${deck.id}`);
    }
  }

  const filtered = decks
    .filter(
      (d) =>
        d.title.toLowerCase().includes(query.toLowerCase()) ||
        (d.description ?? "").toLowerCase().includes(query.toLowerCase()) ||
        (d.ownerUsername ?? "").toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => {
      if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sort === "az") return a.title.localeCompare(b.title);
      if (sort === "cards") return b.cardCount - a.cardCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <div className={`min-h-screen flex flex-col font-sans ${leaving ? "animate-page-exit" : "animate-page-enter"}`}>
      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2">
          <button onClick={() => navigateTo("/")} className="text-base font-bold tracking-tight text-navy hover:opacity-70 transition-opacity">
            Notara
          </button>
          <span className="text-[9px] font-semibold uppercase tracking-widest text-tomato bg-tomato/10 px-2 py-0.5 rounded-full">beta</span>
        </div>
        <nav className="flex items-center gap-6">
          <button onClick={() => navigateTo("/browse")} className="text-sm text-navy font-medium transition-colors">
            Browse
          </button>
          {currentUser ? (
            <>
              <button onClick={() => navigateTo("/dashboard")} className="text-sm text-navy/50 hover:text-navy transition-colors">
                My Decks
              </button>
              <div className="flex items-center gap-3">
                <span className="text-sm text-navy/70 font-medium">{currentUser}</span>
                <button
                  onClick={handleSignOut}
                  className="text-sm border border-navy/20 text-navy/60 px-4 py-2 rounded-full font-medium hover:bg-navy/[0.06] transition-colors"
                >
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => navigateTo("/")}
              className="text-sm bg-navy text-mist border border-navy/20 px-4 py-2 rounded-full font-medium hover:bg-surface transition-colors hover-stripe"
            >
              Sign in
            </button>
          )}
        </nav>
      </header>

      {/* Main */}
      <main className="flex-1 px-8 py-10 max-w-5xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-navy/40 mb-1">Community</p>
            <h1 className="text-2xl font-bold text-navy tracking-tight">Browse decks</h1>
          </div>
          <input
            type="text"
            placeholder="Search decks…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full sm:w-64 px-4 py-2 text-sm rounded-full border border-navy/15 bg-white/[0.06] text-navy placeholder:text-navy/30 focus:outline-none focus:border-navy/40 transition-colors"
          />
        </div>

        {/* Sort pills */}
        <div className="flex items-center gap-2 mb-8">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-navy/30">Sort</span>
          {([ ["newest", "Newest"], ["oldest", "Oldest"], ["az", "A–Z"], ["cards", "Most cards"] ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSort(id)}
              className="text-[11px] font-semibold px-3 py-1 rounded-full border transition-colors"
              style={{
                background: sort === id ? "rgba(20,30,60,0.12)" : "transparent",
                borderColor: sort === id ? "rgba(20,30,60,0.25)" : "rgba(20,30,60,0.12)",
                color: sort === id ? "rgba(20,30,60,0.75)" : "rgba(20,30,60,0.35)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 rounded-2xl border border-white/[0.06] bg-surface/30 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-navy/40 text-sm">
              {query ? "No decks match your search." : "No decks yet. Be the first to create one!"}
            </p>
            {!query && currentUser && (
              <button
                onClick={() => navigateTo("/dashboard")}
                className="mt-4 text-sm bg-navy text-mist px-5 py-2.5 rounded-full font-medium hover:bg-surface transition-colors hover-stripe"
              >
                Create a deck
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((deck) => (
              <DeckCard key={deck.id} deck={deck} onClick={() => handleDeckClick(deck)} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-5 text-center text-xs text-navy/30">© 2026 Notara</footer>

      {/* Library modal */}
      {openLibrary && (
        <LibraryModal
          deck={openLibrary}
          onClose={() => setOpenLibrary(null)}
          onStudy={(id) => { setOpenLibrary(null); navigateTo(`/study/${id}`); }}
        />
      )}
    </div>
  );
}
