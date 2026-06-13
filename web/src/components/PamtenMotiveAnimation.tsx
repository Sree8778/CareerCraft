'use client';

import React, { useState, useEffect, useRef } from 'react';
import PamtenLogo from './PamtenLogo';

interface Motive {
  id: string;
  num: string;
  keyLabel: string;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  glowColor: string;
  textColor: string;
  borderColor: string;
  accentBg: string;
  telemetry: string;
  stats: { label: string; value: string }[];
}

const motives: Motive[] = [
  {
    id: 'transform',
    num: '01',
    keyLabel: 'TRANSFORM',
    title: 'Driven to Transform',
    subtitle: 'Technology Enablement',
    description: 'Empowering global enterprises with scalable cloud architectures, cybersecurity protocols, and next-generation AI integrations.',
    color: '#A855F7', // Purple
    glowColor: 'rgba(168, 85, 247, 0.4)',
    textColor: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    accentBg: 'bg-purple-950/10',
    telemetry: 'SYS.TRANSFORM_V3.2 // SYNC: 99.8%',
    stats: [
      { label: 'Engine', value: 'Enterprise AI' },
      { label: 'Speed', value: '+40% Avg' },
      { label: 'Cipher', value: 'AES-256' }
    ]
  },
  {
    id: 'service',
    num: '02',
    keyLabel: 'SERVICE',
    title: 'Service First',
    subtitle: 'Core Client Philosophy',
    description: 'Operating under the firm tenet that "Service Comes First", fostering collaboration, deep trust, and sustainable client-centric value.',
    color: '#3B82F6', // Blue
    glowColor: 'rgba(59, 130, 246, 0.4)',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    accentBg: 'bg-blue-950/10',
    telemetry: 'SERVICE.PHILOSOPHY // TACT: 99.4%',
    stats: [
      { label: 'Retention', value: '98.6%' },
      { label: 'SLA Support', value: '< 2 Hours' },
      { label: 'Delivery', value: 'Continuous' }
    ]
  },
  {
    id: 'sofkin',
    num: '03',
    keyLabel: 'SOFKIN',
    title: 'SOFKIN',
    subtitle: 'Social Good Initiative',
    description: 'A non-profit organization dedicated to transforming the lives of children in need by providing food, shelter, education, and secure homes.',
    color: '#EC4899', // Pink
    glowColor: 'rgba(236, 72, 153, 0.4)',
    textColor: 'text-pink-400',
    borderColor: 'border-pink-500/30',
    accentBg: 'bg-pink-950/10',
    telemetry: 'SOFKIN.ORG_ACTIVE // SYNC: 100%',
    stats: [
      { label: 'Supported', value: '500+ Kids' },
      { label: 'Shelters', value: '4 Global' },
      { label: 'Care Model', value: 'Holistic' }
    ]
  },
  {
    id: 'shetek',
    num: '04',
    keyLabel: 'SHETEK',
    title: 'SheTek',
    subtitle: 'Women in Technology',
    description: 'Developing a robust pipeline of female tech talent through structured mentoring, professional training, and career pathing support.',
    color: '#06B6D4', // Cyan
    glowColor: 'rgba(6, 182, 212, 0.4)',
    textColor: 'text-cyan-400',
    borderColor: 'border-cyan-500/30',
    accentBg: 'bg-cyan-950/10',
    telemetry: 'SHETEK.PIPELINE // FEED: ACTIVE',
    stats: [
      { label: 'Mentored', value: '2,000+' },
      { label: 'Partners', value: '80+ Tech' },
      { label: 'Placed', value: '88.3%' }
    ]
  }
];

export default function PamtenMotiveAnimation() {
  const [activeTab, setActiveTab] = useState<string>('transform');
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [ping, setPing] = useState(14);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const activeMotive = motives.find(m => m.id === activeTab) || motives[0];

  // Simulating live latency telemetry
  useEffect(() => {
    const interval = setInterval(() => {
      setPing(Math.floor(Math.random() * 6) + 12);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Smooth mouse move parallax on the core
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    
    setRotation({
      x: -y * 15,
      y: x * 15
    });
  };

  const handleMouseLeave = () => {
    setRotation({ x: 0, y: 0 });
  };

  // Canvas particle stream (flowing from projector base up to core)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      hue: number;
      opacity: number;
      decay: number;
      angle: number;
      radius: number;
      speedRotate: number;

      constructor() {
        this.reset();
      }

      reset() {
        this.x = width / 2;
        this.y = height * 0.45; // Starts at projector base height (around 45%)
        this.size = Math.random() * 2 + 0.8;
        this.radius = Math.random() * 25 + 5;
        this.angle = Math.random() * Math.PI * 2;
        this.speedRotate = Math.random() * 0.03 + 0.01;
        
        // Rise upwards towards the center logo core
        this.speedY = -(Math.random() * 1.2 + 0.6);
        this.speedX = (Math.random() - 0.5) * 0.4;

        if (activeTab === 'transform') this.hue = 280; // Purple
        else if (activeTab === 'service') this.hue = 220; // Blue
        else if (activeTab === 'sofkin') this.hue = 330; // Pink
        else this.hue = 190; // Cyan
        
        this.opacity = Math.random() * 0.6 + 0.3;
        this.decay = Math.random() * 0.005 + 0.002;
      }

      update() {
        this.angle += this.speedRotate;
        this.radius += 0.2;
        
        const targetX = width / 2 + Math.cos(this.angle) * this.radius;
        
        if (this.y < height * 0.2) {
          this.opacity -= 0.02; // Fade out quickly as they leave core
        } else {
          this.x += (targetX - this.x) * 0.08;
        }
        
        this.y += this.speedY;
        this.x += this.speedX;
        this.opacity -= this.decay;
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 90%, 65%, ${this.opacity})`;
        ctx.shadowBlur = 4;
        ctx.shadowColor = `hsla(${this.hue}, 90%, 65%, 1)`;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    const particles: Particle[] = [];
    const maxParticles = 40;

    for (let i = 0; i < maxParticles; i++) {
      particles.push(new Particle());
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Scanning HUD horizontal sweep line
      const scanY = (Date.now() / 15) % height;
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(width, scanY);
      ctx.strokeStyle = `rgba(255, 255, 255, 0.015)`;
      ctx.stroke();

      // Update & Draw particles
      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();

        if (particles[i].opacity <= 0 || particles[i].y < 10) {
          particles[i].reset();
        }
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [activeTab]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full flex flex-col justify-between p-6 overflow-hidden rounded-3xl border border-white/5 bg-zinc-950/30 backdrop-blur-md h-[620px]"
      style={{ perspective: 1200 }}
    >
      {/* Background Interactive Particle Stream */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />

      {/* Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.06] pointer-events-none z-0"
        style={{
          backgroundImage: 'radial-gradient(circle at center, rgba(139, 92, 246, 0.1) 0%, transparent 60%), linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 40px 40px, 40px 40px',
        }}
      />

      {/* Header Telemetry bar */}
      <div className="w-full flex justify-between items-center z-10 border-b border-white/5 pb-2">
        <span className="font-mono text-[9px] tracking-widest text-white/30">// PAMTEN_MOTIVE_ENGINE</span>
        <span className="font-mono text-[9px] text-white/40 tracking-wider">
          LATENCY: {ping}ms // STATE: NOMINAL
        </span>
      </div>

      {/* ========================================================== */}
      {/* 1. TOP SECTION: Holographic Projection Core              */}
      {/* ========================================================== */}
      <div className="flex-grow flex items-center justify-center relative min-h-[220px] z-10 select-none">
        <div
          className="relative flex items-center justify-center transition-transform duration-300 ease-out"
          style={{
            transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Projector Base Platform */}
          <div 
            className="absolute w-40 h-10 bg-gradient-to-t from-white/5 to-transparent blur-[1px] rounded-full border border-white/10"
            style={{
              transform: 'translateY(70px) rotateX(75deg) translateZ(-10px)',
              background: `radial-gradient(circle, ${activeMotive.glowColor} 0%, transparent 80%)`
            }}
          />

          {/* Cone Projection Light Beam */}
          <div 
            className="absolute w-28 h-36 pointer-events-none opacity-35 transition-all duration-500"
            style={{
              top: '-50px',
              transform: 'translateZ(-10px)',
              background: `linear-gradient(to top, ${activeMotive.glowColor} 0%, transparent 95%)`,
              clipPath: 'polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%)'
            }}
          />

          {/* Core Sphere Ambient Glow */}
          <div 
            className="absolute w-48 h-48 rounded-full pointer-events-none transition-all duration-750 blur-[55px]"
            style={{
              transform: 'translateZ(-40px)',
              background: activeMotive.glowColor
            }}
          />

          {/* Hologram Shield Container */}
          <div 
            className="relative w-28 h-28 rounded-full border border-white/15 bg-zinc-950/80 backdrop-blur-2xl flex items-center justify-center shadow-2xl transition-all duration-500"
            style={{
              transformStyle: 'preserve-3d',
              boxShadow: `0 0 25px ${activeMotive.glowColor}`
            }}
          >
            {/* Spinning Telemetry Rings */}
            <div 
              className="absolute inset-1 rounded-full border border-dashed border-white/5 animate-[spin_15s_linear_infinite]"
              style={{ transform: 'translateZ(3px)' }}
            />
            <div 
              className="absolute inset-3 rounded-full border border-white/5 border-t-white/30 animate-[spin_4s_linear_infinite]"
              style={{ 
                transform: 'rotateX(55deg) translateZ(8px)',
                borderColor: `${activeMotive.color}15`,
                borderTopColor: activeMotive.color
              }}
            />
            <div 
              className="absolute inset-3 rounded-full border border-white/5 border-b-white/30 animate-[spin_7s_linear_infinite_reverse]"
              style={{ 
                transform: 'rotateX(-55deg) translateZ(8px)',
                borderColor: `${activeMotive.color}15`,
                borderBottomColor: activeMotive.color
              }}
            />

            {/* The Real PamTen Logo */}
            <div 
              className="relative transition-all duration-500 scale-90"
              style={{ 
                transform: 'translateZ(15px)',
                filter: `drop-shadow(0 0 8px ${activeMotive.glowColor})`
              }}
            >
              <PamtenLogo width={75} height={37} mode="header" />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================== */}
      {/* 2. MIDDLE SECTION: Cyber Command Keys Selector Deck       */}
      {/* ========================================================== */}
      <div className="w-full grid grid-cols-4 gap-2 z-10 my-4">
        {motives.map((m) => {
          const isSelected = activeTab === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setActiveTab(m.id)}
              className={`py-2 rounded-lg border backdrop-blur-md transition-all duration-300 flex flex-col items-center justify-center select-none ${
                isSelected
                  ? 'bg-white/5 shadow-md text-white'
                  : 'bg-zinc-900/10 border-white/5 text-gray-500 hover:border-white/10 hover:text-white'
              }`}
              style={{
                borderColor: isSelected ? `${m.color}60` : undefined,
                boxShadow: isSelected ? `0 0 10px ${m.glowColor}` : undefined
              }}
            >
              <span className="font-mono text-[9px] opacity-40">{m.num}</span>
              <span className="font-mono text-[9px] font-bold tracking-widest mt-0.5">{m.keyLabel}</span>
              <span 
                className="w-1 h-1 rounded-full mt-1.5 transition-transform"
                style={{ 
                  backgroundColor: m.color,
                  boxShadow: isSelected ? `0 0 6px ${m.color}` : 'none'
                }}
              />
            </button>
          );
        })}
      </div>

      {/* ========================================================== */}
      {/* 3. BOTTOM SECTION: Spacious Telemetry Details Terminal     */}
      {/* ========================================================== */}
      <div className="w-full z-10">
        <div 
          className={`w-full p-5 rounded-2xl border backdrop-blur-xl transition-all duration-500 bg-zinc-950/60 shadow-2xl flex flex-col justify-between ${activeMotive.borderColor}`}
          style={{
            boxShadow: `0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px ${activeMotive.glowColor}`
          }}
        >
          {/* Module telemetry line */}
          <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: activeMotive.color }} />
              <span className="font-mono text-[9px] tracking-wider text-white/50">{activeMotive.telemetry}</span>
            </div>
            <span className="font-mono text-[9px] text-white/30">M_0{activeMotive.num}</span>
          </div>

          {/* Details header and body */}
          <div className="text-left">
            <h3 className="text-lg font-bold text-white mb-0.5 leading-tight">
              {activeMotive.title}
            </h3>
            <p className={`text-[10px] font-semibold font-mono tracking-widest uppercase ${activeMotive.textColor} mb-2`}>
              {activeMotive.subtitle}
            </p>
            <p className="text-xs text-gray-300 leading-relaxed font-normal min-h-[48px]">
              {activeMotive.description}
            </p>
          </div>

          {/* Metrics Status Grid */}
          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="grid grid-cols-3 gap-2">
              {activeMotive.stats.map((s, idx) => (
                <div key={idx} className="bg-white/5 p-1.5 rounded-lg border border-white/5 text-center">
                  <div className="text-[7.5px] font-mono text-gray-400 uppercase tracking-wider truncate">{s.label}</div>
                  <div className="text-[10.5px] font-bold text-white font-mono mt-0.5 truncate">{s.value}</div>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </div>

    </div>
  );
}
