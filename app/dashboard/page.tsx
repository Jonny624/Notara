"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface DeckSummary {
  id: string;
  title: string;
  description: string | null;
  cardCount: number;
  createdAt: string;
  type: "flashcard" | "library";
  visibility: "public" | "private";
  hidden: boolean;
  setCount?: number;
  setNames?: string[];
  accessCode?: string;
}

// ── Shared field types ────────────────────────────────────────────────────────

interface CardField {
  question: string;
  answer: string;
}

interface SetField {
  name: string;
  description?: string;
  cards: CardField[];
}

interface FullDeck {
  id: string;
  title: string;
  description: string | null;
  type: "flashcard" | "library";
  visibility: "public" | "private";
  hidden: boolean;
  cards: CardField[];
  sets: SetField[] | null;
}

// ── Bulk import helpers ───────────────────────────────────────────────────────

function parsePairs(text: string): CardField[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => {
      const ti = l.indexOf("\t");
      const pi = l.indexOf("|");
      const ci = l.indexOf(",");
      const sep = ti !== -1 ? ti : pi !== -1 ? pi : ci;
      if (sep === -1) return { question: l.replace(/\s+/g, " "), answer: "" };
      return { question: l.slice(0, sep).trim().replace(/\s+/g, " "), answer: l.slice(sep + 1).trim().replace(/\s+/g, " ") };
    })
    .filter((c) => c.question.length > 0);
}

function parseFilePairs(text: string, name: string): CardField[] {
  if (name.toLowerCase().endsWith(".json")) {
    try {
      const data = JSON.parse(text);
      if (!Array.isArray(data)) return [];
      return data
        .map((item): CardField | null => {
          if (Array.isArray(item) && item.length >= 2)
            return { question: String(item[0]).trim().replace(/\s+/g, " "), answer: String(item[1]).trim().replace(/\s+/g, " ") };
          if (item && typeof item === "object") {
            const q = String(item.question ?? item.front ?? item.term ?? item.q ?? "").trim().replace(/\s+/g, " ");
            const a = String(item.answer ?? item.back ?? item.definition ?? item.a ?? "").trim().replace(/\s+/g, " ");
            return { question: q, answer: a };
          }
          return null;
        })
        .filter((c): c is CardField => c !== null && c.question.length > 0);
    } catch { return []; }
  }
  return parsePairs(text);
}

// ── Deck modal (create & edit) ────────────────────────────────────────────────

function DeckModal({
  onClose,
  onSave,
  initialType = "flashcard",
  existing,
}: {
  onClose: () => void;
  onSave: (deck: DeckSummary) => void;
  initialType?: "flashcard" | "library";
  existing?: FullDeck;
}) {
  const isEdit = !!existing;

  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [cards, setCards] = useState<CardField[]>(
    existing && !existing.sets ? existing.cards : [{ question: "", answer: "" }]
  );
  const [sets, setSets] = useState<SetField[]>(
    existing?.sets ?? [{ name: "Set 1", cards: [{ question: "", answer: "" }] }]
  );
  const [deckType, setDeckType] = useState<"flashcard" | "library">(
    existing?.type ?? initialType
  );
  const [visibility, setVisibility] = useState<"public" | "private">(
    existing?.visibility ?? "public"
  );
  const [accessCode, setAccessCode] = useState("");
  const [hidden, setHidden] = useState(existing?.hidden ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importPickerOpen, setImportPickerOpen] = useState(false);
  const [importableDecks, setImportableDecks] = useState<DeckSummary[] | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [bulkTarget, setBulkTarget] = useState<"cards" | number | null>(null);
  const [bulkText, setBulkText] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);

  const initialTitle = existing?.title ?? "";
  const initialDescription = existing?.description ?? "";
  const initialCards = existing && !existing.sets ? existing.cards : [{ question: "", answer: "" }];
  const initialSets = existing?.sets ?? [{ name: "Set 1", cards: [{ question: "", answer: "" }] }];
  const initialVisibility = existing?.visibility ?? "public";
  const initialHidden = existing?.hidden ?? false;

  function isDirty() {
    if (title !== initialTitle) return true;
    if (description !== initialDescription) return true;
    if (visibility !== initialVisibility) return true;
    if (hidden !== initialHidden) return true;
    if (JSON.stringify(cards) !== JSON.stringify(initialCards)) return true;
    if (JSON.stringify(sets) !== JSON.stringify(initialSets)) return true;
    return false;
  }

  function confirmClose() {
    if (isDirty() && !window.confirm("You have unsaved changes. Discard and close?")) return;
    onClose();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") confirmClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, title, description, visibility, hidden, cards, sets]);

  // ── Flashcard card helpers ──
  function addCard() {
    setCards((prev) => [...prev, { question: "", answer: "" }]);
  }
  function removeCard(i: number) {
    setCards((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateCard(i: number, field: keyof CardField, value: string) {
    setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  }

  // ── Library set helpers ──
  function addSet() {
    setSets((prev) => [...prev, { name: `Set ${prev.length + 1}`, description: "", cards: [{ question: "", answer: "" }] }]);
  }
  function removeSet(si: number) {
    setSets((prev) => prev.filter((_, idx) => idx !== si));
  }
  function updateSetName(si: number, name: string) {
    setSets((prev) => prev.map((s, idx) => (idx === si ? { ...s, name } : s)));
  }
  function updateSetDescription(si: number, description: string) {
    setSets((prev) => prev.map((s, idx) => (idx === si ? { ...s, description } : s)));
  }
  function addCardToSet(si: number) {
    setSets((prev) =>
      prev.map((s, idx) => (idx === si ? { ...s, cards: [...s.cards, { question: "", answer: "" }] } : s))
    );
  }
  function removeCardFromSet(si: number, ci: number) {
    setSets((prev) =>
      prev.map((s, idx) => (idx === si ? { ...s, cards: s.cards.filter((_, cidx) => cidx !== ci) } : s))
    );
  }
  function updateCardInSet(si: number, ci: number, field: keyof CardField, value: string) {
    setSets((prev) =>
      prev.map((s, sidx) =>
        sidx === si
          ? { ...s, cards: s.cards.map((c, cidx) => (cidx === ci ? { ...c, [field]: value } : c)) }
          : s
      )
    );
  }

  async function openImportPicker() {
    setImportPickerOpen(true);
    if (importableDecks !== null) return;
    setImportLoading(true);
    const res = await fetch("/api/decks");
    const data = await res.json();
    setImportLoading(false);
    if (data.decks) {
      setImportableDecks(
        (data.decks as DeckSummary[]).filter((d) => d.id !== existing?.id)
      );
    }
  }

  async function importDeckAsSet(deckId: string) {
    const res = await fetch(`/api/decks/${deckId}`);
    const deck = await res.json() as FullDeck;
    setImportPickerOpen(false);
    const source = importableDecks?.find((d) => d.id === deckId);
    if (deck.type === "library" && deck.sets && deck.sets.length > 0) {
      setSets((prev) => [...prev, ...deck.sets!]);
    } else {
      setSets((prev) => [
        ...prev,
        { name: source?.title ?? `Set ${prev.length + 1}`, cards: deck.cards.length > 0 ? deck.cards : [{ question: "", answer: "" }] },
      ]);
    }
  }

  function openBulk(target: "cards" | number) {
    setBulkTarget(target);
    setBulkText("");
    if (bulkFileRef.current) bulkFileRef.current.value = "";
  }

  function applyBulk() {
    const pairs = parsePairs(bulkText);
    if (pairs.length === 0) return;
    if (bulkTarget === "cards") {
      setCards((prev) => [...prev, ...pairs]);
    } else if (typeof bulkTarget === "number") {
      setSets((prev) =>
        prev.map((s, i) => i === bulkTarget ? { ...s, cards: [...s.cards, ...pairs] } : s)
      );
    }
    setBulkText("");
    setBulkTarget(null);
  }

  function handleBulkFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const pairs = parseFilePairs(text, file.name);
      setBulkText(pairs.map((c) => `${c.question} | ${c.answer}`).join("\n"));
    };
    reader.readAsText(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const body: Record<string, unknown> = {
      title,
      description,
      type: deckType,
      visibility: deckType === "library" ? visibility : "public",
      accessCode: deckType === "library" && visibility === "private" ? accessCode : undefined,
      hidden,
    };

    if (deckType === "library") {
      body.sets = sets;
    } else {
      body.cards = cards;
    }

    const url = isEdit ? `/api/decks/${existing!.id}` : "/api/decks";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);
    if (data.error) {
      setError(data.error);
      return;
    }

    const cardCount =
      deckType === "library"
        ? sets.reduce((sum, s) => sum + s.cards.length, 0)
        : cards.length;

    onSave({
      id: isEdit ? existing!.id : data.id,
      title: data.title,
      description: description.trim() || null,
      cardCount,
      createdAt: new Date().toISOString(), // overridden by handleEdited for edits
      type: deckType,
      visibility: deckType === "library" ? visibility : "public",
      hidden,
      setCount: deckType === "library" ? sets.length : undefined,
      setNames: deckType === "library" ? sets.map((s) => s.name) : undefined,
    });
    onClose();
  }

  const inputCls =
    "w-full rounded-xl px-3.5 py-2.5 text-sm bg-navy/40 border border-white/10 text-mist placeholder:text-slate/50 outline-none focus:border-slate/50 transition-colors";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8"
      style={{ background: "rgba(20,30,60,0.72)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === overlayRef.current && confirmClose()}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-surface card-inset stripe-bg shadow-2xl px-8 py-8 flex flex-col gap-6 mx-4"
        style={{ boxShadow: "0 0 60px 10px rgba(49,74,130,0.35)" }}
      >
        {/* Close */}
        <button
          onClick={confirmClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full border border-white/10 text-slate/60 hover:text-mist transition-colors"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <h2 className="text-base font-bold tracking-tight text-mist">
          {isEdit ? "Edit deck" : "New deck"}
        </h2>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate">
              Title
            </label>
            <input
              type="text"
              placeholder="e.g. Biology Chapter 4"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate">
                Description
              </label>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-slate/40 border border-white/10 px-1.5 py-0.5 rounded-full">
                Optional
              </span>
            </div>
            <input
              type="text"
              placeholder="What's this deck about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate">
              Type
            </label>
            <div className="flex gap-2">
              {(["flashcard", "library"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDeckType(t)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold capitalize border transition-colors"
                  style={{
                    background: deckType === t ? "rgba(66,97,160,0.80)" : "rgba(255,255,255,0.03)",
                    borderColor: deckType === t ? "rgba(100,130,200,0.5)" : "rgba(255,255,255,0.10)",
                    color: deckType === t ? "#e8edf8" : "#7a8caa",
                  }}
                >
                  {t === "flashcard" ? "Flashcard" : "Library"}
                </button>
              ))}
            </div>
          </div>

          {/* Hide from browse */}
          <button
            type="button"
            onClick={() => setHidden((h) => !h)}
            className="flex items-center justify-between w-full rounded-xl px-4 py-3 border transition-colors"
            style={{
              background: hidden ? "rgba(66,97,160,0.15)" : "rgba(255,255,255,0.03)",
              borderColor: hidden ? "rgba(100,130,200,0.4)" : "rgba(255,255,255,0.10)",
            }}
          >
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-xs font-semibold text-mist">Hide from browse</span>
              <span className="text-[10px] text-slate/50">Won&apos;t appear in the public browse page</span>
            </div>
            <div
              className="w-9 h-5 rounded-full flex items-center transition-colors shrink-0"
              style={{ background: hidden ? "rgba(66,97,160,0.90)" : "rgba(255,255,255,0.12)" }}
            >
              <div
                className="w-3.5 h-3.5 rounded-full bg-white shadow transition-transform mx-0.5"
                style={{ transform: hidden ? "translateX(16px)" : "translateX(0)" }}
              />
            </div>
          </button>

          {/* Library options */}
          {deckType === "library" && (
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-navy/10 p-4">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate">
                Visibility
              </label>
              <div className="flex gap-2">
                {(["public", "private"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold capitalize border transition-colors"
                    style={{
                      background: visibility === v ? "rgba(66,97,160,0.80)" : "rgba(255,255,255,0.03)",
                      borderColor: visibility === v ? "rgba(100,130,200,0.5)" : "rgba(255,255,255,0.10)",
                      color: visibility === v ? "#e8edf8" : "#7a8caa",
                    }}
                  >
                    {v === "public" ? "Public" : "Private (code)"}
                  </button>
                ))}
              </div>
              {visibility === "private" && (
                <div className="flex flex-col gap-1.5 mt-1">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-slate">
                    Access code
                  </label>
                  <input
                    type="text"
                    placeholder={isEdit ? "Leave blank to keep existing code" : "Min 4 characters"}
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    className={inputCls}
                  />
                  <p className="text-[10px] text-slate/40 pl-1">
                    {isEdit
                      ? "Enter a new code to replace the existing one, or leave blank to keep it."
                      : "Share this code with people you want to give access."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Sets (library) or Cards (flashcard) */}
          {deckType === "library" ? (
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate">
                Sets
              </label>
              <div className="flex flex-col gap-4 max-h-72 overflow-y-auto pr-1">
                {sets.map((set, si) => (
                  <div
                    key={si}
                    className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-navy/20 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-semibold uppercase tracking-widest text-slate/50">
                        Set {si + 1}
                      </span>
                      {sets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSet(si)}
                          className="text-slate/40 hover:text-tomato/70 transition-colors text-xs"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Set name"
                      value={set.name}
                      onChange={(e) => updateSetName(si, e.target.value)}
                      className={inputCls}
                    />
                    <input
                      type="text"
                      placeholder="Set description (optional)"
                      value={set.description ?? ""}
                      onChange={(e) => updateSetDescription(si, e.target.value)}
                      className={inputCls}
                      style={{ opacity: 0.75 }}
                    />
                    <div className="flex flex-col gap-2 mt-1">
                      {set.cards.map((card, ci) => (
                        <div
                          key={ci}
                          className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-navy/30 p-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-semibold uppercase tracking-widest text-slate/40">
                              Card {ci + 1}
                            </span>
                            {set.cards.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeCardFromSet(si, ci)}
                                className="text-slate/40 hover:text-tomato/70 transition-colors text-xs"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            placeholder="Question"
                            value={card.question}
                            onChange={(e) => updateCardInSet(si, ci, "question", e.target.value)}
                            className={inputCls}
                          />
                          <input
                            type="text"
                            placeholder="Answer"
                            value={card.answer}
                            onChange={(e) => updateCardInSet(si, ci, "answer", e.target.value)}
                            className={inputCls}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => addCardToSet(si)}
                        className="text-[11px] font-semibold px-3 py-1 rounded-full border border-white/10 text-slate hover:text-mist transition-colors"
                        style={{ background: "rgba(255,255,255,0.04)" }}
                      >
                        + Add card
                      </button>
                      <button
                        type="button"
                        onClick={() => openBulk(si)}
                        className="text-[11px] font-semibold px-3 py-1 rounded-full border transition-colors"
                        style={{ background: "rgba(66,97,160,0.12)", borderColor: "rgba(100,130,200,0.30)", color: "#8A9BC4" }}
                      >
                        + Bulk import
                      </button>
                    </div>
                    {bulkTarget === si && (
                      <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-navy/30 p-3 mt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate">Bulk import into set {si + 1}</span>
                          <button type="button" onClick={() => setBulkTarget(null)} className="text-slate/40 hover:text-mist text-xs transition-colors">Cancel</button>
                        </div>
                        <p className="text-[10px] text-slate/50">One card per line · separate question and answer with <code className="text-slate/70">|</code> comma or tab</p>
                        <textarea
                          rows={4}
                          placeholder={"Alabama | Montgomery\nAlaska | Juneau\nArizona | Phoenix"}
                          value={bulkText}
                          onChange={(e) => setBulkText(e.target.value)}
                          className={inputCls + " resize-none font-mono text-xs leading-relaxed"}
                        />
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-semibold px-3 py-1 rounded-full border border-white/10 text-slate hover:text-mist transition-colors cursor-pointer" style={{ background: "rgba(255,255,255,0.04)" }}>
                            Upload file
                            <input ref={bulkFileRef} type="file" accept=".csv,.tsv,.txt,.json" className="sr-only" onChange={handleBulkFile} />
                          </label>
                          <span className="text-[10px] text-slate/40">.csv .tsv .txt .json</span>
                          <button
                            type="button"
                            onClick={applyBulk}
                            disabled={parsePairs(bulkText).length === 0}
                            className="ml-auto text-[11px] font-semibold px-4 py-1.5 rounded-full transition-colors disabled:opacity-40"
                            style={{ background: "rgba(66,97,160,0.80)", color: "#e8edf8" }}
                          >
                            Add {parsePairs(bulkText).length} cards
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addSet}
                  className="text-[11px] font-semibold px-4 py-1.5 rounded-full border border-white/10 text-slate hover:text-mist transition-colors"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  + New set
                </button>
                <button
                  type="button"
                  onClick={openImportPicker}
                  className="text-[11px] font-semibold px-4 py-1.5 rounded-full border transition-colors"
                  style={{ background: "rgba(66,97,160,0.15)", borderColor: "rgba(100,130,200,0.35)", color: "#8A9BC4" }}
                >
                  + Import deck
                </button>
              </div>

              {/* Import deck picker */}
              {importPickerOpen && (
                <div className="rounded-2xl border border-white/10 bg-navy/30 p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate">Import deck</span>
                    <button
                      type="button"
                      onClick={() => setImportPickerOpen(false)}
                      className="text-slate/40 hover:text-mist text-xs transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                  {importLoading ? (
                    <p className="text-[11px] text-slate/50 py-2">Loading decks…</p>
                  ) : !importableDecks || importableDecks.length === 0 ? (
                    <p className="text-[11px] text-slate/50 py-2">No decks to import.</p>
                  ) : (
                    <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                      {importableDecks.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => importDeckAsSet(d.id)}
                          className="flex items-center justify-between px-3 py-2 rounded-xl text-left border border-white/[0.06] hover:border-white/20 transition-colors"
                          style={{ background: "rgba(255,255,255,0.04)" }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-mist truncate">{d.title}</span>
                            {d.type === "library" && (
                              <span className="text-[9px] font-semibold uppercase tracking-widest text-indigo-300 bg-indigo-500/15 px-1.5 py-0.5 rounded-full border border-indigo-400/20 shrink-0">
                                Library
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate/50 shrink-0 ml-2">
                            {d.type === "library" && d.setCount != null
                              ? `${d.setCount} sets · ${d.cardCount} cards`
                              : `${d.cardCount} cards`}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate">
                Cards
              </label>
              <div className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-1">
                {cards.map((card, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-navy/20 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-semibold uppercase tracking-widest text-slate/50">
                        Card {i + 1}
                      </span>
                      {cards.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCard(i)}
                          className="text-slate/40 hover:text-tomato/70 transition-colors text-xs"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Question"
                      value={card.question}
                      onChange={(e) => updateCard(i, "question", e.target.value)}
                      className={inputCls}
                    />
                    <input
                      type="text"
                      placeholder="Answer"
                      value={card.answer}
                      onChange={(e) => updateCard(i, "answer", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addCard}
                  className="text-[11px] font-semibold px-4 py-1.5 rounded-full border border-white/10 text-slate hover:text-mist transition-colors"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  + Add card
                </button>
                <button
                  type="button"
                  onClick={() => openBulk("cards")}
                  className="text-[11px] font-semibold px-4 py-1.5 rounded-full border transition-colors"
                  style={{ background: "rgba(66,97,160,0.12)", borderColor: "rgba(100,130,200,0.30)", color: "#8A9BC4" }}
                >
                  + Bulk import
                </button>
              </div>
              {bulkTarget === "cards" && (
                <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-navy/30 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate">Bulk import cards</span>
                    <button type="button" onClick={() => setBulkTarget(null)} className="text-slate/40 hover:text-mist text-xs transition-colors">Cancel</button>
                  </div>
                  <p className="text-[10px] text-slate/50">One card per line · separate question and answer with <code className="text-slate/70">|</code> comma or tab</p>
                  <textarea
                    rows={5}
                    placeholder={"Alabama | Montgomery\nAlaska | Juneau\nArizona | Phoenix"}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    className={inputCls + " resize-none font-mono text-xs leading-relaxed"}
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-semibold px-3 py-1 rounded-full border border-white/10 text-slate hover:text-mist transition-colors cursor-pointer" style={{ background: "rgba(255,255,255,0.04)" }}>
                      Upload file
                      <input ref={bulkFileRef} type="file" accept=".csv,.tsv,.txt,.json" className="sr-only" onChange={handleBulkFile} />
                    </label>
                    <span className="text-[10px] text-slate/40">.csv .tsv .txt .json</span>
                    <button
                      type="button"
                      onClick={applyBulk}
                      disabled={parsePairs(bulkText).length === 0}
                      className="ml-auto text-[11px] font-semibold px-4 py-1.5 rounded-full transition-colors disabled:opacity-40"
                      style={{ background: "rgba(66,97,160,0.80)", color: "#e8edf8" }}
                    >
                      Add {parsePairs(bulkText).length} cards
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-[10px] text-tomato/80 pl-1 -mt-1">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full py-2.5 text-sm font-semibold text-mist hover-stripe transition-colors disabled:opacity-50"
            style={{ background: "rgba(66,97,160,0.88)" }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = "rgba(78,109,182,0.95)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(66,97,160,0.88)")}
          >
            {loading ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save changes" : "Create deck"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Quick Add modal ──────────────────────────────────────────────────────────

function QuickAddModal({
  decks,
  onClose,
  onSaved,
}: {
  decks: DeckSummary[];
  onClose: () => void;
  onSaved: (deckId: string, addedCount: number) => void;
}) {
  const [mode, setMode] = useState<"repeat" | "bulk">("repeat");
  const [phrase, setPhrase] = useState("");
  const [times, setTimes] = useState(1);
  const [field, setField] = useState<"question" | "answer">("question");
  const [otherValue, setOtherValue] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [selectedDeckId, setSelectedDeckId] = useState(decks[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const clampedTimes = Math.max(1, Math.min(50, times));
  const bulkPairs = parsePairs(bulkText);

  function handleBulkFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const pairs = parseFilePairs(text, file.name);
      setBulkText(pairs.map((c) => `${c.question} | ${c.answer}`).join("\n"));
    };
    reader.readAsText(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDeckId) { setError("Select a deck to add to."); return; }

    let newCards: CardField[];
    if (mode === "bulk") {
      if (bulkPairs.length === 0) { setError("No valid pairs found. Use question | answer format."); return; }
      newCards = bulkPairs;
    } else {
      if (!phrase.trim()) { setError("Phrase cannot be empty."); return; }
      newCards = Array.from({ length: clampedTimes }, () => ({
        question: field === "question" ? phrase.trim().replace(/\s+/g, " ") : otherValue.trim().replace(/\s+/g, " "),
        answer: field === "answer" ? phrase.trim().replace(/\s+/g, " ") : otherValue.trim().replace(/\s+/g, " "),
      }));
    }

    setError(null);
    setLoading(true);

    const res = await fetch(`/api/decks/${selectedDeckId}`);
    const deck = await res.json() as FullDeck;
    if (deck && "error" in (deck as unknown as Record<string, unknown>)) {
      setError("Could not load deck.");
      setLoading(false);
      return;
    }

    let body: Record<string, unknown>;
    if (deck.type === "library" && deck.sets && deck.sets.length > 0) {
      const sets = deck.sets.map((s, i) =>
        i === 0 ? { ...s, cards: [...s.cards, ...newCards] } : s
      );
      body = { title: deck.title, description: deck.description, type: deck.type, visibility: deck.visibility, sets };
    } else {
      body = { title: deck.title, description: deck.description, type: deck.type, visibility: deck.visibility, cards: [...deck.cards, ...newCards] };
    }

    const putRes = await fetch(`/api/decks/${selectedDeckId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await putRes.json();
    setLoading(false);
    if (data.error) { setError(data.error); return; }
    onSaved(selectedDeckId, newCards.length);
    onClose();
  }

  const inputCls =
    "w-full rounded-xl px-3.5 py-2.5 text-sm bg-navy/40 border border-white/10 text-mist placeholder:text-slate/50 outline-none focus:border-slate/50 transition-colors";

  const previewPhrase = phrase.trim() || "…";
  const previewOther = otherValue.trim() || "…";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8"
      style={{ background: "rgba(20,30,60,0.72)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-surface card-inset stripe-bg shadow-2xl px-8 py-8 flex flex-col gap-6 mx-4"
        style={{ boxShadow: "0 0 60px 10px rgba(49,74,130,0.35)" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full border border-white/10 text-slate/60 hover:text-mist transition-colors"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <div>
          <h2 className="text-base font-bold tracking-tight text-mist">Quick add</h2>
          <p className="text-[11px] text-slate/60 mt-1">
            {mode === "repeat" ? "Fill one side of a card with a repeated phrase." : "Paste or upload multiple pairs at once."}
          </p>
        </div>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          {/* Mode toggle */}
          <div className="flex gap-1 p-1 rounded-xl border border-white/10" style={{ background: "rgba(255,255,255,0.03)" }}>
            {(["repeat", "bulk"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  background: mode === m ? "rgba(66,97,160,0.80)" : "transparent",
                  color: mode === m ? "#e8edf8" : "#7a8caa",
                }}
              >
                {m === "repeat" ? "Repeat phrase" : "Bulk pairs"}
              </button>
            ))}
          </div>

          {/* Deck selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate">Deck</label>
            <select
              value={selectedDeckId}
              onChange={(e) => setSelectedDeckId(e.target.value)}
              className={inputCls + " appearance-none cursor-pointer"}
            >
              {decks.map((d) => (
                <option key={d.id} value={d.id} style={{ background: "#395791" }}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>

          {mode === "bulk" ? (
            <>
              {/* Paste area */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-slate">Paste pairs</label>
                <p className="text-[10px] text-slate/50 -mt-0.5">
                  One card per line · separate question and answer with <code className="text-slate/70">|</code> comma or tab
                </p>
                <textarea
                  rows={7}
                  placeholder={"Alabama | Montgomery\nAlaska | Juneau\nArizona | Phoenix\n\nOr upload a .csv / .json file below"}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  className={inputCls + " resize-none font-mono text-xs leading-relaxed"}
                  autoFocus
                />
              </div>

              {/* File upload */}
              <label
                className="flex items-center gap-2 self-start text-[11px] font-semibold px-4 py-1.5 rounded-full border border-white/10 text-slate hover:text-mist transition-colors cursor-pointer"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                Upload file
                <span className="text-[10px] text-slate/40 font-normal">.csv .tsv .txt .json</span>
                <input ref={bulkFileRef} type="file" accept=".csv,.tsv,.txt,.json" className="sr-only" onChange={handleBulkFile} />
              </label>

              {/* Preview */}
              <div className="rounded-2xl border border-white/[0.08] bg-navy/30 px-4 py-3 flex flex-col gap-2">
                <span className="text-[9px] font-semibold uppercase tracking-widest text-slate/50">
                  {bulkPairs.length === 0 ? "No pairs yet" : `${bulkPairs.length} card${bulkPairs.length === 1 ? "" : "s"} parsed`}
                </span>
                {bulkPairs.slice(0, 2).map((c, i) => (
                  <div key={i} className="flex flex-col gap-1 text-xs mt-1">
                    <div className="flex gap-2">
                      <span className="text-slate/50 w-14 shrink-0">Question</span>
                      <span className="text-mist/80 truncate">{c.question || "…"}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-slate/50 w-14 shrink-0">Answer</span>
                      <span className="text-mist/80 truncate">{c.answer || "…"}</span>
                    </div>
                  </div>
                ))}
                {bulkPairs.length > 2 && (
                  <p className="text-[10px] text-slate/40 mt-0.5">+{bulkPairs.length - 2} more…</p>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Phrase */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-slate">Phrase / word</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. photosynthesis"
                    value={phrase}
                    onChange={(e) => setPhrase(e.target.value)}
                    className={inputCls + " pr-9"}
                    autoFocus
                  />
                  {phrase && (
                    <button
                      type="button"
                      onClick={() => setPhrase("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-slate/40 hover:text-mist transition-colors"
                      style={{ background: "rgba(255,255,255,0.07)" }}
                    >
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor">
                        <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Times */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-slate">
                  Repeat <span className="text-mist/70">{clampedTimes}×</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={times}
                  onChange={(e) => setTimes(parseInt(e.target.value) || 1)}
                  className={inputCls}
                />
              </div>

              {/* Field toggle */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-slate">Phrase goes in</label>
                <div className="flex gap-2">
                  {(["question", "answer"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setField(f)}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold capitalize border transition-colors"
                      style={{
                        background: field === f ? "rgba(66,97,160,0.80)" : "rgba(255,255,255,0.03)",
                        borderColor: field === f ? "rgba(100,130,200,0.5)" : "rgba(255,255,255,0.10)",
                        color: field === f ? "#e8edf8" : "#7a8caa",
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Other field */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-slate">
                    {field === "question" ? "Answer" : "Question"}
                  </label>
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-slate/40 border border-white/10 px-1.5 py-0.5 rounded-full">
                    Optional
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Same for all cards, or leave blank"
                    value={otherValue}
                    onChange={(e) => setOtherValue(e.target.value)}
                    className={inputCls + " pr-9"}
                  />
                  {otherValue && (
                    <button
                      type="button"
                      onClick={() => setOtherValue("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-slate/40 hover:text-mist transition-colors"
                      style={{ background: "rgba(255,255,255,0.07)" }}
                    >
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor">
                        <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Preview */}
              <div className="rounded-2xl border border-white/[0.08] bg-navy/30 px-4 py-3 flex flex-col gap-2">
                <span className="text-[9px] font-semibold uppercase tracking-widest text-slate/50">Preview · 1 of {clampedTimes}</span>
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex gap-2">
                    <span className="text-slate/50 w-14 shrink-0">Question</span>
                    <span className="text-mist/80 truncate">{field === "question" ? previewPhrase : previewOther}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate/50 w-14 shrink-0">Answer</span>
                    <span className="text-mist/80 truncate">{field === "answer" ? previewPhrase : previewOther}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {decks.length === 0 && (
            <p className="text-[11px] text-slate/60 text-center -mt-1">
              Create a deck first before using Quick add.
            </p>
          )}
          {error && <p className="text-[10px] text-tomato/80 pl-1 -mt-1">{error}</p>}

          <button
            type="submit"
            disabled={loading || decks.length === 0}
            title={decks.length === 0 ? "Create a deck first" : undefined}
            className="w-full rounded-full py-2.5 text-sm font-semibold text-mist hover-stripe transition-colors disabled:opacity-50"
            style={{ background: "rgba(66,97,160,0.88)" }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = "rgba(78,109,182,0.95)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(66,97,160,0.88)")}
          >
            {loading
              ? "Adding…"
              : mode === "bulk"
              ? `Add ${bulkPairs.length} card${bulkPairs.length === 1 ? "" : "s"}`
              : `Add ${clampedTimes} ${clampedTimes === 1 ? "card" : "cards"}`}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Deck card ────────────────────────────────────────────────────────────────

function DeckCard({ deck, onEdit, onDelete, onStudy }: { deck: DeckSummary; onEdit: (deck: DeckSummary) => void; onDelete: (deck: DeckSummary) => void; onStudy: (deck: DeckSummary) => void }) {
  const isLibrary = deck.type === "library";
  const isPrivate = deck.visibility === "private";
  const isHidden = deck.hidden;
  const [codeOpen, setCodeOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!codeOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (codeRef.current && !codeRef.current.contains(e.target as Node)) {
        setCodeOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [codeOpen]);

  function handleCopy() {
    if (!deck.accessCode) return;
    navigator.clipboard.writeText(deck.accessCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  }

  return (
    <div onClick={() => onStudy(deck)} className="group relative h-full flex flex-col gap-3 p-6 rounded-2xl border border-white/[0.08] bg-surface/60 card-inset stripe-bg card-hover-glow cursor-pointer hover:border-white/20 transition-colors min-h-[160px]">
      {/* Edit button */}
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(deck); }}
        className="absolute top-3 right-11 opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-full border border-white/10 text-slate/50 hover:text-mist"
        style={{ background: "rgba(255,255,255,0.05)" }}
        title="Edit"
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8.5 1.5l2 2L4 10H2v-2L8.5 1.5z" />
        </svg>
      </button>
      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(deck); }}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-full border border-white/10 text-slate/50 hover:text-red-400"
        style={{ background: "rgba(255,255,255,0.05)" }}
        title="Delete"
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h8M5 3V2h2v1M4 3v7h4V3H4z" />
        </svg>
      </button>
      {/* Access code popup (private libraries only) */}
      {isPrivate && deck.accessCode && (
        <div ref={codeRef} className="absolute top-3 right-[76px] opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); setCodeOpen((o) => !o); }}
            className="w-7 h-7 flex items-center justify-center rounded-full border border-white/10 text-slate/50 hover:text-amber-300 transition-colors"
            style={{ background: "rgba(255,255,255,0.05)" }}
            title="Show access code"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
              <path d="M9 5V3.5a3 3 0 1 0-6 0V5H2v6h8V5H9ZM5 3.5a1 1 0 0 1 2 0V5H5V3.5Z"/>
            </svg>
          </button>
          {codeOpen && (
            <div
              className="absolute right-0 top-9 z-50 rounded-xl border border-white/10 shadow-xl p-3 flex flex-col gap-2"
              style={{ background: "rgba(18,22,40,0.97)", backdropFilter: "blur(12px)", minWidth: 180 }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[9px] font-semibold uppercase tracking-widest text-slate/50">Access code</p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono font-bold text-amber-200 flex-1 select-all">{deck.accessCode}</code>
                <button
                  onClick={handleCopy}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-lg transition-colors shrink-0"
                  style={{
                    background: copied ? "rgba(66,160,97,0.25)" : "rgba(66,97,160,0.25)",
                    color: copied ? "rgba(100,220,140,0.9)" : "rgba(140,160,210,0.9)",
                  }}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <h3 className="font-semibold text-mist text-sm leading-snug pr-6">{deck.title}</h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isLibrary && (
            <span className="text-[9px] font-semibold uppercase tracking-widest text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded-full border border-indigo-400/20">
              Library
            </span>
          )}
          {isLibrary && isPrivate && (
            <span className="text-[9px] font-semibold uppercase tracking-widest text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-400/20">
              Private
            </span>
          )}
          {isHidden && (
            <span className="text-[9px] font-semibold uppercase tracking-widest text-slate/60 bg-white/[0.06] px-2 py-0.5 rounded-full border border-white/10">
              Hidden
            </span>
          )}
        </div>
      </div>
      {deck.description && (
        <p className="text-xs text-white/50 leading-relaxed line-clamp-2">{deck.description}</p>
      )}
      <div className="mt-auto pt-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate/60">
          {deck.setCount != null
            ? `${deck.setCount} ${deck.setCount === 1 ? "set" : "sets"} · ${deck.cardCount} ${deck.cardCount === 1 ? "card" : "cards"}`
            : `${deck.cardCount} ${deck.cardCount === 1 ? "card" : "cards"}`}
        </span>
        <span className="text-[10px] text-slate/40">
          {new Date(deck.createdAt).toLocaleDateString()}
        </span>
      </div>
      {isLibrary && deck.setNames && deck.setNames.length > 0 && (
        <div onClick={(e) => e.stopPropagation()} className="flex flex-wrap gap-1.5 pt-1 border-t border-white/[0.06]">
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
    </div>
  );
}

// Module-level cache so deck list survives tab switches without re-flashing skeletons.
let cachedDecks: { username: string; decks: DeckSummary[] } | null = null;

// ── Dashboard ────────────────────────────────────────────────────────────────

const SOUND_KEY      = "notara_sound";
const ANIM_PKG_KEY   = "notara_anim_pkg";
const STACK_DEPTH_KEY = "notara_stack_depth";
const ANIM_CUSTOM_KEY = "notara_anim_custom";
const CARD_TILT_KEY    = "notara_card_tilt";
const CARD_TURN_KEY    = "notara_card_turn";
const PLAYING_CARD_KEY = "notara_playing_card";
const SHADING_KEY      = "notara_card_shading";

type CardTiltId = "flat" | "slight" | "angled" | "dramatic";
type CardTurnId = "left" | "none" | "right";
const CARD_TILT_OPTIONS: { id: CardTiltId; label: string }[] = [
  { id: "flat",     label: "Flat"     },
  { id: "slight",   label: "Slight"   },
  { id: "angled",   label: "Angled"   },
  { id: "dramatic", label: "Dramatic" },
];
const CARD_TURN_OPTIONS: { id: CardTurnId; label: string }[] = [
  { id: "left",  label: "Left"  },
  { id: "none",  label: "None"  },
  { id: "right", label: "Right" },
];

type PkgId = "classic" | "tricks" | "magic" | "custom";
const FLIP_PACKAGES: { id: PkgId; label: string; start: number; end: number }[] = [
  { id: "classic", label: "Classic",     start: 0,  end: 12 },
  { id: "tricks",  label: "Card Tricks", start: 12, end: 22 },
  { id: "magic",   label: "Magic",       start: 22, end: 30 },
  { id: "custom",  label: "Custom",      start: 0,  end: 0  },
];

const FLIP_NAMES = [
  "Right", "Down", "Left", "Up",
  "Diagonal ↘", "Diagonal ↗", "Edge ↘", "Edge ↗",
  "Zoom", "Swing", "Snap", "Rise",
  "Riffle", "Aerial", "Palm", "Deal", "Flourish",
  "Wrist Flip", "Spring", "Triple", "Cut", "Cascade",
  "Crumple", "Banish", "Conjure", "Transmute",
  "Enchant", "Portal", "Smoke", "Spellbound",
];

const FLIP_BANK_SIZE = 30;

function getCustomIndices(): number[] {
  try {
    const raw = localStorage.getItem(ANIM_CUSTOM_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as number[];
      const valid = arr.filter((i) => Number.isInteger(i) && i >= 0 && i < FLIP_BANK_SIZE);
      if (valid.length > 0) return valid;
    }
  } catch {}
  return Array.from({ length: FLIP_BANK_SIZE }, (_, i) => i);
}

export default function Dashboard() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [decksLoading, setDecksLoading] = useState(true);
  const [sort, setSort] = useState<"newest" | "oldest" | "az" | "cards">("newest");
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateLibrary, setShowCreateLibrary] = useState(false);
  const [editingDeck, setEditingDeck] = useState<FullDeck | null>(null);
  const [editFetchError, setEditFetchError] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [animPkg, setAnimPkgState] = useState<PkgId>("classic");
  const [customIndices, setCustomIndicesState] = useState<number[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cardTilt, setCardTiltState] = useState<CardTiltId>("angled");
  const [cardTurn, setCardTurnState] = useState<CardTurnId>("none");
  const [playingCardVisible, setPlayingCardVisibleState] = useState(false);
  const [shadingEnabled, setShadingEnabledState] = useState(true);
  const [stackDepth, setStackDepthState] = useState<0 | 1 | 2>(2);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setSoundEnabled(localStorage.getItem(SOUND_KEY) === "1");
      const raw = localStorage.getItem(ANIM_PKG_KEY) as PkgId | null;
      if (raw && FLIP_PACKAGES.some((p) => p.id === raw)) setAnimPkgState(raw);
      setCustomIndicesState(getCustomIndices());
      const tiltRaw = localStorage.getItem(CARD_TILT_KEY) as CardTiltId | null;
      if (tiltRaw && CARD_TILT_OPTIONS.some((o) => o.id === tiltRaw)) setCardTiltState(tiltRaw);
      const turnRaw = localStorage.getItem(CARD_TURN_KEY) as CardTurnId | null;
      if (turnRaw && CARD_TURN_OPTIONS.some((o) => o.id === turnRaw)) setCardTurnState(turnRaw);
      if (!localStorage.getItem(PLAYING_CARD_KEY)) localStorage.setItem(PLAYING_CARD_KEY, "off");
      setPlayingCardVisibleState(localStorage.getItem(PLAYING_CARD_KEY) === "on");
      setShadingEnabledState(localStorage.getItem(SHADING_KEY) !== "off");
      const depthRaw = parseInt(localStorage.getItem(STACK_DEPTH_KEY) ?? "2");
      if ([0, 1, 2].includes(depthRaw)) setStackDepthState(depthRaw as 0 | 1 | 2);
    } catch {}
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    if (settingsOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [settingsOpen]);

  function toggleSound() {
    setSoundEnabled((v) => {
      const next = !v;
      try { localStorage.setItem(SOUND_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  }

  function setAnimPkg(id: PkgId) {
    setAnimPkgState(id);
    try { localStorage.setItem(ANIM_PKG_KEY, id); } catch {}
  }

  function setCardTilt(id: CardTiltId) {
    setCardTiltState(id);
    try { localStorage.setItem(CARD_TILT_KEY, id); } catch {}
    window.dispatchEvent(new CustomEvent("notara-card-tilt", { detail: id }));
  }

  function setCardTurn(id: CardTurnId) {
    setCardTurnState(id);
    try { localStorage.setItem(CARD_TURN_KEY, id); } catch {}
    window.dispatchEvent(new CustomEvent("notara-card-turn", { detail: id }));
  }

  function togglePlayingCard() {
    const next = !playingCardVisible;
    try { localStorage.setItem(PLAYING_CARD_KEY, next ? "on" : "off"); } catch {}
    setPlayingCardVisibleState(next);
    window.dispatchEvent(new CustomEvent("notara-playing-card", { detail: next }));
  }

  function toggleShading() {
    setShadingEnabledState((v) => {
      const next = !v;
      try { localStorage.setItem(SHADING_KEY, next ? "on" : "off"); } catch {}
      return next;
    });
  }

  function setStackDepth(v: 0 | 1 | 2) {
    setStackDepthState(v);
    try { localStorage.setItem(STACK_DEPTH_KEY, String(v)); } catch {}
  }

  function toggleCustomIndex(i: number) {
    setCustomIndicesState((prev) => {
      const next = prev.includes(i)
        ? prev.length > 1 ? prev.filter((x) => x !== i) : prev
        : [...prev, i];
      try { localStorage.setItem(ANIM_CUSTOM_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function navigateTo(path: string) {
    setLeaving(true);
    setTimeout(() => router.push(path), 100);
  }

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          sessionStorage.setItem("notara_user", data.user.username);
          setUsername(data.user.username);
          setEmail(data.user.email ?? null);
        } else {
          sessionStorage.removeItem("notara_user");
          navigateTo("/");
        }
      })
      .catch(() => navigateTo("/"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!username) return;
    if (cachedDecks?.username === username) {
      setDecks(cachedDecks.decks);
      setDecksLoading(false);
      return;
    }
    fetch("/api/decks")
      .then((r) => r.json())
      .then((data) => {
        if (data.decks) {
          cachedDecks = { username, decks: data.decks };
          setDecks(data.decks);
        }
      })
      .catch(() => {})
      .finally(() => setDecksLoading(false));
  }, [username]);

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    sessionStorage.removeItem("notara_user");
    cachedDecks = null;
    navigateTo("/");
  }

  async function openEdit(summary: DeckSummary) {
    setEditFetchError(null);
    const res = await fetch(`/api/decks/${summary.id}`);
    const data = await res.json();
    if (data.error) {
      setEditFetchError(data.error);
      return;
    }
    setEditingDeck(data as FullDeck);
  }

  function handleCreated(deck: DeckSummary) {
    setDecks((prev) => {
      const next = [deck, ...prev];
      if (username) cachedDecks = { username, decks: next };
      return next;
    });
  }

  function handleQuickAdded(deckId: string, addedCount: number) {
    setDecks((prev) => {
      const next = prev.map((d) =>
        d.id === deckId ? { ...d, cardCount: d.cardCount + addedCount } : d
      );
      if (username) cachedDecks = { username, decks: next };
      return next;
    });
  }

  async function handleDelete(deck: DeckSummary) {
    if (!confirm(`Delete "${deck.title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/decks/${deck.id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.error) {
      setEditFetchError(data.error);
      return;
    }
    setDecks((prev) => {
      const next = prev.filter((d) => d.id !== deck.id);
      if (username) cachedDecks = { username, decks: next };
      return next;
    });
  }

  function handleEdited(updated: DeckSummary) {
    setDecks((prev) => {
      const next = prev.map((d) => (d.id === updated.id ? { ...d, ...updated, createdAt: d.createdAt } : d));
      if (username) cachedDecks = { username, decks: next };
      return next;
    });
  }

  return (
    <div
      className={`min-h-screen flex flex-col font-sans ${leaving ? "animate-page-exit" : "animate-page-enter"}`}
    >
      {showCreate && (
        <DeckModal
          onClose={() => setShowCreate(false)}
          onSave={handleCreated}
        />
      )}
      {showCreateLibrary && (
        <DeckModal
          initialType="library"
          onClose={() => setShowCreateLibrary(false)}
          onSave={handleCreated}
        />
      )}
      {editingDeck && (
        <DeckModal
          existing={editingDeck}
          onClose={() => setEditingDeck(null)}
          onSave={handleEdited}
        />
      )}
      {showQuickAdd && (
        <QuickAddModal
          decks={decks}
          onClose={() => setShowQuickAdd(false)}
          onSaved={handleQuickAdded}
        />
      )}

      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2">
          <a
            href="/"
            className="text-base font-bold tracking-tight text-navy hover:opacity-70 transition-opacity"
          >
            Notara
          </a>
          <span className="text-[9px] font-semibold uppercase tracking-widest text-tomato bg-tomato/10 px-2 py-0.5 rounded-full">
            beta
          </span>
        </div>
        <nav className="flex items-center gap-6">
          <button
            onClick={() => navigateTo("/browse")}
            className="text-sm text-navy/50 hover:text-navy transition-colors"
          >
            Browse
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-navy/70 font-medium">{username}</span>

            {/* Settings */}
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setSettingsOpen((o) => !o)}
                title="Settings"
                className="w-8 h-8 flex items-center justify-center rounded-full border border-navy/30 text-navy/60 hover:text-navy hover:bg-navy/[0.06] transition-colors"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>

              {settingsOpen && (
                <div
                  className="absolute right-0 top-10 z-50 rounded-xl border border-white/10 shadow-xl p-4"
                  style={{
                    background: "rgba(18,22,40,0.97)",
                    backdropFilter: "blur(12px)",
                    width: animPkg === "custom" ? 252 : 196,
                  }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate/50 mb-3">Settings</p>
                  <label className="flex items-center justify-between gap-4 cursor-pointer select-none">
                    <span className="text-sm text-mist/80">Flip sounds</span>
                    <button
                      role="switch"
                      aria-checked={soundEnabled}
                      onClick={toggleSound}
                      className="relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none"
                      style={{ background: soundEnabled ? "rgba(66,97,160,0.9)" : "rgba(228,234,248,0.12)" }}
                    >
                      <span
                        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                        style={{ transform: soundEnabled ? "translateX(16px)" : "translateX(0)" }}
                      />
                    </button>
                  </label>
                  <div className="mt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate/50 mb-2">Flip style</p>
                    <div className="flex flex-wrap gap-1.5">
                      {FLIP_PACKAGES.map((pkg) => (
                        <button
                          key={pkg.id}
                          onClick={() => setAnimPkg(pkg.id)}
                          className="text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors"
                          style={{
                            background: animPkg === pkg.id ? "rgba(66,97,160,0.88)" : "rgba(228,234,248,0.08)",
                            color: animPkg === pkg.id ? "rgba(228,234,248,0.95)" : "rgba(228,234,248,0.45)",
                          }}
                        >
                          {pkg.label}
                        </button>
                      ))}
                    </div>
                    {animPkg === "custom" && (
                      <div className="mt-3 pt-3 border-t border-white/[0.06]">
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate/40 mb-1.5">Classic</p>
                        <div className="flex flex-wrap gap-1 mb-2.5">
                          {FLIP_NAMES.slice(0, 17).map((name, i) => (
                            <button
                              key={i}
                              onClick={() => toggleCustomIndex(i)}
                              className="text-[9px] font-semibold px-2 py-0.5 rounded-full transition-colors"
                              style={{
                                background: customIndices.includes(i) ? "rgba(66,97,160,0.7)" : "rgba(228,234,248,0.06)",
                                color: customIndices.includes(i) ? "rgba(228,234,248,0.9)" : "rgba(228,234,248,0.3)",
                              }}
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate/40 mb-1.5">Card Tricks</p>
                        <div className="flex flex-wrap gap-1 mb-2.5">
                          {FLIP_NAMES.slice(17, 22).map((name, j) => (
                            <button
                              key={j + 17}
                              onClick={() => toggleCustomIndex(j + 17)}
                              className="text-[9px] font-semibold px-2 py-0.5 rounded-full transition-colors"
                              style={{
                                background: customIndices.includes(j + 17) ? "rgba(66,97,160,0.7)" : "rgba(228,234,248,0.06)",
                                color: customIndices.includes(j + 17) ? "rgba(228,234,248,0.9)" : "rgba(228,234,248,0.3)",
                              }}
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate/40 mb-1.5">Magic</p>
                        <div className="flex flex-wrap gap-1">
                          {FLIP_NAMES.slice(22).map((name, j) => (
                            <button
                              key={j + 22}
                              onClick={() => toggleCustomIndex(j + 22)}
                              className="text-[9px] font-semibold px-2 py-0.5 rounded-full transition-colors"
                              style={{
                                background: customIndices.includes(j + 22) ? "rgba(66,97,160,0.7)" : "rgba(228,234,248,0.06)",
                                color: customIndices.includes(j + 22) ? "rgba(228,234,248,0.9)" : "rgba(228,234,248,0.3)",
                              }}
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Vanity */}
                  <div className="mt-4 pt-4 border-t border-white/[0.06]">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate/50 mb-3">Vanity</p>
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-slate/40 mb-1.5">Tilt</p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {CARD_TILT_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setCardTilt(opt.id)}
                          className="text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors"
                          style={{
                            background: cardTilt === opt.id ? "rgba(66,97,160,0.88)" : "rgba(228,234,248,0.08)",
                            color: cardTilt === opt.id ? "rgba(228,234,248,0.95)" : "rgba(228,234,248,0.45)",
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-slate/40 mb-1.5">Turn</p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {CARD_TURN_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setCardTurn(opt.id)}
                          className="text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors"
                          style={{
                            background: cardTurn === opt.id ? "rgba(66,97,160,0.88)" : "rgba(228,234,248,0.08)",
                            color: cardTurn === opt.id ? "rgba(228,234,248,0.95)" : "rgba(228,234,248,0.45)",
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center justify-between gap-4 cursor-pointer select-none mb-2">
                      <span className="text-sm text-mist/80">Corner card</span>
                      <button
                        role="switch"
                        aria-checked={playingCardVisible}
                        onClick={togglePlayingCard}
                        className="relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none"
                        style={{ background: playingCardVisible ? "rgba(66,97,160,0.9)" : "rgba(228,234,248,0.12)" }}
                      >
                        <span
                          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                          style={{ transform: playingCardVisible ? "translateX(16px)" : "translateX(0)" }}
                        />
                      </button>
                    </label>
                    <label className="flex items-center justify-between gap-4 cursor-pointer select-none">
                      <span className="text-sm text-mist/80">Card shading</span>
                      <button
                        role="switch"
                        aria-checked={shadingEnabled}
                        onClick={toggleShading}
                        className="relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none"
                        style={{ background: shadingEnabled ? "rgba(66,97,160,0.9)" : "rgba(228,234,248,0.12)" }}
                      >
                        <span
                          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                          style={{ transform: shadingEnabled ? "translateX(16px)" : "translateX(0)" }}
                        />
                      </button>
                    </label>
                    <div className="mt-3">
                      <p className="text-[9px] font-semibold uppercase tracking-widest text-slate/40 mb-1.5">Stack depth</p>
                      <div className="flex gap-1.5">
                        {([0, 1, 2] as const).map((d) => (
                          <button
                            key={d}
                            onClick={() => setStackDepth(d)}
                            className="flex-1 text-[10px] font-semibold py-1 rounded-full transition-colors"
                            style={{
                              background: stackDepth === d ? "rgba(66,97,160,0.88)" : "rgba(228,234,248,0.08)",
                              color: stackDepth === d ? "rgba(228,234,248,0.95)" : "rgba(228,234,248,0.45)",
                            }}
                          >
                            {d === 0 ? "Flat" : d === 1 ? "1" : "2"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {email === "jonnyparent6@gmail.com" && (
              <button
                onClick={() => navigateTo("/admin")}
                className="text-sm border border-navy/20 text-navy/60 px-4 py-2 rounded-full font-medium hover:bg-navy/[0.06] transition-colors"
              >
                Admin
              </button>
            )}
            <button
              onClick={handleSignOut}
              className="text-sm border border-navy/20 text-navy/60 px-4 py-2 rounded-full font-medium hover:bg-navy/[0.06] transition-colors"
            >
              Sign out
            </button>
          </div>
        </nav>
      </header>

      {/* Main */}
      <main className="flex-1 px-8 py-10 max-w-5xl mx-auto w-full">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-navy">My Decks</h1>
            <p className="text-sm text-navy/40 mt-1">
              {decksLoading
                ? "Loading…"
                : decks.length === 0
                ? "No decks yet."
                : `${decks.length} ${decks.length === 1 ? "deck" : "decks"}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {editFetchError && (
              <span className="text-[10px] text-tomato/80">{editFetchError}</span>
            )}
            <button
              onClick={() => setShowQuickAdd(true)}
              className="px-5 py-2.5 rounded-full font-semibold text-sm transition-colors"
              style={{ background: "rgba(66,97,160,0.15)", border: "1px solid rgba(66,97,160,0.35)", color: "#314a82" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(66,97,160,0.25)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(66,97,160,0.15)"; }}
            >
              + Quick add
            </button>
            <button
              onClick={() => setShowCreateLibrary(true)}
              className="border border-navy/25 text-navy px-5 py-2.5 rounded-full font-semibold text-sm hover:bg-navy/[0.06] transition-colors"
            >
              + Create library
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-navy text-mist px-5 py-2.5 rounded-full font-semibold text-sm hover:bg-surface transition-colors hover-stripe btn-hover-glow"
            >
              + New deck
            </button>
          </div>
        </div>

        {/* Sort pills */}
        {!decksLoading && decks.length > 0 && (
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
        )}

        {/* Grid */}
        {decksLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-36 rounded-2xl border border-white/[0.06] bg-surface/40 animate-pulse"
              />
            ))}
          </div>
        ) : decks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="w-14 h-14 rounded-full bg-surface border border-white/10 flex items-center justify-center card-inset stripe-bg">
              <span className="text-navy/20 font-bold text-xl">?</span>
            </div>
            <p className="text-sm text-navy/40 max-w-xs leading-relaxed">
              You don&apos;t have any decks yet. Create your first one to get started.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-navy text-mist px-6 py-2.5 rounded-full font-semibold text-sm hover:bg-surface transition-colors hover-stripe"
            >
              Create a deck
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...decks].sort((a, b) => {
              if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
              if (sort === "az") return a.title.localeCompare(b.title);
              if (sort === "cards") return b.cardCount - a.cardCount;
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }).map((deck) => (
              <DeckCard key={deck.id} deck={deck} onEdit={openEdit} onDelete={handleDelete} onStudy={(d) => navigateTo(`/study/${d.id}`)} />
            ))}
          </div>
        )}
      </main>

      <footer className="py-5 text-center text-xs text-navy/30">© 2026 Notara</footer>
    </div>
  );
}
