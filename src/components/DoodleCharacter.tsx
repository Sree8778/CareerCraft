'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── Config ──────────────────────────────────────────────────────────────────
const W          = 52;    // rendered width  (px)
const H          = 100;   // rendered height (px)
const IDLE_SPEED = 1.8;
const FRICTION   = 0.84;
const SIDEBAR_W  = 264;   // left boundary — clear the sidebar
const BOT_MARGIN = 18;    // gap from bottom of viewport

type Mood = 'idle' | 'walking' | 'waving' | 'signing';

const QUIPS = [
  'Psst… update your LinkedIn! 📌',
  "That resume gap won't explain itself…",
  'Have you tried networking? 🤢',
  'Bold font = bold career moves.',
  'I believe in you! (mostly) 🙏',
  'Apply to 10 jobs/day, they said…',
  'Is "professional napper" a real job?',
  '*pretends to read your resume*',
  '"Entry level, 10 yrs exp"… classic.',
  'Coffee → apply → cry → repeat.',
  'Your cover letter needs more sparkle ✨',
  "Don't forget to follow up!",
];

const SIGNS = [
  'Be\nHappy! 😊',
  'Apply\nAnyway!',
  '#Open\nToWork',
  'Will Code\nfor Coffee ☕',
  'You Got\nThis! 💪',
  'Hire Me\nPlease?? 🙏',
  'Keep On\nApplying!',
  'Dream\nBig! 🌟',
];

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// ─── Stick-figure SVG ─────────────────────────────────────────────────────────
interface FigProps { mood: Mood; walkFrame: number; signText: string; bobY: number; }

const StickFigure = ({ mood, walkFrame, signText, bobY }: FigProps) => {
  const signing = mood === 'signing';
  const waving  = mood === 'waving';
  const walking = mood === 'walking';

  // Walk cycle — legs alternate, arms opposite
  const leftLegX  = walking ? (walkFrame === 0 ? 24 : 52) : 29;
  const rightLegX = walking ? (walkFrame === 0 ? 52 : 24) : 47;
  const leftArmY  = walking ? (walkFrame === 0 ? 72 : 60) : 68;
  const rightArmY = walking ? (walkFrame === 0 ? 60 : 72) : 68;

  const signLines = signText.split('\n');

  return (
    <svg
      viewBox="0 0 76 154"
      width={W}
      height={H}
      style={{ overflow: 'visible', display: 'block', transform: `translateY(${bobY}px)` }}
    >
      {/* ── Ground shadow ── */}
      <ellipse cx="38" cy="151" rx="24" ry="4.5" fill="rgba(0,0,0,0.07)" />

      {/* ── Sign (overflows left via overflow:visible) ── */}
      {signing && (
        <g>
          {/* Left arm up to pole */}
          <line x1="38" y1="60" x2="12" y2="46"
                stroke="#334155" strokeWidth="3.2" strokeLinecap="round" />
          {/* Pole */}
          <line x1="12" y1="46" x2="12" y2="10"
                stroke="#78716C" strokeWidth="2.5" strokeLinecap="round" />
          {/* Sign box */}
          <rect x="-52" y="8" width="62" height="46" rx="6"
                fill="#FFFBEB" stroke="#F59E0B" strokeWidth="2.8" />
          {/* Inner decorative border */}
          <rect x="-49" y="11" width="56" height="40" rx="4"
                fill="none" stroke="#FCD34D" strokeWidth="1.2" strokeDasharray="3 2" />
          {/* Text */}
          {signLines.map((line, i) => (
            <text
              key={i}
              x="-21"
              y={signLines.length === 1 ? 35 : i === 0 ? 24 : 42}
              textAnchor="middle"
              fontFamily='"Comic Sans MS","Chalkboard SE","Comic Neue",cursive'
              fontSize="12"
              fontWeight="bold"
              fill="#92400E"
            >
              {line}
            </text>
          ))}
          {/* Corner rivets */}
          <circle cx="-47" cy="12" r="2.5" fill="#F59E0B" />
          <circle cx="7"   cy="12" r="2.5" fill="#F59E0B" />
          <circle cx="-47" cy="50" r="2.5" fill="#F59E0B" />
          <circle cx="7"   cy="50" r="2.5" fill="#F59E0B" />
        </g>
      )}

      {/* ── Hair tufts ── */}
      <path d="M22 11 Q25 3 30 7"  fill="none" stroke="#B45309" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M30 7  Q38 1 46 7"  fill="none" stroke="#B45309" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M46 7  Q51 3 56 9"  fill="none" stroke="#B45309" strokeWidth="2.4" strokeLinecap="round" />

      {/* ── Head ── */}
      <circle cx="38" cy="25" r="22"
              fill="#FFF8E1" stroke="#334155" strokeWidth="2.8" />

      {/* ── Eyebrows (friendly arch) ── */}
      <path d="M27 16 Q32 13 37 16" fill="none" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
      <path d="M39 16 Q44 13 49 16" fill="none" stroke="#334155" strokeWidth="2" strokeLinecap="round" />

      {/* ── Eyes ── */}
      <circle cx="32" cy="22" r="4" fill="#1E293B" />
      <circle cx="44" cy="22" r="4" fill="#1E293B" />
      {/* Shine */}
      <circle cx="33.8" cy="20.2" r="1.5" fill="white" />
      <circle cx="45.8" cy="20.2" r="1.5" fill="white" />

      {/* ── Nose ── */}
      <circle cx="38" cy="28" r="1.4" fill="#CBD5E1" />

      {/* ── Wide smile ── */}
      <path d="M25 33 Q38 48 51 33"
            fill="none" stroke="#334155" strokeWidth="2.8" strokeLinecap="round" />
      {/* Tooth gap */}
      <path d="M30 34 L30 39 L38 39 L38 34"
            fill="white" stroke="#334155" strokeWidth="1.2" />

      {/* ── Blush ── */}
      <ellipse cx="21" cy="31" rx="5.5" ry="3.2" fill="#FDA4AF" opacity="0.5" />
      <ellipse cx="55" cy="31" rx="5.5" ry="3.2" fill="#FDA4AF" opacity="0.5" />

      {/* ── Neck ── */}
      <line x1="38" y1="47" x2="38" y2="56"
            stroke="#334155" strokeWidth="3" strokeLinecap="round" />

      {/* ── Body ── */}
      <line x1="38" y1="56" x2="38" y2="102"
            stroke="#334155" strokeWidth="4" strokeLinecap="round" />

      {/* ── Left arm ── */}
      {!signing && (
        <line x1="38" y1="63" x2="16" y2={leftArmY}
              stroke="#334155" strokeWidth="3" strokeLinecap="round" />
      )}

      {/* ── Right arm ── */}
      <line
        x1="38" y1="63"
        x2={waving ? 66 : 60}
        y2={waving ? 40 : rightArmY}
        stroke="#334155" strokeWidth="3" strokeLinecap="round"
      />
      {/* Waving hand */}
      {waving && (
        <circle cx="68" cy="36" r="5.5"
                fill="#FFF8E1" stroke="#334155" strokeWidth="2.2" />
      )}

      {/* ── Left leg ── */}
      <line x1="38" y1="102" x2={leftLegX} y2="136"
            stroke="#334155" strokeWidth="3.2" strokeLinecap="round" />
      {/* Left foot loop */}
      <ellipse cx={leftLegX} cy="143" rx="12" ry="6"
               fill="#FFF8E1" stroke="#334155" strokeWidth="2.4" />

      {/* ── Right leg ── */}
      <line x1="38" y1="102" x2={rightLegX} y2="136"
            stroke="#334155" strokeWidth="3.2" strokeLinecap="round" />
      {/* Right foot loop */}
      <ellipse cx={rightLegX} cy="143" rx="12" ry="6"
               fill="#FFF8E1" stroke="#334155" strokeWidth="2.4" />
    </svg>
  );
};

// ─── Speech bubble (always above character) ──────────────────────────────────
const Bubble = ({ text, charX, charY }: { text: string; charX: number; charY: number }) => {
  const [vw, setVw] = useState(1200);
  useEffect(() => { setVw(window.innerWidth); }, []);

  const bubW   = 168;
  const center = charX + W / 2;
  let   left   = center - bubW / 2;
  left = Math.max(SIDEBAR_W + 4, Math.min(vw - bubW - 8, left));

  const top       = Math.max(8, charY - 82);
  const tailLeft  = Math.min(bubW - 20, Math.max(10, center - left - 7));

  return (
    <div style={{ position: 'fixed', left, top, zIndex: 10001, pointerEvents: 'none', width: bubW }}>
      <div style={{
        background:   'white',
        border:       '2.5px solid #334155',
        borderRadius: '14px',
        padding:      '8px 13px',
        fontSize:     '12px',
        fontFamily:   '"Comic Sans MS","Chalkboard SE","Comic Neue",cursive',
        fontWeight:   700,
        color:        '#1E293B',
        lineHeight:   1.45,
        boxShadow:    '3px 3px 0 #334155',
        animation:    'doodle-pop 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        whiteSpace:   'pre-line',
      }}>
        {text}
      </div>
      {/* Down-pointing tail */}
      <div style={{ position: 'absolute', bottom: -11, left: tailLeft,
                    width: 0, height: 0, borderLeft: '7px solid transparent',
                    borderRight: '7px solid transparent', borderTop: '11px solid #334155' }} />
      <div style={{ position: 'absolute', bottom: -7.5, left: tailLeft + 2.5,
                    width: 0, height: 0, borderLeft: '4.5px solid transparent',
                    borderRight: '4.5px solid transparent', borderTop: '8px solid white' }} />
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function DoodleCharacter() {
  const [mounted,   setMounted]   = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pos,       setPos]       = useState({ x: 400, y: 600 });
  const [mood,      setMood]      = useState<Mood>('idle');
  const [walkFrame, setWalkFrame] = useState(0);
  const [bobY,      setBobY]      = useState(0);
  const [signText,  setSignText]  = useState('Be\nHappy! 😊');
  const [bubble,    setBubble]    = useState<string | null>(null);

  const posRef      = useRef({ x: 400, y: 600 });
  const velRef      = useRef({ x: 0, y: 0 });
  const moodRef     = useRef<Mood>('idle');
  const rafRef      = useRef(0);
  const walkRef     = useRef(0);
  const lastWalkT   = useRef(0);
  const targetXRef  = useRef<number | null>(null);
  const nextActionT = useRef(0);
  const bobRef      = useRef(0);
  const bottomYRef  = useRef(600);
  const bubTimer    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showBubble = useCallback((text: string, ms = 3500) => {
    setBubble(text);
    clearTimeout(bubTimer.current);
    bubTimer.current = setTimeout(() => setBubble(null), ms);
  }, []);

  // ── Mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (localStorage.getItem('doodle_v2_dismissed') === '1') { setDismissed(true); return; }

    const vw      = window.innerWidth  || 1200;
    const vh      = window.innerHeight || 800;
    const bottomY = vh - H - BOT_MARGIN;
    const startX  = Math.max(SIDEBAR_W + 40,
                             Math.random() * (vw - W - SIDEBAR_W - 80) + SIDEBAR_W + 40);

    bottomYRef.current = bottomY;
    posRef.current     = { x: startX, y: bottomY };
    setPos({ x: startX, y: bottomY });
    setMounted(true);

    const onResize = () => {
      const ny = window.innerHeight - H - BOT_MARGIN;
      bottomYRef.current = ny;
      posRef.current = { ...posRef.current, y: ny };
      setPos(p => ({ ...p, y: ny }));
    };
    window.addEventListener('resize', onResize);
    setTimeout(() => showBubble("Hey! 👋 I'm your career buddy.", 4000), 1800);
    return () => window.removeEventListener('resize', onResize);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Periodic quips ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted || dismissed) return;
    const t = setInterval(() => {
      if (moodRef.current === 'idle') showBubble(pick(QUIPS), 4500);
    }, 22000);
    return () => clearInterval(t);
  }, [mounted, dismissed, showBubble]);

  // ── RAF physics loop (horizontal only) ───────────────────────────────────
  useEffect(() => {
    if (!mounted || dismissed) return;

    const pickNewAction = (now: number) => {
      const vw   = window.innerWidth;
      const roll = Math.random();

      if (roll < 0.45) {
        const minX = SIDEBAR_W + 40;
        const maxX = vw - W - 40;
        const tx   = Math.max(minX, Math.random() * (maxX - minX) + minX);
        targetXRef.current  = tx;
        moodRef.current     = 'walking';
        setMood('walking');
        nextActionT.current = now + 25000;

      } else if (roll < 0.65) {
        targetXRef.current  = null;
        moodRef.current     = 'waving';
        setMood('waving');
        nextActionT.current = now + 2400;

      } else if (roll < 0.85) {
        targetXRef.current  = null;
        setSignText(pick(SIGNS));
        moodRef.current     = 'signing';
        setMood('signing');
        nextActionT.current = now + 6500;

      } else {
        targetXRef.current  = null;
        moodRef.current     = 'idle';
        setMood('idle');
        showBubble(pick(QUIPS), 4000);
        nextActionT.current = now + 8000;
      }
    };

    const tick = (now: number) => {
      const p  = posRef.current;
      const v  = velRef.current;
      const vw = window.innerWidth;

      // Gentle bob
      bobRef.current += 1;
      if (bobRef.current % 2 === 0) setBobY(Math.sin(bobRef.current / 18) * 2.5);

      // Trigger next action
      if (now >= nextActionT.current) pickNewAction(now);

      // Steer toward target X
      if (moodRef.current === 'walking' && targetXRef.current !== null) {
        const dx   = targetXRef.current - p.x;
        const dist = Math.abs(dx);
        if (dist < 8) {
          v.x = 0;
          moodRef.current     = 'idle';
          setMood('idle');
          targetXRef.current  = null;
          nextActionT.current = now + 3000 + Math.random() * 4000;
        } else {
          v.x += (dx / dist) * Math.min(IDLE_SPEED, dist * 0.06);
        }
      }

      // Friction + speed cap
      let vx  = v.x * FRICTION;
      const s = Math.abs(vx);
      if (s > IDLE_SPEED + 0.4) vx = (vx / s) * (IDLE_SPEED + 0.4);

      // Clamp X, bounce off walls
      const minX = SIDEBAR_W + 10;
      const maxX = vw - W - 10;
      let nx = p.x + vx;
      if (nx < minX) { nx = minX; vx = Math.abs(vx) * 0.4; }
      if (nx > maxX) { nx = maxX; vx = -Math.abs(vx) * 0.4; }

      // Y always locked to bottom
      const ny = bottomYRef.current;

      // Leg animation while moving
      if (s > 0.3 && now - lastWalkT.current > 200) {
        walkRef.current   = walkRef.current === 0 ? 1 : 0;
        lastWalkT.current = now;
        setWalkFrame(walkRef.current);
      }

      posRef.current = { x: nx, y: ny };
      velRef.current = { x: vx, y: 0 };
      setPos({ x: nx, y: ny });

      rafRef.current = requestAnimationFrame(tick);
    };

    nextActionT.current = performance.now() + 4000;
    rafRef.current      = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mounted, dismissed, showBubble]);

  // ── Interactions ──────────────────────────────────────────────────────────
  const handleClick = () => {
    const r = [
      "oh so you noticed me 😳",
      "hey! I'm working here.",
      "*straightens tie nervously*",
      "yes yes, very funny.",
      "go apply to some jobs!",
      "I'm busy being adorable.",
    ];
    showBubble(pick(r), 3000);
    moodRef.current     = 'waving';
    setMood('waving');
    nextActionT.current = performance.now() + 2200;
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBubble("Fine. I'll leave. 😢");
    setTimeout(() => {
      setDismissed(true);
      localStorage.setItem('doodle_v2_dismissed', '1');
    }, 1200);
  };

  if (!mounted || dismissed) return null;

  return (
    <>
      {bubble && <Bubble text={bubble} charX={pos.x} charY={pos.y} />}

      <div
        onClick={handleClick}
        style={{
          position:   'fixed',
          left:        pos.x,
          top:         pos.y,
          width:       W,
          height:      H,
          zIndex:      9999,
          cursor:      'pointer',
          userSelect:  'none',
          overflow:    'visible',
        }}
        title="Click me!"
      >
        <StickFigure mood={mood} walkFrame={walkFrame} signText={signText} bobY={bobY} />

        {/* Dismiss × */}
        <div
          onClick={handleDismiss}
          title="Dismiss"
          style={{
            position:       'absolute',
            top: -10, right: -10,
            width: 18, height: 18,
            background:     'white',
            border:         '1.5px solid #94A3B8',
            borderRadius:   '50%',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       '11px',
            fontWeight:     800,
            color:          '#64748B',
            cursor:         'pointer',
            opacity:        0.75,
            boxShadow:      '1px 1px 3px rgba(0,0,0,0.12)',
          }}
        >
          ×
        </div>
      </div>

      <style>{`
        @keyframes doodle-pop {
          from { transform: scale(0.4) translateY(10px); opacity: 0; }
          to   { transform: scale(1)   translateY(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
