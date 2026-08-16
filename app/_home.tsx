"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Loading from "./loading";

const CARDS = [
  { question: "What is the powerhouse of the cell?", answer: "Mitochondria" },
  { question: "What year did World War II end?", answer: "1945" },
  { question: "What is the chemical symbol for gold?", answer: "Au" },
  { question: "Who wrote Romeo and Juliet?", answer: "Shakespeare" },
  { question: "What is the largest planet in the solar system?", answer: "Jupiter" },
  { question: "How many sides does a hexagon have?", answer: "Six" },
];

// Each entry: CSS transform applied when flipped (transition-based), OR an
// animClass that drives the flip entirely via @keyframes (no inline transform).
// Animated variants must end at rotateY(180deg) so the back face — which is
// pre-rotated rotateY(180deg) — faces the viewer correctly in the final state.
type FlipVariant =
  | { container: string; back: string; animClass?: undefined }
  | { container?: undefined; back: string; animClass: string };

// indices 0-11: Classic   indices 12-21: Card Tricks   indices 22-29: Magic
const FLIP_BANK: FlipVariant[] = [
  // Classic
  { container: "rotateY(180deg)",          back: "rotateY(180deg)"          },  // 0  Right
  { container: "rotateX(180deg)",          back: "rotateX(180deg)"          },  // 1  Down
  { container: "rotateY(-180deg)",         back: "rotateY(-180deg)"         },  // 2  Left
  { container: "rotateX(-180deg)",         back: "rotateX(-180deg)"         },  // 3  Up
  { container: "rotate3d(1,1,0,180deg)",   back: "rotate3d(1,1,0,180deg)"  },  // 4  Diagonal ↘
  { container: "rotate3d(1,-1,0,180deg)",  back: "rotate3d(1,-1,0,180deg)" },  // 5  Diagonal ↗
  { container: "rotate3d(0,1,1,180deg)",   back: "rotate3d(0,1,1,180deg)"  },  // 6  Edge ↘
  { container: "rotate3d(0,-1,1,180deg)",  back: "rotate3d(0,-1,1,180deg)" },  // 7  Edge ↗
  { back: "rotateY(180deg)", animClass: "flip-zoom"     },                      // 8  Zoom
  { back: "rotateY(180deg)", animClass: "flip-swing"    },                      // 9  Swing
  { back: "rotateY(180deg)", animClass: "flip-snap"     },                      // 10 Snap
  { back: "rotateY(180deg)", animClass: "flip-rise"     },                      // 11 Rise
  // Card Tricks
  { back: "rotateY(180deg)", animClass: "card-riffle"   },                      // 12 Riffle
  { back: "rotateY(180deg)", animClass: "card-aerial"   },                      // 13 Aerial
  { back: "rotateY(180deg)", animClass: "card-palm"     },                      // 14 Palm
  { back: "rotateY(180deg)", animClass: "card-deal"     },                      // 15 Deal
  { back: "rotateY(180deg)", animClass: "card-flourish" },                      // 16 Flourish
  { back: "rotateY(180deg)", animClass: "card-wrist"    },                      // 17 Wrist Flip
  { back: "rotateY(180deg)", animClass: "card-spring"   },                      // 18 Spring
  { back: "rotateY(180deg)", animClass: "card-triple"   },                      // 19 Triple
  { back: "rotateY(180deg)", animClass: "card-cut"      },                      // 20 Cut
  { back: "rotateY(180deg)", animClass: "card-cascade"  },                      // 21 Cascade
  // Magic
  { back: "rotateY(180deg)", animClass: "magic-crumple"    },                   // 22 Crumple
  { back: "rotateY(180deg)", animClass: "magic-banish"     },                   // 23 Banish
  { back: "rotateY(180deg)", animClass: "magic-conjure"    },                   // 24 Conjure
  { back: "rotateY(180deg)", animClass: "magic-transmute"  },                   // 25 Transmute
  { back: "rotateY(180deg)", animClass: "magic-enchant"    },                   // 26 Enchant
  { back: "rotateY(180deg)", animClass: "magic-portal"     },                   // 27 Portal
  { back: "rotateY(180deg)", animClass: "magic-smoke"      },                   // 28 Smoke
  { back: "rotateY(180deg)", animClass: "magic-spellbound" },                   // 29 Spellbound
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

const LAST_ANIM_KEY   = "notara_last_anim";
const ANIM_PKG_KEY    = "notara_anim_pkg";
const ANIM_CUSTOM_KEY = "notara_anim_custom";
const CARD_TILT_KEY     = "notara_card_tilt";
const CARD_TURN_KEY     = "notara_card_turn";
const PLAYING_CARD_KEY  = "notara_playing_card";
const SHADING_KEY       = "notara_card_shading";

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

interface FlipPackage { id: PkgId; label: string; indices: number[]; }

const FLIP_PACKAGES: FlipPackage[] = [
  { id: "classic", label: "Classic",     indices: [0,1,2,3,4,5,6,7,8,9,10,11]                 },
  { id: "tricks",  label: "Card Tricks", indices: [12,13,14,15,16,17,18,19,20,21]              },
  { id: "magic",   label: "Magic",       indices: [22,23,24,25,26,27,28,29]                    },
  { id: "custom",  label: "Custom",      indices: []                                            },
];

function getCustomIndices(): number[] {
  try {
    const raw = localStorage.getItem(ANIM_CUSTOM_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as number[];
      const valid = arr.filter((i) => Number.isInteger(i) && i >= 0 && i < FLIP_BANK.length);
      if (valid.length > 0) return valid;
    }
  } catch {}
  return FLIP_BANK.map((_, i) => i);
}

function getActiveBank(): FlipVariant[] {
  try {
    const raw = localStorage.getItem(ANIM_PKG_KEY) as PkgId | null;
    if (raw === "custom") return getCustomIndices().map((i) => FLIP_BANK[i]);
    const pkg = FLIP_PACKAGES.find((p) => p.id === raw) ?? FLIP_PACKAGES[0];
    return pkg.indices.map((i) => FLIP_BANK[i]);
  } catch {
    return FLIP_BANK;
  }
}

function loadLastVariant(): FlipVariant | null {
  try {
    const raw = localStorage.getItem(LAST_ANIM_KEY);
    if (raw !== null) {
      const idx = parseInt(raw, 10);
      return FLIP_BANK[idx] ?? null;
    }
  } catch {}
  return null;
}

function saveLastVariant(v: FlipVariant) {
  try {
    localStorage.setItem(LAST_ANIM_KEY, String(FLIP_BANK.indexOf(v)));
  } catch {}
}

/** Pick a random variant from the active package, excluding `exclude` to prevent back-to-back repeats. */
function pickVariant(exclude: FlipVariant | null = null): FlipVariant {
  const bank = getActiveBank();
  let pick: FlipVariant;
  do {
    pick = bank[Math.floor(Math.random() * bank.length)];
  } while (exclude !== null && pick === exclude && bank.length > 1);
  return pick;
}

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Assign one variant per card; no two adjacent cards share the same variant.
 * `firstExclude` prevents the first card from repeating the last-used variant
 * (persisted in localStorage) across shuffles / page loads.
 */
function randomVariants(
  cards: typeof CARDS,
  firstExclude: FlipVariant | null = null,
): FlipVariant[] {
  const result: FlipVariant[] = [];
  for (let i = 0; i < cards.length; i++) {
    const exclude = i === 0 ? firstExclude : result[i - 1];
    result.push(pickVariant(exclude ?? null));
  }
  return result;
}

/** Four-pointed star icon used for the stack-mode toggle */
function StarIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      className="spin-slow"
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="currentColor"
    >
      <path d="M6 0.4 L6.8 5.2 L11.6 6 L6.8 6.8 L6 11.6 L5.2 6.8 L0.4 6 L5.2 5.2 Z" />
    </svg>
  );
}

function playFlipSound() {
  try {
    const ctx = new AudioContext();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3) * 0.18;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    src.onended = () => ctx.close();
  } catch {}
}

function CardStack({ soundEnabled }: { soundEnabled: boolean }) {
  // SSR-safe: start ordered; shuffle on first client paint
  const [cards, setCards] = useState(CARDS);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [exiting, setExiting] = useState(false);

  const [variants, setVariants] = useState(() =>
    CARDS.map((_, i) => FLIP_BANK[i % FLIP_BANK.length])
  );

  // Tap-to-advance mode: second tap on a revealed card advances instead of showing Continue button
  const [tapToAdvance, setTapToAdvance] = useState(false);

  // Infinite blank-card stack mode
  const [stackMode, setStackMode] = useState(false);
  const [stackIdx, setStackIdx] = useState(0);
  const [stackFlipped, setStackFlipped] = useState(false);
  const [stackExiting, setStackExiting] = useState(false);
  const [stackVariant, setStackVariant] = useState<FlipVariant>(FLIP_BANK[0]);

  useEffect(() => {
    const shuffled = fisherYates(CARDS);
    setCards(shuffled);
    setVariants(randomVariants(shuffled, loadLastVariant()));
  }, []);

  const card = cards[idx];
  const variant = variants[idx];
  const isLast = idx === cards.length - 1;

  function toggleStackMode() {
    setStackMode((m) => {
      if (!m) {
        // entering stack mode — reset stack position and pick first variant
        setStackIdx(0);
        setStackFlipped(false);
        setStackExiting(false);
        setStackVariant(pickVariant(loadLastVariant()));
      }
      return !m;
    });
  }

  function handleFlip() {
    if (stackMode) {
      if (!stackFlipped) {
        if (soundEnabled) playFlipSound();
        setStackFlipped(true);
        saveLastVariant(stackVariant);
      } else if (tapToAdvance) {
        advance();
      }
      return;
    }
    if (!flipped) {
      if (soundEnabled) playFlipSound();
      setFlipped(true);
      saveLastVariant(variant);
    } else if (tapToAdvance) {
      advance();
    }
  }

  function advance() {
    if (stackMode) {
      if (stackExiting) return;
      setStackExiting(true);
      const nextVariant = pickVariant(stackVariant);
      setTimeout(() => {
        setStackIdx((i) => i + 1);
        setStackFlipped(false);
        setStackExiting(false);
        setStackVariant(nextVariant);
      }, 260);
      return;
    }
    if (exiting) return;
    setExiting(true);
    setTimeout(() => {
      if (isLast) {
        setDone(true);
      } else {
        setFlipped(false);
        setIdx((i) => i + 1);
      }
      setExiting(false);
    }, 260);
  }

  function handleRestart() {
    setExiting(true);
    setTimeout(() => {
      const shuffled = fisherYates(CARDS);
      setCards(shuffled);
      setVariants(randomVariants(shuffled, loadLastVariant()));
      setIdx(0);
      setFlipped(false);
      setDone(false);
      setExiting(false);
    }, 260);
  }

  // Active state aliases (resolved from whichever mode is current)
  const activeFlipped  = stackMode ? stackFlipped  : flipped;
  const activeExiting  = stackMode ? stackExiting  : exiting;
  const activeKey      = stackMode ? stackIdx      : idx;
  const activeVariant  = stackMode ? stackVariant  : variant;

  // Rotating symbol button — shared across all card states
  const ToggleSymbol = (
    <button
      className="absolute -top-3.5 -right-3.5 z-30 w-7 h-7 flex items-center justify-center rounded-full border border-white/20 transition-colors shadow-md hover-stripe"
      style={{
        background: stackMode ? "rgba(228,234,248,0.22)" : "rgba(66,97,160,0.88)",
        color: stackMode ? "rgba(228,234,248,0.95)" : "rgba(138,155,196,0.85)",
        pointerEvents: "auto",
      }}
      onClick={toggleStackMode}
      title={stackMode ? "Exit stack mode" : "Enter infinite stack"}
    >
      <StarIcon />
    </button>
  );

  if (done && !stackMode) {
    return (
      <div className="flex flex-col items-center gap-4">
        {/* Pip row spacer — same height as pip row so card stays at same Y */}
        <div style={{ height: 6 }} />

        {/* Card */}
        <div className="relative" style={{ width: 300, height: 200 }}>
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl shadow-lg text-center animate-done-entrance overflow-hidden"
            style={{
              background: "linear-gradient(145deg, #253d72 0%, #192b56 60%, #111f40 100%)",
              border: "1px solid rgba(100,130,210,0.25)",
            }}
          >
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 14px, rgba(255,255,255,0.07) 14px, rgba(255,255,255,0.07) 16px)" }} />
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(145deg, rgba(150,180,255,0.08) 0%, transparent 50%)" }} />
            <div style={{ position: "absolute", inset: 6, borderRadius: 14, border: "1px solid rgba(100,130,210,0.18)", pointerEvents: "none" }} />
            <div className="relative">
              <p className="text-base font-semibold text-mist mb-1">All done!</p>
              <p className="text-[11px] text-slate/70">You reviewed all {cards.length} cards.</p>
            </div>
          </div>
          {ToggleSymbol}
        </div>

        {/* Button in the same slot as Continue → */}
        <button
          onClick={handleRestart}
          className="text-[11px] font-semibold px-5 py-1.5 rounded-full hover-stripe animate-button-pop"
          style={{
            background: "rgba(228,234,248,0.12)",
            color: "rgba(228,234,248,0.9)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(228,234,248,0.2)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(228,234,248,0.12)")}
        >
          Shuffle &amp; restart
        </button>

        {/* Tap-to-advance toggle spacer — same height so layout doesn't shift */}
        <div style={{ height: 13 }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Progress pip row — 3-pip sliding window in stack mode, full row otherwise */}
      <div className="flex items-center gap-1.5">
        {stackMode ? (
          <div key={stackIdx} className="flex items-center gap-1.5 pip-slide">
          {[-1, 0, 1].map((offset) => {
            const isCurrent = offset === 0;
            const isPast    = offset === -1;
            // At the very start of the stack there's nothing behind yet
            const isGhost   = isPast && stackIdx === 0;
            return (
              <div
                key={offset}
                className="rounded-full transition-all duration-300"
                style={{
                  width: isCurrent ? 16 : 6,
                  height: 6,
                  background: isCurrent
                    ? "rgba(228,234,248,0.9)"
                    : isPast
                    ? `rgba(228,234,248,${isGhost ? 0.08 : 0.5})`
                    : "rgba(228,234,248,0.15)",
                }}
              />
            );
          })}
          </div>
        ) : (
          cards.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === idx ? 16 : 6,
                height: 6,
                background:
                  i < idx
                    ? "rgba(228,234,248,0.5)"
                    : i === idx
                    ? "rgba(228,234,248,0.9)"
                    : "rgba(228,234,248,0.15)",
              }}
            />
          ))
        )}
      </div>

      {/* Card */}
      <div className="relative" style={{ width: 300, height: 200 }}>
        {/* Decorative back cards — gently float */}
        <div className="absolute inset-0 rounded-2xl shadow-sm card-float-2" style={{ background: "linear-gradient(145deg, #253d72 0%, #192b56 60%, #111f40 100%)", border: "1px solid rgba(100,130,210,0.2)", backgroundImage: "linear-gradient(145deg, #253d72 0%, #192b56 60%, #111f40 100%), repeating-linear-gradient(135deg, transparent, transparent 14px, rgba(255,255,255,0.07) 14px, rgba(255,255,255,0.07) 16px)", backgroundBlendMode: "normal" }} />
        <div className="absolute inset-0 rounded-2xl shadow-sm card-float-1" style={{ background: "linear-gradient(145deg, #253d72 0%, #192b56 60%, #111f40 100%)", border: "1px solid rgba(100,130,210,0.2)" }} />

        {/* Slide-in/out wrapper — key resets entrance animation on each new card */}
        <div
          key={activeKey}
          className={`absolute inset-0 ${activeExiting ? "animate-card-exit" : "animate-card-enter"}`}
        >
          {/* Perspective + flip container */}
          <div
            className="absolute inset-0 cursor-pointer select-none"
            style={{ perspective: "1200px" }}
            onClick={handleFlip}
          >
            <div
              className={`relative w-full h-full ${
                activeVariant.animClass
                  ? activeFlipped ? activeVariant.animClass : ""
                  : "transition-transform duration-500"
              }`}
              style={{
                transformStyle: "preserve-3d",
                transform: activeVariant.animClass
                  ? undefined
                  : activeFlipped ? activeVariant.container : "none",
                pointerEvents: "none",
              }}
            >
              {/* Front */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl shadow-lg px-8 text-center overflow-hidden"
                style={{
                  backfaceVisibility: "hidden",
                  background: "linear-gradient(145deg, #253d72 0%, #192b56 60%, #111f40 100%)",
                  border: "1px solid rgba(100,130,210,0.25)",
                }}
              >
                {/* Stripe overlay */}
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 14px, rgba(255,255,255,0.07) 14px, rgba(255,255,255,0.07) 16px)" }} />
                {/* Top sheen */}
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(145deg, rgba(150,180,255,0.08) 0%, transparent 50%)" }} />
                {/* Inner border */}
                <div style={{ position: "absolute", inset: 6, borderRadius: 14, border: "1px solid rgba(100,130,210,0.18)", pointerEvents: "none" }} />
                {/* Content */}
                <div className="relative flex flex-col items-center">
                  {stackMode ? (
                    <span className="text-[9px] text-slate/20 select-none tracking-widest">· · ·</span>
                  ) : (
                    <>
                      <span className="text-[9px] font-semibold uppercase tracking-[0.25em] text-slate mb-5">
                        Question
                      </span>
                      <p className="text-sm font-medium text-mist/80 leading-relaxed">
                        {card.question}
                      </p>
                      <span className="mt-6 text-[9px] text-slate/60 animate-hint-pulse">
                        tap to reveal ↩
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Back */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl shadow-lg px-8 text-center overflow-hidden"
                style={{
                  backfaceVisibility: "hidden",
                  transform: activeVariant.back,
                  background: "linear-gradient(145deg, #1e3266 0%, #152548 60%, #0d1a35 100%)",
                  border: "1px solid rgba(100,130,210,0.2)",
                }}
              >
                {/* Stripe overlay */}
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 14px, rgba(255,255,255,0.07) 14px, rgba(255,255,255,0.07) 16px)" }} />
                {/* Top sheen */}
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(145deg, rgba(100,140,255,0.06) 0%, transparent 50%)" }} />
                {/* Inner border */}
                <div style={{ position: "absolute", inset: 6, borderRadius: 14, border: "1px solid rgba(100,130,210,0.15)", pointerEvents: "none" }} />
                {/* Content */}
                {!stackMode && (
                  <div className="relative flex flex-col items-center">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.25em] text-slate mb-5">
                      Answer
                    </span>
                    <p className="text-2xl font-semibold text-mist">{card.answer}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Rotating toggle symbol — top-right corner, slightly offset outside the card */}
        {ToggleSymbol}
      </div>

      {/* Continue button — springs in when answer is revealed; hidden in tap-to-advance mode */}
      <button
        key={`btn-${activeKey}-${activeFlipped}`}
        onClick={advance}
        className={`text-[11px] font-semibold px-5 py-1.5 rounded-full hover-stripe ${
          activeFlipped && !tapToAdvance ? "animate-button-pop" : ""
        }`}
        style={{
          opacity: activeFlipped && !tapToAdvance ? 1 : 0,
          pointerEvents: activeFlipped && !tapToAdvance ? "auto" : "none",
          background: "rgba(228,234,248,0.12)",
          color: "rgba(228,234,248,0.9)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(228,234,248,0.2)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(228,234,248,0.12)")}
      >
        {stackMode ? "Next →" : isLast ? "Finish" : "Continue →"}
      </button>

      {/* Tap-to-advance toggle */}
      <button
        onClick={() => setTapToAdvance((v) => !v)}
        className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-widest transition-colors"
        style={{ color: tapToAdvance ? "rgba(228,234,248,0.7)" : "rgba(228,234,248,0.25)" }}
      >
        {/* pill toggle */}
        <span
          className="relative inline-flex shrink-0 rounded-full transition-colors duration-200"
          style={{
            width: 24,
            height: 13,
            background: tapToAdvance ? "rgba(228,234,248,0.3)" : "rgba(228,234,248,0.1)",
          }}
        >
          <span
            className="absolute top-[2px] rounded-full transition-transform duration-200"
            style={{
              width: 9,
              height: 9,
              background: tapToAdvance ? "rgba(228,234,248,0.9)" : "rgba(228,234,248,0.35)",
              transform: tapToAdvance ? "translateX(13px)" : "translateX(2px)",
            }}
          />
        </span>
        tap card to continue
      </button>
    </div>
  );
}

// ── Auth helpers ────────────────────────────────────────────────────────────

async function apiSignUp(username: string, email: string, password: string) {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email: email || undefined, password }),
  });
  return res.json() as Promise<{ username?: string; error?: string }>;
}

async function apiSignIn(identifier: string, password: string) {
  const res = await fetch("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  return res.json() as Promise<{ username?: string; error?: string }>;
}

async function apiSignOut() {
  await fetch("/api/auth/signout", { method: "POST" });
}

// ── Auth Modal ──────────────────────────────────────────────────────────────

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

type AuthView = "signin" | "signup";

function AuthModal({
  onClose,
  initialView = "signin",
  onSuccess,
}: {
  onClose: () => void;
  initialView?: AuthView;
  onSuccess: (username: string) => void;
}) {
  const [view, setView] = useState<AuthView>(initialView);

  // Sign-up fields
  const [username, setUsername]   = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  // Sign-in fields
  const [siIdentifier, setSiIdentifier] = useState("");
  const [siPassword, setSiPassword]     = useState("");
  const [siShowPw, setSiShowPw]         = useState(false);

  // Shared loading / error state
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on backdrop click
  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const emailError = emailTouched && email.length > 0 && !isValidEmail(email);

  const inputCls =
    "w-full rounded-xl px-3.5 py-2.5 text-sm bg-navy/40 border border-white/10 text-mist placeholder:text-slate/50 outline-none focus:border-slate/50 transition-colors";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(20,30,60,0.72)", backdropFilter: "blur(6px)" }}
      onClick={handleOverlayClick}
    >
      <div
        className="auth-modal relative w-full max-w-sm rounded-3xl border border-white/10 bg-surface card-inset stripe-bg shadow-2xl px-8 py-8 flex flex-col gap-6"
        style={{ boxShadow: "0 0 60px 10px rgba(49,74,130,0.35)" }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full border border-white/10 text-slate/60 hover:text-mist transition-colors"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* Tab row */}
        <div className="flex items-center gap-0 rounded-full border border-white/10 p-1" style={{ background: "rgba(255,255,255,0.04)" }}>
          {(["signin", "signup"] as AuthView[]).map((v) => (
            <button
              key={v}
              onClick={() => { setView(v); setError(null); }}
              className="flex-1 text-xs font-semibold py-1.5 rounded-full transition-colors"
              style={{
                background: view === v ? "rgba(228,234,248,0.15)" : "transparent",
                color: view === v ? "rgba(228,234,248,0.95)" : "rgba(138,155,196,0.6)",
              }}
            >
              {v === "signin" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        {view === "signup" ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setLoading(true);
              const result = await apiSignUp(username, email, password);
              setLoading(false);
              if (result.error) { setError(result.error); return; }
              onSuccess(result.username!);
              onClose();
            }}
          >
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate">
                Username
              </label>
              <input
                type="text"
                autoComplete="username"
                placeholder="yourname"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Email — optional */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-slate">
                  Email
                </label>
                <span className="text-[9px] font-semibold uppercase tracking-widest text-slate/40 border border-white/10 px-1.5 py-0.5 rounded-full">
                  Optional
                </span>
              </div>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailTouched(true); }}
                onBlur={() => setEmailTouched(true)}
                className={`${inputCls} ${emailError ? "border-tomato/60" : ""}`}
              />
              {emailError && (
                <p className="text-[10px] text-tomato/80 pl-1">Enter a valid email address.</p>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputCls} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate/50 hover:text-slate transition-colors"
                  tabIndex={-1}
                  title={showPw ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showPw} />
                </button>
              </div>
            </div>

            {error && (
              <p className="text-[10px] text-tomato/80 pl-1 -mt-1">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-full py-2.5 text-sm font-semibold text-mist hover-stripe transition-colors disabled:opacity-50"
              style={{ background: "rgba(66,97,160,0.88)" }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.background = "rgba(78,109,182,0.95)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(66,97,160,0.88)")}
            >
              {loading ? "Creating…" : "Create account"}
            </button>

            <p className="text-center text-[10px] text-slate/50">
              Already have an account?{" "}
              <button type="button" onClick={() => { setView("signin"); setError(null); }} className="text-slate hover:text-mist transition-colors underline underline-offset-2">
                Sign in
              </button>
            </p>
          </form>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setLoading(true);
              const result = await apiSignIn(siIdentifier, siPassword);
              setLoading(false);
              if (result.error) { setError(result.error); return; }
              onSuccess(result.username!);
              onClose();
            }}
          >
            {/* Username or email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate">
                Username or email
              </label>
              <input
                type="text"
                autoComplete="username"
                placeholder="yourname or you@example.com"
                value={siIdentifier}
                onChange={(e) => setSiIdentifier(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate">
                Password
              </label>
              <div className="relative">
                <input
                  type={siShowPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={siPassword}
                  onChange={(e) => setSiPassword(e.target.value)}
                  className={`${inputCls} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setSiShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate/50 hover:text-slate transition-colors"
                  tabIndex={-1}
                  title={siShowPw ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={siShowPw} />
                </button>
              </div>
            </div>

            {error && (
              <p className="text-[10px] text-tomato/80 pl-1 -mt-1">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-full py-2.5 text-sm font-semibold text-mist hover-stripe transition-colors disabled:opacity-50"
              style={{ background: "rgba(66,97,160,0.88)" }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.background = "rgba(78,109,182,0.95)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(66,97,160,0.88)")}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>

            <p className="text-center text-[10px] text-slate/50">
              No account?{" "}
              <button type="button" onClick={() => { setView("signup"); setError(null); }} className="text-slate hover:text-mist transition-colors underline underline-offset-2">
                Sign up
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Features ─────────────────────────────────────────────────────────────────

const features = [
  {
    num: "01",
    title: "Create any deck",
    desc: "Build card sets from notes, textbooks, or any topic. Import or type — it takes seconds.",
  },
  {
    num: "02",
    title: "Study your library",
    desc: "Flip through decks anywhere. Organized, searchable, always in sync.",
  },
  {
    num: "03",
    title: "Track your progress",
    desc: "Know what you've mastered and focus where it counts. Smart review keeps you sharp.",
  },
];

const SOUND_KEY = "notara_sound";

export default function HomeClient() {
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>("signin");
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [animPkg, setAnimPkgState] = useState<PkgId>("classic");
  const [customIndices, setCustomIndicesState] = useState<number[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cardTilt, setCardTiltState] = useState<CardTiltId>("angled");
  const [cardTurn, setCardTurnState] = useState<CardTurnId>("none");
  const [playingCardVisible, setPlayingCardVisibleState] = useState(false);
  const [shadingEnabled, setShadingEnabledState] = useState(true);
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
    setPlayingCardVisibleState((v) => {
      const next = !v;
      try { localStorage.setItem(PLAYING_CARD_KEY, next ? "on" : "off"); } catch {}
      window.dispatchEvent(new CustomEvent("notara-playing-card", { detail: next }));
      return next;
    });
  }

  function toggleShading() {
    setShadingEnabledState((v) => {
      const next = !v;
      try { localStorage.setItem(SHADING_KEY, next ? "on" : "off"); } catch {}
      return next;
    });
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

  function navigateAfterSignIn(path: string) {
    setAuthOpen(false);
    setSigningIn(true);
    setTimeout(() => router.push(path), 1500);
  }

  // Restore session from HttpOnly cookie via /api/auth/me.
  // Skip the check if sessionStorage was already cleared (e.g. after sign-out).
  useEffect(() => {
    const cached = sessionStorage.getItem("notara_user");
    if (!cached) return; // definitely signed out — no need to hit the server
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user.username);
          navigateTo("/dashboard");
        } else {
          sessionStorage.removeItem("notara_user");
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (signingIn) return <Loading />;

  function openSignIn() { setAuthView("signin"); setAuthOpen(true); }
  function openSignUp() { setAuthView("signup"); setAuthOpen(true); }

  async function handleSignOut() {
    await apiSignOut();
    setCurrentUser(null);
  }

  return (
    <div className={`min-h-screen flex flex-col font-sans ${leaving ? "animate-page-exit" : "animate-page-enter"}`}>
      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          initialView={authView}
          onSuccess={(username) => {
            sessionStorage.setItem("notara_user", username);
            setCurrentUser(username);
            navigateAfterSignIn("/dashboard");
          }}
        />
      )}

      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-navy/[0.07]">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold tracking-tight text-navy">Notara</span>
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
          <button
            onClick={() => navigateTo("/dashboard")}
            className="text-sm text-navy/50 hover:text-navy transition-colors"
          >
            My Decks
          </button>

          {currentUser ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-navy/70 font-medium">{currentUser}</span>

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
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleSignOut}
                className="text-sm border border-navy/20 text-navy/60 px-4 py-2 rounded-full font-medium hover:bg-navy/[0.06] transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={openSignIn}
              className="text-sm bg-navy text-mist border border-navy/20 px-4 py-2 rounded-full font-medium hover:bg-surface transition-colors hover-stripe"
            >
              Sign in
            </button>
          )}
        </nav>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-10 py-20">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: copy */}
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-tomato bg-tomato/10 px-3 py-1.5 rounded-full mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-tomato inline-block" />
              Free while in beta
            </div>

            <h1 className="text-5xl sm:text-[3.5rem] font-bold tracking-tight text-navy leading-[1.05] mb-6">
              Learn anything.
              <br />
              <span className="text-navy/20">One card at a time.</span>
            </h1>

            <p className="text-base text-navy/50 max-w-sm mb-10 leading-relaxed">
              Build flashcard decks from notes, textbooks, or ideas. Review them
              anywhere. Actually remember things.
            </p>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={openSignUp}
                className="bg-navy text-mist px-6 py-3 rounded-full font-medium text-sm hover:bg-surface transition-colors hover-stripe btn-hover-glow"
              >
                Get started free
              </button>
              <button
                onClick={() => navigateTo("/browse")}
                className="border border-navy/15 text-navy/50 px-6 py-3 rounded-full font-medium text-sm hover:bg-navy/[0.04] transition-colors hover-stripe btn-hover-glow"
              >
                Browse decks →
              </button>
            </div>

            <p className="mt-5 text-xs text-navy/35">No account needed to start.</p>
          </div>

          {/* Right: interactive card stack */}
          <div className="flex flex-col items-center lg:items-end gap-4">
            <div className="bg-surface rounded-3xl p-8 border border-white/[0.08] card-inset stripe-bg card-hover-glow">
              <CardStack soundEnabled={soundEnabled} />
            </div>
          </div>
        </div>
      </main>

      {/* Features */}
      <section className="px-10 py-16 relative">
        <div className="absolute top-0 inset-x-0 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(49,74,130,0.12) 20%, rgba(49,74,130,0.12) 80%, transparent)" }} />
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-navy/40 mb-10">
            Everything you need
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.num}
                className="flex flex-col gap-3 p-6 rounded-2xl border border-white/[0.08] bg-surface/60 card-inset stripe-bg card-hover-glow"
              >
                <span className="font-mono text-xs text-tomato/70">{f.num}</span>
                <h3 className="font-semibold text-mist text-sm">{f.title}</h3>
                <p className="text-sm text-white/70 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 text-center px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(180deg, transparent 0%, rgba(49,74,130,0.06) 100%)" }} />
        <div className="absolute top-0 inset-x-0 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(49,74,130,0.12) 20%, rgba(49,74,130,0.12) 80%, transparent)" }} />
        <div className="relative">
          <p className="text-[10px] uppercase tracking-[0.2em] text-navy/40 mb-4">
            Ready to learn?
          </p>
          <h2 className="text-3xl font-bold text-navy mb-8 tracking-tight">
            Start your first deck today.
          </h2>
          <button
            onClick={openSignUp}
            className="bg-navy text-mist px-8 py-3.5 rounded-full font-semibold text-sm hover:bg-surface transition-colors hover-stripe btn-hover-glow"
          >
            Get started — it&apos;s free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-5 text-center text-xs text-navy/30 border-t border-navy/[0.07]">
        © 2026 Notara
      </footer>
    </div>
  );
}
