"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

// ── Flip variants ─────────────────────────────────────────────────────────────

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
  { back: "rotateY(180deg)", animClass: "flip-zoom"      },                     // 8  Zoom
  { back: "rotateY(180deg)", animClass: "flip-swing"     },                     // 9  Swing
  { back: "rotateY(180deg)", animClass: "flip-snap"      },                     // 10 Snap
  { back: "rotateY(180deg)", animClass: "flip-rise"      },                     // 11 Rise
  // Card Tricks
  { back: "rotateY(180deg)", animClass: "card-riffle"    },                     // 12 Riffle
  { back: "rotateY(180deg)", animClass: "card-aerial"    },                     // 13 Aerial
  { back: "rotateY(180deg)", animClass: "card-palm"      },                     // 14 Palm
  { back: "rotateY(180deg)", animClass: "card-deal"      },                     // 15 Deal
  { back: "rotateY(180deg)", animClass: "card-flourish"  },                     // 16 Flourish
  { back: "rotateY(180deg)", animClass: "card-wrist"     },                     // 17 Wrist Flip
  { back: "rotateY(180deg)", animClass: "card-spring"    },                     // 18 Spring
  { back: "rotateY(180deg)", animClass: "card-triple"    },                     // 19 Triple
  { back: "rotateY(180deg)", animClass: "card-cut"       },                     // 20 Cut
  { back: "rotateY(180deg)", animClass: "card-cascade"   },                     // 21 Cascade
  // Magic
  { back: "rotateY(180deg)", animClass: "magic-crumple"   },                    // 22 Crumple
  { back: "rotateY(180deg)", animClass: "magic-banish"    },                    // 23 Banish
  { back: "rotateY(180deg)", animClass: "magic-conjure"   },                    // 24 Conjure
  { back: "rotateY(180deg)", animClass: "magic-transmute" },                    // 25 Transmute
  { back: "rotateY(180deg)", animClass: "magic-enchant"   },                    // 26 Enchant
  { back: "rotateY(180deg)", animClass: "magic-portal"    },                    // 27 Portal
  { back: "rotateY(180deg)", animClass: "magic-smoke"     },                    // 28 Smoke
  { back: "rotateY(180deg)", animClass: "magic-spellbound"},                    // 29 Spellbound
];

const LAST_ANIM_KEY   = "notara_last_anim";
const ANIM_PKG_KEY    = "notara_anim_pkg";
const ANIM_CUSTOM_KEY = "notara_anim_custom";
const STACK_DEPTH_KEY = "notara_stack_depth";
const LIB_SPLIT_KEY   = "notara_lib_split";

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

// ── Suits ─────────────────────────────────────────────────────────────────────

const SUIT_ENABLED_KEY  = "notara_suits_enabled";
const SHADING_KEY       = "notara_card_shading";
const SUITS = ["♠", "♥", "♦", "♣"] as const;
type Suit = typeof SUITS[number];
const SUIT_COLORS: Record<Suit, string> = {
  "♠": "rgba(228,234,248,0.75)",
  "♣": "rgba(228,234,248,0.75)",
  "♥": "rgba(220,140,100,0.85)",
  "♦": "rgba(220,140,100,0.85)",
};
function randomSuit(): Suit { return SUITS[Math.floor(Math.random() * 4)]; }

function pickVariant(exclude: FlipVariant | null = null): FlipVariant {
  const bank = getActiveBank();
  let pick: FlipVariant;
  do {
    pick = bank[Math.floor(Math.random() * bank.length)];
  } while (exclude !== null && pick === exclude && bank.length > 1);
  return pick;
}

// ── Sound effects (Web Audio API, no external files) ─────────────────────────

let _audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  try {
    if (!_audioCtx || _audioCtx.state === "closed") _audioCtx = new AudioContext();
    if (_audioCtx.state === "suspended") _audioCtx.resume();
    return _audioCtx;
  } catch { return null; }
}

function playFlipSound() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * 0.07);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 2200;
  filter.Q.value = 0.7;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.45, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
  src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
  src.start();
}

function playAdvanceSound() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * 0.12);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.8) * 0.6;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  filter.Q.value = 0.4;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.28, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
  src.start();
}

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomVariants(cards: { question: string; answer: string }[], firstExclude: FlipVariant | null = null): FlipVariant[] {
  const result: FlipVariant[] = [];
  for (let i = 0; i < cards.length; i++) {
    const exclude = i === 0 ? firstExclude : result[i - 1];
    result.push(pickVariant(exclude ?? null));
  }
  return result;
}

function StarIcon({ size = 13 }: { size?: number }) {
  return (
    <svg className="spin-slow" width={size} height={size} viewBox="0 0 12 12" fill="currentColor">
      <path d="M6 0.4 L6.8 5.2 L11.6 6 L6.8 6.8 L6 11.6 L5.2 6.8 L0.4 6 L5.2 5.2 Z" />
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Card { question: string; answer: string; }
interface SetData { name: string; cards: Card[]; }
interface DeckData {
  id: string;
  title: string;
  description: string | null;
  type: "flashcard" | "library";
  visibility: "public" | "private";
  cards: Card[];
  sets: SetData[] | null;
  ownerUsername: string | null;
  isOwner: boolean;
}

// ── Card dimensions ───────────────────────────────────────────────────────────

const CARD_W = 520;
const CARD_H = 340;

// ── StudyCardStack ────────────────────────────────────────────────────────────

// 5 distinct back-card position pairs [closer, further]
const BACK_POSITIONS: [string, string][] = [
  ["rotate(3deg) translateY(3px) translateX(2px)",   "rotate(7deg) translateY(6px) translateX(4px)"],
  ["rotate(1deg) translateY(6px) translateX(-1px)",  "rotate(4deg) translateY(10px) translateX(-2px)"],
  ["rotate(-1deg) translateY(2px) translateX(3px)",  "rotate(-2deg) translateY(4px) translateX(6px)"],
  ["rotate(2deg) translateY(-2px) translateX(0px)",  "rotate(5deg) translateY(-3px) translateX(2px)"],
  ["rotate(4deg) translateY(1px) translateX(-2px)",  "rotate(9deg) translateY(2px) translateX(-3px)"],
];

function StudyCardStack({ cards: initialCards, shuffle = true }: { cards: Card[]; shuffle?: boolean }) {
  const [cards, setCards] = useState(initialCards);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [backPosIdx, setBackPosIdx] = useState(0);

  const [variants, setVariants] = useState(() =>
    initialCards.map((_, i) => FLIP_BANK[i % FLIP_BANK.length])
  );

  const [tapToAdvance, setTapToAdvance] = useState(false);
  const [stackMode, setStackMode] = useState(false);
  const [stackIdx, setStackIdx] = useState(0);
  const [stackFlipped, setStackFlipped] = useState(false);
  const [stackExiting, setStackExiting] = useState(false);
  const [stackVariant, setStackVariant] = useState<FlipVariant>(FLIP_BANK[0]);

  // Track when a CSS-animation flip has settled so we can lock to rotateY(180deg)
  const [animSettled, setAnimSettled] = useState(false);
  const [stackSettled, setStackSettled] = useState(false);

  // Suits
  const [suitsEnabled, setSuitsEnabled] = useState(() => {
    try { return localStorage.getItem(SUIT_ENABLED_KEY) !== "off"; } catch { return true; }
  });
  const [shadingEnabled, setShadingEnabled] = useState(() => {
    try { return localStorage.getItem(SHADING_KEY) !== "off"; } catch { return true; }
  });
  const [cardSuits, setCardSuits] = useState<Suit[]>(() =>
    initialCards.map(() => randomSuit())
  );
  const [stackSuit, setStackSuit] = useState<Suit>(() => randomSuit());
  const [stackDepth, setStackDepthState] = useState<0 | 1 | 2>(() => {
    try {
      const n = parseInt(localStorage.getItem(STACK_DEPTH_KEY) ?? "2");
      return ([0, 1, 2] as const).includes(n as 0 | 1 | 2) ? (n as 0 | 1 | 2) : 2;
    } catch { return 2; }
  });

  function setStackDepth(v: 0 | 1 | 2) {
    setStackDepthState(v);
    try { localStorage.setItem(STACK_DEPTH_KEY, String(v)); } catch {}
  }

  // Re-init when cards change (e.g. set picker changes)
  useEffect(() => {
    const shuffled = shuffle ? fisherYates(initialCards) : [...initialCards];
    setCards(shuffled);
    setVariants(randomVariants(shuffled, loadLastVariant()));
    setCardSuits(shuffled.map(() => randomSuit()));
    setIdx(0);
    setFlipped(false);
    setAnimSettled(false);
    setDone(false);
    setExiting(false);
    setStackIdx(0);
    setStackFlipped(false);
    setStackExiting(false);
    setStackSettled(false);
    setStackVariant(pickVariant(loadLastVariant()));
    setStackSuit(randomSuit());
  }, [initialCards]); // eslint-disable-line react-hooks/exhaustive-deps

  const card = cards[idx];
  const variant = variants[idx];
  const isLast = idx === cards.length - 1;

  function toggleStackMode() {
    setStackMode((m) => {
      if (!m) {
        setStackIdx(0);
        setStackFlipped(false);
        setStackExiting(false);
        setStackSettled(false);
        setStackVariant(pickVariant(loadLastVariant()));
        setStackSuit(randomSuit());
      }
      return !m;
    });
  }

  function handleFlip() {
    if (stackMode) {
      if (!stackFlipped) {
        playFlipSound();
        setStackFlipped(true);
        saveLastVariant(stackVariant);
      } else if (tapToAdvance) {
        advance();
      }
      return;
    }
    if (!flipped) {
      playFlipSound();
      setFlipped(true);
      saveLastVariant(variant);
    } else if (tapToAdvance) {
      advance();
    }
  }

  function advance() {
    if (stackMode) {
      if (stackExiting) return;
      playAdvanceSound();
      setStackExiting(true);
      const nextVariant = pickVariant(stackVariant);
      const nextSuit = randomSuit();
      setTimeout(() => {
        setStackIdx((i) => i + 1);
        setStackFlipped(false);
        setStackSettled(false);
        setStackExiting(false);
        setStackVariant(nextVariant);
        setStackSuit(nextSuit);
        setBackPosIdx((i) => (i + 1) % 5);
      }, 260);
      return;
    }
    if (exiting) return;
    playAdvanceSound();
    setExiting(true);
    setTimeout(() => {
      if (isLast) {
        setDone(true);
      } else {
        setFlipped(false);
        setAnimSettled(false);
        setIdx((i) => i + 1);
        setBackPosIdx((i) => (i + 1) % 5);
      }
      setExiting(false);
    }, 260);
  }

  function handleRestart() {
    setExiting(true);
    setTimeout(() => {
      const shuffled = shuffle ? fisherYates(initialCards) : [...initialCards];
      setCards(shuffled);
      setVariants(randomVariants(shuffled, loadLastVariant()));
      setCardSuits(shuffled.map(() => randomSuit()));
      setIdx(0);
      setFlipped(false);
      setAnimSettled(false);
      setDone(false);
      setExiting(false);
    }, 260);
  }

  const activeFlipped  = stackMode ? stackFlipped  : flipped;
  const activeExiting  = stackMode ? stackExiting  : exiting;
  const activeKey      = stackMode ? stackIdx      : idx;
  const activeVariant  = stackMode ? stackVariant  : variant;
  const activeSettled  = stackMode ? stackSettled  : animSettled;
  // isSettled: animation has ended — lock to a clean rotateY(180deg) so the back face always shows
  const isSettled      = activeFlipped && activeSettled && !!activeVariant.animClass;
  const activeSuit: Suit = stackMode ? stackSuit : (cardSuits[idx] ?? "♠");

  const ToggleSymbol = (
    <button
      className="absolute -top-4 -right-4 z-30 w-8 h-8 flex items-center justify-center rounded-full border transition-colors shadow-md hover-stripe"
      style={{
        background: stackMode ? "rgba(66,97,160,0.2)" : "rgba(66,97,160,0.88)",
        color: stackMode ? "rgba(49,74,130,0.9)" : "rgba(138,155,196,0.85)",
        borderColor: stackMode ? "rgba(49,74,130,0.3)" : "rgba(255,255,255,0.2)",
        pointerEvents: "auto",
      }}
      onClick={toggleStackMode}
      title={stackMode ? "Exit stack mode" : "Enter infinite stack"}
    >
      <StarIcon size={15} />
    </button>
  );

  if (done && !stackMode) {
    return (
      <div className="flex flex-col items-center gap-5">
        <div style={{ height: 8 }} />
        <div className="relative" style={{ width: CARD_W, maxWidth: "calc(100vw - 48px)", aspectRatio: `${CARD_W} / ${CARD_H}` }}>
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl shadow-lg text-center animate-done-entrance overflow-hidden"
            style={{
              background: "linear-gradient(145deg, #253d72 0%, #192b56 60%, #111f40 100%)",
              border: "1px solid rgba(100,130,210,0.25)",
            }}
          >
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 14px, rgba(255,255,255,0.07) 14px, rgba(255,255,255,0.07) 16px)" }} />
            <div style={{ position: "absolute", inset: 20, borderRadius: 14, border: "1px solid rgba(100,130,210,0.18)", pointerEvents: "none" }} />
            <div className="relative">
              <p className="text-lg font-semibold text-mist mb-2">All done!</p>
              <p className="text-sm text-slate/70">You reviewed all {cards.length} cards.</p>
            </div>
          </div>
          {ToggleSymbol}
        </div>
        <button
          onClick={handleRestart}
          className="text-xs font-semibold px-6 py-2 rounded-full hover-stripe animate-button-pop"
          style={{ background: "rgba(49,74,130,0.1)", color: "rgba(49,74,130,0.85)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(49,74,130,0.18)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(49,74,130,0.1)")}
        >
          Shuffle &amp; restart
        </button>
        <div style={{ height: 16 }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Progress pips */}
      <div className="flex items-center gap-2 flex-wrap justify-center max-w-lg">
        {stackMode ? (
          <div key={stackIdx} className="flex items-center gap-2 pip-slide">
            {[-1, 0, 1].map((offset) => {
              const isCurrent = offset === 0;
              const isPast    = offset === -1;
              const isGhost   = isPast && stackIdx === 0;
              return (
                <div
                  key={offset}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: isCurrent ? 20 : 8,
                    height: 8,
                    background: isCurrent
                      ? "rgba(49,74,130,0.75)"
                      : isPast
                      ? `rgba(49,74,130,${isGhost ? 0.08 : 0.4})`
                      : "rgba(49,74,130,0.15)",
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
                width: i === idx ? 20 : 8,
                height: 8,
                background:
                  i < idx
                    ? "rgba(49,74,130,0.4)"
                    : i === idx
                    ? "rgba(49,74,130,0.75)"
                    : "rgba(49,74,130,0.15)",
              }}
            />
          ))
        )}
      </div>

      {/* Card */}
      <div className="relative" style={{ width: CARD_W, maxWidth: "calc(100vw - 48px)", aspectRatio: `${CARD_W} / ${CARD_H}` }}>
        {/* Decorative back cards */}
        {stackDepth >= 2 && (
          <div
            className="absolute inset-0 rounded-2xl shadow-sm"
            style={{
              background: shadingEnabled
                ? "linear-gradient(145deg, #2e4d8a 0%, #1e3566 60%, #131f48 100%)"
                : "#1e3566",
              border: "1px solid rgba(120,150,220,0.25)",
              backgroundImage: shadingEnabled
                ? [
                    "linear-gradient(145deg, #2e4d8a 0%, #1e3566 60%, #131f48 100%)",
                    "repeating-linear-gradient(135deg, transparent, transparent 14px, rgba(255,255,255,0.07) 14px, rgba(255,255,255,0.07) 16px)",
                  ].join(", ")
                : undefined,
              transform: BACK_POSITIONS[backPosIdx][1],
              transition: "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {shadingEnabled && (
              <>
                <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(160,190,255,0.10) 0%, transparent 30%)" }} />
                <div className="absolute rounded-xl pointer-events-none" style={{ inset: 14, border: "1px solid rgba(120,150,220,0.18)" }} />
              </>
            )}
          </div>
        )}
        {stackDepth >= 1 && (
          <div
            className="absolute inset-0 rounded-2xl shadow-sm overflow-hidden"
            style={{
              background: shadingEnabled
                ? "linear-gradient(145deg, #2e4d8a 0%, #1e3566 60%, #131f48 100%)"
                : "#1e3566",
              border: "1px solid rgba(120,150,220,0.25)",
              backgroundImage: shadingEnabled
                ? [
                    "linear-gradient(145deg, #2e4d8a 0%, #1e3566 60%, #131f48 100%)",
                    "repeating-linear-gradient(135deg, transparent, transparent 14px, rgba(255,255,255,0.06) 14px, rgba(255,255,255,0.06) 16px)",
                  ].join(", ")
                : undefined,
              transform: BACK_POSITIONS[backPosIdx][0],
              transition: "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {shadingEnabled && (
              <>
                <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(160,190,255,0.10) 0%, transparent 30%)" }} />
                <div className="absolute rounded-xl pointer-events-none" style={{ inset: 14, border: "1px solid rgba(120,150,220,0.18)" }} />
              </>
            )}
          </div>
        )}

        {/* Slide wrapper */}
        <div
          key={activeKey}
          className={`absolute inset-0 ${activeExiting ? "animate-card-exit" : "animate-card-enter"}`}
        >
          <div
            className="absolute inset-0 cursor-pointer select-none"
            style={{ perspective: "1600px" }}
            onClick={handleFlip}
          >
            <div
              className={`relative w-full h-full ${
                activeVariant.animClass
                  ? (activeFlipped && !isSettled ? activeVariant.animClass : "")
                  : "transition-transform duration-500"
              }`}
              style={{
                transformStyle: "preserve-3d",
                transform: activeVariant.animClass
                  ? (isSettled ? "rotateY(180deg)" : undefined)
                  : activeFlipped ? activeVariant.container : "none",
                pointerEvents: "none",
              }}
              onAnimationEnd={(e) => {
                if (e.currentTarget === e.target && activeFlipped) {
                  if (stackMode) setStackSettled(true);
                  else setAnimSettled(true);
                }
              }}
            >
              {/* Front */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl shadow-lg px-12 text-center overflow-hidden"
                style={{
                  backfaceVisibility: "hidden",
                  background: shadingEnabled
                    ? "linear-gradient(145deg, #253d72 0%, #192b56 60%, #111f40 100%)"
                    : "#192b56",
                  border: "1px solid rgba(100,130,210,0.25)",
                }}
              >
                {shadingEnabled && (
                  <>
                    {/* Stripe overlay */}
                    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 14px, rgba(255,255,255,0.07) 14px, rgba(255,255,255,0.07) 16px)" }} />
                    {/* Top sheen */}
                    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(145deg, rgba(150,180,255,0.08) 0%, transparent 50%)" }} />
                    {/* Inner border */}
                    <div style={{ position: "absolute", inset: 32, borderRadius: 14, border: "1px solid rgba(100,130,210,0.18)", pointerEvents: "none" }} />
                  </>
                )}
                {suitsEnabled && (
                  <>
                    <span className="absolute top-3 left-4 text-sm font-bold select-none pointer-events-none leading-none" style={{ color: SUIT_COLORS[activeSuit] }}>{activeSuit}</span>
                    <span className="absolute bottom-3 right-4 text-sm font-bold select-none pointer-events-none leading-none" style={{ color: SUIT_COLORS[activeSuit], transform: "rotate(180deg)" }}>{activeSuit}</span>
                  </>
                )}
                <div className="relative flex flex-col items-center">
                  {stackMode ? (
                    <span className="text-sm text-slate/20 select-none tracking-widest">· · ·</span>
                  ) : (
                    <>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate mb-6">
                        Question
                      </span>
                      <p className="text-lg font-medium text-mist/90 leading-relaxed" style={{ fontFamily: "Georgia, serif" }}>
                        {card?.question}
                      </p>
                      <span className="mt-8 text-xs text-slate/60 animate-hint-pulse">
                        tap to reveal ↩
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Back */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl shadow-lg px-12 text-center overflow-hidden"
                style={{
                  backfaceVisibility: "hidden",
                  transform: activeVariant.back,
                  background: shadingEnabled
                    ? "linear-gradient(145deg, #253c7a 0%, #1a2f5c 60%, #111f42 100%)"
                    : "#1a2f5c",
                  border: "1px solid rgba(100,130,210,0.2)",
                }}
              >
                {shadingEnabled && (
                  <>
                    {/* Stripe overlay */}
                    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 14px, rgba(255,255,255,0.07) 14px, rgba(255,255,255,0.07) 16px)" }} />
                    {/* Top sheen */}
                    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(145deg, rgba(100,140,255,0.06) 0%, transparent 50%)" }} />
                    {/* Inner border */}
                    <div style={{ position: "absolute", inset: 32, borderRadius: 14, border: "1px solid rgba(100,130,210,0.15)", pointerEvents: "none" }} />
                  </>
                )}
                {suitsEnabled && (
                  <>
                    <span className="absolute top-3 left-4 text-sm font-bold select-none pointer-events-none leading-none" style={{ color: SUIT_COLORS[activeSuit] }}>{activeSuit}</span>
                    <span className="absolute bottom-3 right-4 text-sm font-bold select-none pointer-events-none leading-none" style={{ color: SUIT_COLORS[activeSuit], transform: "rotate(180deg)" }}>{activeSuit}</span>
                  </>
                )}
                {!stackMode && card && (
                  <div className="relative flex flex-col items-center">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate mb-6">
                      Answer
                    </span>
                    <p className="text-4xl font-semibold text-mist" style={{ fontFamily: "Georgia, serif" }}>{card.answer}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {ToggleSymbol}
      </div>

      {/* Counter */}
      {!stackMode && (
        <p className="text-xs text-navy/40 -mt-1">
          {idx + 1} / {cards.length}
        </p>
      )}

      {/* Continue button */}
      <button
        key={`btn-${activeKey}-${activeFlipped}`}
        onClick={advance}
        className={`text-xs font-semibold px-6 py-2 rounded-full hover-stripe ${
          activeFlipped && !tapToAdvance ? "animate-button-pop" : ""
        }`}
        style={{
          opacity: activeFlipped && !tapToAdvance ? 1 : 0,
          pointerEvents: activeFlipped && !tapToAdvance ? "auto" : "none",
          background: "rgba(49,74,130,0.1)",
          color: "rgba(49,74,130,0.85)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(49,74,130,0.18)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(49,74,130,0.1)")}
      >
        {stackMode ? "Next →" : isLast ? "Finish" : "Continue →"}
      </button>

      {/* Tap-to-advance toggle */}
      <button
        onClick={() => setTapToAdvance((v) => !v)}
        className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest transition-colors"
        style={{ color: tapToAdvance ? "rgba(49,74,130,0.8)" : "rgba(49,74,130,0.35)" }}
      >
        <span
          className="relative inline-flex shrink-0 rounded-full transition-colors duration-200"
          style={{
            width: 28,
            height: 15,
            background: tapToAdvance ? "rgba(49,74,130,0.3)" : "rgba(49,74,130,0.1)",
          }}
        >
          <span
            className="absolute top-[3px] rounded-full transition-transform duration-200"
            style={{
              width: 9,
              height: 9,
              background: tapToAdvance ? "rgba(49,74,130,0.85)" : "rgba(49,74,130,0.3)",
              transform: tapToAdvance ? "translateX(16px)" : "translateX(3px)",
            }}
          />
        </span>
        tap card to continue
      </button>

      {/* Suit toggle */}
      <button
        onClick={() => setSuitsEnabled((v) => {
          const next = !v;
          try { localStorage.setItem(SUIT_ENABLED_KEY, next ? "on" : "off"); } catch {}
          return next;
        })}
        className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest transition-colors"
        style={{ color: suitsEnabled ? "rgba(49,74,130,0.8)" : "rgba(49,74,130,0.35)" }}
      >
        <span
          className="relative inline-flex shrink-0 rounded-full transition-colors duration-200"
          style={{
            width: 28,
            height: 15,
            background: suitsEnabled ? "rgba(49,74,130,0.3)" : "rgba(49,74,130,0.1)",
          }}
        >
          <span
            className="absolute top-[3px] rounded-full transition-transform duration-200"
            style={{
              width: 9,
              height: 9,
              background: suitsEnabled ? "rgba(49,74,130,0.85)" : "rgba(49,74,130,0.3)",
              transform: suitsEnabled ? "translateX(16px)" : "translateX(3px)",
            }}
          />
        </span>
        card suits
      </button>

      {/* Shading toggle */}
      <button
        onClick={() => setShadingEnabled((v) => {
          const next = !v;
          try { localStorage.setItem(SHADING_KEY, next ? "on" : "off"); } catch {}
          return next;
        })}
        className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest transition-colors"
        style={{ color: shadingEnabled ? "rgba(49,74,130,0.8)" : "rgba(49,74,130,0.35)" }}
      >
        <span
          className="relative inline-flex shrink-0 rounded-full transition-colors duration-200"
          style={{
            width: 28,
            height: 15,
            background: shadingEnabled ? "rgba(49,74,130,0.3)" : "rgba(49,74,130,0.1)",
          }}
        >
          <span
            className="absolute top-[3px] rounded-full transition-transform duration-200"
            style={{
              width: 9,
              height: 9,
              background: shadingEnabled ? "rgba(49,74,130,0.85)" : "rgba(49,74,130,0.3)",
              transform: shadingEnabled ? "translateX(16px)" : "translateX(3px)",
            }}
          />
        </span>
        card shading
      </button>

      {/* Stack depth */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(49,74,130,0.35)" }}>stack</span>
        {([0, 1, 2] as const).map((d) => (
          <button
            key={d}
            onClick={() => setStackDepth(d)}
            className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full border transition-colors"
            style={{
              background: stackDepth === d ? "rgba(49,74,130,0.15)" : "transparent",
              borderColor: stackDepth === d ? "rgba(49,74,130,0.35)" : "rgba(49,74,130,0.12)",
              color: stackDepth === d ? "rgba(49,74,130,0.85)" : "rgba(49,74,130,0.3)",
            }}
          >
            {d === 0 ? "flat" : d === 1 ? "1" : "2"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Access code modal ─────────────────────────────────────────────────────────

function AccessCodeModal({
  onSubmit,
  error,
}: {
  onSubmit: (code: string) => void;
  error: string | null;
}) {
  const [code, setCode] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(20,30,60,0.72)", backdropFilter: "blur(6px)" }}
    >
      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-surface card-inset stripe-bg shadow-2xl px-8 py-8 flex flex-col gap-5">
        <h2 className="text-base font-semibold text-mist">Private library</h2>
        <p className="text-xs text-slate/70">Enter the access code to study this deck.</p>
        <input
          type="text"
          placeholder="Access code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && code.length >= 4 && onSubmit(code)}
          className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-navy/40 border border-white/10 text-mist placeholder:text-slate/50 outline-none focus:border-slate/50 transition-colors"
          autoFocus
        />
        {error && <p className="text-[11px] text-tomato/80 -mt-2">{error}</p>}
        <button
          onClick={() => code.length >= 1 && onSubmit(code)}
          className="w-full rounded-full py-2.5 text-sm font-semibold text-mist hover-stripe transition-colors"
          style={{ background: "rgba(66,97,160,0.88)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(78,109,182,0.95)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(66,97,160,0.88)")}
        >
          Unlock
        </button>
      </div>
    </div>
  );
}

// ── Study page ────────────────────────────────────────────────────────────────

export default function StudyPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [deck, setDeck] = useState<DeckData | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsCode, setNeedsCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [activeSet, setActiveSet] = useState<number | "all">("all");
  const [leaving, setLeaving] = useState(false);
  const [libSplit, setLibSplitRaw] = useState<"shuffle" | "order">(() => {
    try { return localStorage.getItem(LIB_SPLIT_KEY) === "order" ? "order" : "shuffle"; } catch { return "shuffle"; }
  });

  function setLibSplit(v: "shuffle" | "order") {
    setLibSplitRaw(v);
    try { localStorage.setItem(LIB_SPLIT_KEY, v); } catch {}
  }

  async function loadDeck(code?: string) {
    setPageLoading(true);
    setCodeError(null);
    const url = code
      ? `/api/decks/${id}/view?code=${encodeURIComponent(code)}`
      : `/api/decks/${id}/view`;
    const res = await fetch(url);
    const data = await res.json();
    setPageLoading(false);
    if (res.status === 403 && data.needsCode) {
      setNeedsCode(true);
      if (code) setCodeError("Incorrect access code.");
      return;
    }
    if (data.error) {
      setError(data.error);
      return;
    }
    setNeedsCode(false);
    setDeck(data as DeckData);
  }

  useEffect(() => {
    let storedCode: string | undefined;
    try { storedCode = sessionStorage.getItem(`notara_code_${id}`) ?? undefined; } catch {}
    loadDeck(storedCode);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function navigateBack() {
    setLeaving(true);
    setTimeout(() => router.back(), 180);
  }

  function navigateTo(path: string) {
    setLeaving(true);
    setTimeout(() => router.push(path), 180);
  }

  const studyCards: Card[] = (() => {
    if (!deck) return [];
    if (deck.type === "library" && deck.sets) {
      if (activeSet === "all") {
        // "order": concatenate sets in order (StudyCardStack won't shuffle)
        // "shuffle": pass all cards and let StudyCardStack shuffle them together
        return libSplit === "order"
          ? deck.sets.flatMap((s) => s.cards)
          : deck.cards;
      }
      return deck.sets[activeSet as number]?.cards ?? [];
    }
    return deck.cards;
  })();

  return (
    <div className={`min-h-screen flex flex-col font-sans ${leaving ? "animate-page-exit" : "animate-page-enter"}`}>
      {needsCode && (
        <AccessCodeModal
          onSubmit={(code) => loadDeck(code)}
          error={codeError}
        />
      )}

      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-4">
          <button
            onClick={navigateBack}
            className="flex items-center gap-2 text-sm text-navy/50 hover:text-navy transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3L5 8l5 5" />
            </svg>
            Back
          </button>
          <button
            onClick={() => navigateTo("/")}
            className="text-base font-bold tracking-tight text-navy hover:opacity-70 transition-opacity"
          >
            Notara
          </button>
        </div>
        {deck && (
          <div className="flex items-center gap-2">
            {deck.type === "library" && (
              <span className="text-[9px] font-semibold uppercase tracking-widest text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded-full border border-indigo-400/20">
                Library
              </span>
            )}
            <span className="text-sm text-navy/40">
              {deck.cards.length} cards
            </span>
          </div>
        )}
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center px-6 py-8">
        {pageLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-slate/20 border-t-slate/60 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <p className="text-navy/40 text-sm">{error}</p>
            <button
              onClick={navigateBack}
              className="text-sm bg-navy text-mist px-5 py-2.5 rounded-full font-medium hover:bg-surface transition-colors hover-stripe"
            >
              Go back
            </button>
          </div>
        ) : deck ? (
          <>
            {/* Deck title */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-navy tracking-tight">{deck.title}</h1>
              {deck.description && (
                <p className="text-sm text-navy/40 mt-1 max-w-md">{deck.description}</p>
              )}
              {deck.ownerUsername && (
                <p className="text-xs text-navy/30 mt-1">by {deck.ownerUsername}</p>
              )}
            </div>

            {/* Set picker for libraries */}
            {deck.type === "library" && deck.sets && deck.sets.length > 1 && (
              <div className="flex flex-col items-center gap-3 mb-8">
                <div className="flex items-center gap-2 flex-wrap justify-center max-w-2xl">
                  <button
                    onClick={() => setActiveSet("all")}
                    className="text-xs font-semibold px-4 py-1.5 rounded-full border transition-colors hover-stripe"
                    style={{
                      background: activeSet === "all" ? "rgba(66,97,160,0.88)" : "rgba(49,74,130,0.07)",
                      color: activeSet === "all" ? "rgba(228,234,248,0.95)" : "rgba(49,74,130,0.7)",
                      borderColor: activeSet === "all" ? "rgba(255,255,255,0.15)" : "rgba(49,74,130,0.18)",
                    }}
                  >
                    All sets
                  </button>
                  {deck.sets.map((set, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveSet(i)}
                      className="text-xs font-semibold px-4 py-1.5 rounded-full border transition-colors hover-stripe"
                      style={{
                        background: activeSet === i ? "rgba(66,97,160,0.88)" : "rgba(49,74,130,0.07)",
                        color: activeSet === i ? "rgba(228,234,248,0.95)" : "rgba(49,74,130,0.7)",
                        borderColor: activeSet === i ? "rgba(255,255,255,0.15)" : "rgba(49,74,130,0.18)",
                      }}
                    >
                      {set.name}
                      <span className="ml-1.5 opacity-50">{set.cards.length}</span>
                    </button>
                  ))}
                </div>
                {/* Library/set split toggle — only shown when viewing all sets */}
                {activeSet === "all" && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-navy/30">Order</span>
                    {([ ["shuffle", "Shuffled"], ["order", "By set"] ] as const).map(([v, label]) => (
                      <button
                        key={v}
                        onClick={() => setLibSplit(v)}
                        className="text-[11px] font-semibold px-3 py-1 rounded-full border transition-colors"
                        style={{
                          background: libSplit === v ? "rgba(49,74,130,0.12)" : "transparent",
                          borderColor: libSplit === v ? "rgba(49,74,130,0.30)" : "rgba(49,74,130,0.12)",
                          color: libSplit === v ? "rgba(49,74,130,0.80)" : "rgba(49,74,130,0.30)",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Card stack */}
            {studyCards.length > 0 ? (
              <StudyCardStack
                key={`${id}-${activeSet}-${libSplit}`}
                cards={studyCards}
                shuffle={libSplit !== "order" || activeSet !== "all"}
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 py-24">
                <p className="text-navy/40 text-sm">No cards in this set.</p>
              </div>
            )}
          </>
        ) : null}
      </main>

      <footer className="py-5 text-center text-xs text-navy/30">© 2026 Notara</footer>
    </div>
  );
}
