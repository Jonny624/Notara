"use client";

import { useEffect, useRef, useState } from "react";

const SUITS = ["♠", "♣", "♥", "♦"] as const;
const VALUES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
const RED_SUITS  = new Set(["♥", "♦"]);
const FACE_VALUES = new Set(["J", "Q", "K"]);

// ── Settings keys / types (mirrored in _home.tsx + dashboard/page.tsx) ───────

type CardTiltId = "flat" | "slight" | "angled" | "dramatic";
type CardTurnId = "left" | "none" | "right";

const CARD_TILT_KEY     = "notara_card_tilt";
const CARD_TURN_KEY     = "notara_card_turn";
const PLAYING_CARD_KEY  = "notara_playing_card";

const TILT_DEGS: Record<CardTiltId, number> = { flat: 0, slight: -8, angled: -15, dramatic: -22 };
const TURN_DEGS: Record<CardTurnId, number> = { left: -20, none: 0, right: 20 };

// ── Pip layout ────────────────────────────────────────────────────────────────
// Card is 70×98 px. Corner index areas: top 0–22, bottom 76–98.
// Pip layouts use normalised y coords [0–1] within the *available* pip area,
// which shrinks as pip size grows — keeping every pip inside the card face.
// [x (px, absolute), normY (0–1), flip]

type NormPip = [number, number, boolean];
const L = 18, Cx = 35, R = 52;

// pip size by count — fewer pips → bigger symbols
const PIP_SIZE: Record<string, number> = {
  A: 26, "2": 22, "3": 18, "4": 15, "5": 13,
  "6": 11, "7": 10, "8": 9, "9": 8.5, "10": 8,
};

// Normalised y positions within the available pip area [0 = top, 1 = bottom]
const NORM_PIPS: Record<string, NormPip[]> = {
  A:    [[Cx, 0.5,  false]],
  "2":  [[Cx, 0.1,  false], [Cx, 0.9,  true]],
  "3":  [[Cx, 0.1,  false], [Cx, 0.5,  false], [Cx, 0.9,  true]],
  "4":  [[L,  0.1,  false], [R,  0.1,  false], [L,  0.9,  true],  [R,  0.9,  true]],
  "5":  [[L,  0.1,  false], [R,  0.1,  false], [Cx, 0.5,  false], [L,  0.9,  true],  [R,  0.9,  true]],
  "6":  [[L,  0.1,  false], [R,  0.1,  false], [L,  0.5,  false], [R,  0.5,  false], [L,  0.9,  true],  [R,  0.9,  true]],
  "7":  [[L,  0.1,  false], [R,  0.1,  false], [Cx, 0.33, false], [L,  0.5,  false], [R,  0.5,  false], [L,  0.9,  true],  [R,  0.9,  true]],
  "8":  [[L,  0.1,  false], [R,  0.1,  false], [Cx, 0.33, false], [L,  0.5,  false], [R,  0.5,  false], [Cx, 0.67, true],  [L,  0.9,  true],  [R,  0.9,  true]],
  "9":  [[L,  0.1,  false], [R,  0.1,  false], [L,  0.3,  false], [R,  0.3,  false], [Cx, 0.5,  false], [L,  0.7,  true],  [R,  0.7,  true],  [L,  0.9,  true],  [R,  0.9,  true]],
  "10": [[L,  0.08, false], [R,  0.08, false], [Cx, 0.25, false], [L,  0.38, false], [R,  0.38, false],
         [L,  0.62, true],  [R,  0.62, true],  [Cx, 0.75, true],  [L,  0.92, true],  [R,  0.92, true]],
};

// Pip area: y = CORNER_H to (CARD_H - CORNER_H); shrinks by half pip-size on each end
const CARD_H   = 98;
const CORNER_H = 22;

function CardFace({ value, suit, ink }: { value: string; suit: string; ink: string }) {
  if (FACE_VALUES.has(value)) {
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "Georgia, serif", fontSize: 32, fontWeight: 700, color: ink, lineHeight: 1 }}>
          {value}
        </span>
      </div>
    );
  }

  const size  = PIP_SIZE[value] ?? 8;
  const aTop  = CORNER_H + size / 2;          // topmost pip centre
  const aBot  = CARD_H - CORNER_H - size / 2; // bottommost pip centre
  const aH    = aBot - aTop;
  const norms = NORM_PIPS[value] ?? [];

  return (
    <>
      {norms.map(([x, ny, flip], i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: x,
            top: aTop + ny * aH,
            transform: `translate(-50%, -50%)${flip ? " rotate(180deg)" : ""}`,
            fontSize: size,
            lineHeight: 1,
            color: ink,
            userSelect: "none",
          }}
        >
          {suit}
        </span>
      ))}
    </>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PlayingCard() {
  const [suitIdx,    setSuitIdx]    = useState(0);
  const [valIdx,     setValIdx]     = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tiltId,     setTiltId]     = useState<CardTiltId>("angled");
  const [turnId,     setTurnId]     = useState<CardTurnId>("none");
  const [visible,    setVisible]    = useState(true);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Load persisted settings
  useEffect(() => {
    try {
      const t = localStorage.getItem(CARD_TILT_KEY) as CardTiltId | null;
      if (t && t in TILT_DEGS) setTiltId(t);
      const r = localStorage.getItem(CARD_TURN_KEY) as CardTurnId | null;
      if (r && r in TURN_DEGS) setTurnId(r);
      setVisible(localStorage.getItem(PLAYING_CARD_KEY) !== "off");
    } catch {}
  }, []);

  // Live-sync with settings panel via custom events
  useEffect(() => {
    const onTilt    = (e: Event) => setTiltId((e as CustomEvent<CardTiltId>).detail);
    const onTurn    = (e: Event) => setTurnId((e as CustomEvent<CardTurnId>).detail);
    const onVisible = (e: Event) => setVisible((e as CustomEvent<boolean>).detail);
    window.addEventListener("notara-card-tilt",    onTilt);
    window.addEventListener("notara-card-turn",    onTurn);
    window.addEventListener("notara-playing-card", onVisible);
    return () => {
      window.removeEventListener("notara-card-tilt",    onTilt);
      window.removeEventListener("notara-card-turn",    onTurn);
      window.removeEventListener("notara-playing-card", onVisible);
    };
  }, []);

  // Close picker on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node))
        setPickerOpen(false);
    }
    if (pickerOpen) document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [pickerOpen]);

  if (!visible) return null;

  const suit = SUITS[suitIdx];
  const value = VALUES[valIdx];
  const isRed = RED_SUITS.has(suit);
  const ink   = isRed ? "#b91c1c" : "#111827";

  const tiltDeg = TILT_DEGS[tiltId];
  const turnDeg = TURN_DEGS[turnId];
  // Shadow shifts to match the apparent light source (top-left).
  const shX = Math.round(-tiltDeg * 0.3 + turnDeg * 0.25);
  const shY = 16 + Math.abs(tiltDeg) * 0.2;

  return (
    <div ref={pickerRef} className="fixed bottom-6 right-6 z-50 flex items-end gap-2">

      {/* ── Picker popover ── */}
      {pickerOpen && (
        <div
          className="absolute bottom-full right-0 mb-2 rounded-xl border border-white/10 shadow-xl p-3"
          style={{ background: "rgba(18,22,40,0.97)", backdropFilter: "blur(12px)", width: 168 }}
        >
          <p className="text-[9px] font-semibold uppercase tracking-widest text-slate/50 mb-1.5">Suit</p>
          <div className="flex gap-1 mb-3">
            {SUITS.map((s, i) => (
              <button key={s} onClick={() => setSuitIdx(i)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors"
                style={{
                  background: suitIdx === i ? "rgba(66,97,160,0.6)" : "rgba(228,234,248,0.06)",
                  color: RED_SUITS.has(s) ? "#e05555" : "rgba(228,234,248,0.85)",
                }}
              >{s}</button>
            ))}
          </div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-slate/50 mb-1.5">Value</p>
          <div className="flex flex-wrap gap-1">
            {VALUES.map((v, i) => (
              <button key={v} onClick={() => setValIdx(i)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-semibold transition-colors"
                style={{
                  background: valIdx === i ? "rgba(66,97,160,0.6)" : "rgba(228,234,248,0.06)",
                  color: "rgba(228,234,248,0.85)",
                }}
              >{v}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── Edit button ── */}
      <button
        onClick={() => setPickerOpen(o => !o)}
        className="w-6 h-6 flex items-center justify-center rounded-full border border-white/20 transition-colors mb-1"
        style={{
          background: pickerOpen ? "rgba(100,130,210,0.7)" : "rgba(66,97,160,0.45)",
          color: "rgba(228,234,248,0.7)",
        }}
        title="Change card"
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
          <path d="M8.5 1.5a1.5 1.5 0 0 1 2 2L9 5 7 3l1.5-1.5zM6.5 3.5L2 8v2h2l4.5-4.5-2-2z" />
        </svg>
      </button>

      {/* ── Card (3-D aerial perspective) ── */}
      <div style={{ perspective: "600px", perspectiveOrigin: "50% 60%" }}>
        <div
          style={{
            position: "relative",
            width: 70,
            height: 98,
            // rotateX = aerial tilt (fixed), rotateY = horizontal turn, rotateZ = in-plane angle
            transform: `rotateX(12deg) rotateY(${turnDeg}deg) rotateZ(${tiltDeg}deg)`,
            transition: "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
            borderRadius: 10,
            background: "linear-gradient(155deg, #ffffff 0%, #fdf7f0 100%)",
            border: "1px solid rgba(0,0,0,0.13)",
            boxShadow: `
              ${shX}px ${shY}px 36px rgba(0,0,0,0.52),
              ${Math.round(shX * 0.35)}px ${Math.round(shY * 0.35)}px 10px rgba(0,0,0,0.28),
              0 1px 0 rgba(255,255,255,0.9) inset,
              0 -1px 0 rgba(0,0,0,0.05) inset,
              0 0 0 1px rgba(255,255,255,0.45) inset
            `,
            overflow: "hidden",
            userSelect: "none",
          }}
        >
          {/* Sheen */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "linear-gradient(135deg, transparent 48%, rgba(0,0,0,0.13) 100%)",
          }} />

          {/* Top-left index */}
          <div style={{ position: "absolute", top: 6, left: 7, color: ink, lineHeight: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "Georgia, serif", lineHeight: 1 }}>{value}</span>
            <span style={{ fontSize: 11, lineHeight: 1, marginTop: 1 }}>{suit}</span>
          </div>

          {/* Pips / face letter */}
          <CardFace value={value} suit={suit} ink={ink} />

          {/* Bottom-right index (rotated) */}
          <div style={{ position: "absolute", bottom: 6, right: 7, color: ink, lineHeight: 1, display: "flex", flexDirection: "column", alignItems: "center", transform: "rotate(180deg)" }}>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "Georgia, serif", lineHeight: 1 }}>{value}</span>
            <span style={{ fontSize: 11, lineHeight: 1, marginTop: 1 }}>{suit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
