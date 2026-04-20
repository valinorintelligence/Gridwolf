/**
 * Decorative isometric ICS/SCADA illustration for the auth pages.
 *
 * Rendered entirely as inline SVG so it scales crisply at any size,
 * inherits theme colours via CSS variables, and animates without an
 * external asset. The animation is driven by Tailwind keyframes
 * declared in src/index.css (float-slow / pulse-glow / spin-slow).
 */
export default function ICSIllustration() {
  return (
    <div className="relative w-full max-w-xl aspect-[4/3] select-none">
      {/* Ambient gradient backdrop */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-[#22d3ee]/10 via-[#7c3aed]/5 to-transparent blur-2xl" />

      <svg
        viewBox="0 0 800 600"
        className="relative h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Isometric illustration of an industrial control system"
      >
        <defs>
          {/* Glowing connection gradient */}
          <linearGradient id="ics-path" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#22d3ee" stopOpacity="1" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.1" />
          </linearGradient>

          {/* Module body gradients */}
          <linearGradient id="body-light" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          <linearGradient id="body-dark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <linearGradient id="body-accent" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.4" />
          </linearGradient>

          {/* Soft drop shadow */}
          <filter id="module-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="6" />
            <feOffset dx="0" dy="6" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.3" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* LED glow */}
          <radialGradient id="led-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="1" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ───────── Glowing connection paths between modules ───────── */}
        <g className="ics-paths" stroke="url(#ics-path)" strokeWidth="3" fill="none" strokeLinecap="round">
          {/* Top bus — IO module → PLC */}
          <path d="M 175 280 Q 260 230 340 230" className="animate-pulse-glow" />
          {/* PLC → Drive */}
          <path d="M 560 230 Q 620 240 650 260" className="animate-pulse-glow" style={{ animationDelay: '0.5s' }} />
          {/* PLC → Motor */}
          <path d="M 460 370 Q 480 470 600 490" className="animate-pulse-glow" style={{ animationDelay: '1s' }} />
          {/* HMI → PLC */}
          <path d="M 195 430 Q 290 410 350 370" className="animate-pulse-glow" style={{ animationDelay: '0.3s' }} />
          {/* Relay → Motor */}
          <path d="M 345 475 Q 470 505 560 500" className="animate-pulse-glow" style={{ animationDelay: '0.8s' }} />
        </g>

        {/* ───────── IO Module (top-left) ───────── */}
        <g filter="url(#module-shadow)" className="animate-float-slow">
          {/* Top face */}
          <polygon points="100,240 175,200 205,220 130,260" fill="url(#body-light)" />
          {/* Front face */}
          <polygon points="100,240 130,260 130,340 100,320" fill="#94a3b8" />
          {/* Side face */}
          <polygon points="130,260 205,220 205,300 130,340" fill="url(#body-light)" />
          {/* Terminal strip */}
          <rect x="140" y="270" width="55" height="3" fill="#334155" opacity="0.6" />
          <rect x="140" y="278" width="55" height="3" fill="#334155" opacity="0.6" />
          <rect x="140" y="286" width="55" height="3" fill="#334155" opacity="0.6" />
          {/* Status LED */}
          <circle cx="150" cy="250" r="3" fill="#22d3ee" className="animate-pulse-glow" />
        </g>

        {/* ───────── PLC (center, largest) ───────── */}
        <g filter="url(#module-shadow)" className="animate-float-slow" style={{ animationDelay: '0.4s' }}>
          {/* Top face */}
          <polygon points="340,200 540,110 600,140 400,230" fill="url(#body-light)" />
          {/* Front face */}
          <polygon points="340,200 400,230 400,370 340,340" fill="#94a3b8" />
          {/* Side face */}
          <polygon points="400,230 600,140 600,280 400,370" fill="url(#body-light)" />

          {/* Ventilation slots on top */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <line
              key={i}
              x1={360 + i * 22}
              y1={210 + i * -5}
              x2={430 + i * 22}
              y2={180 + i * -5}
              stroke="#475569"
              strokeWidth="2"
              opacity="0.5"
            />
          ))}

          {/* Front panel terminals */}
          <rect x="410" y="250" width="180" height="6" fill="#334155" />
          <rect x="410" y="262" width="180" height="6" fill="#334155" />

          {/* Accent stripe */}
          <polygon points="400,245 600,155 600,162 400,252" fill="url(#body-accent)" />

          {/* Status LEDs — pulsing at staggered rates to suggest a live controller */}
          <circle cx="420" cy="280" r="4" fill="#22c55e" className="animate-pulse-glow" />
          <circle cx="435" cy="287" r="4" fill="#22d3ee" className="animate-pulse-glow" style={{ animationDelay: '0.3s' }} />
          <circle cx="450" cy="294" r="4" fill="#f59e0b" className="animate-pulse-glow" style={{ animationDelay: '0.6s' }} />
        </g>

        {/* ───────── Variable Frequency Drive (top-right) ───────── */}
        <g filter="url(#module-shadow)" className="animate-float-slow" style={{ animationDelay: '0.8s' }}>
          {/* Top face */}
          <polygon points="620,230 700,190 740,210 660,250" fill="url(#body-dark)" />
          {/* Front face */}
          <polygon points="620,230 660,250 660,360 620,340" fill="#1e293b" />
          {/* Side face */}
          <polygon points="660,250 740,210 740,320 660,360" fill="url(#body-dark)" />

          {/* Heatsink fins */}
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={i}
              x1={665 + i * 15}
              y1={247 - i * 7}
              x2={665 + i * 15}
              y2={355 - i * 7}
              stroke="#64748b"
              strokeWidth="2"
              opacity="0.7"
            />
          ))}

          {/* Display screen */}
          <rect x="630" y="260" width="25" height="12" fill="#0f172a" />
          <text x="642" y="270" fontSize="8" fill="#ef4444" fontFamily="monospace" textAnchor="middle">60.0</text>
        </g>

        {/* ───────── HMI / Controller (bottom-left) ───────── */}
        <g filter="url(#module-shadow)" className="animate-float-slow" style={{ animationDelay: '1.2s' }}>
          {/* Top face */}
          <polygon points="90,430 195,380 235,400 130,450" fill="url(#body-dark)" />
          {/* Front face */}
          <polygon points="90,430 130,450 130,530 90,510" fill="#1e293b" />
          {/* Side face */}
          <polygon points="130,450 235,400 235,480 130,530" fill="url(#body-dark)" />

          {/* 7-segment display */}
          <rect x="140" y="460" width="50" height="16" fill="#0f172a" rx="2" />
          <text x="165" y="473" fontSize="11" fill="#ef4444" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            888
          </text>

          {/* Buttons */}
          <rect x="200" y="458" width="10" height="6" fill="#22c55e" rx="1" />
          <rect x="200" y="468" width="10" height="6" fill="#ef4444" rx="1" />
        </g>

        {/* ───────── Relay / Contactor (bottom-center) ───────── */}
        <g filter="url(#module-shadow)" className="animate-float-slow" style={{ animationDelay: '0.6s' }}>
          <polygon points="275,450 335,420 365,435 310,465" fill="url(#body-dark)" />
          <polygon points="275,450 310,465 310,510 275,495" fill="#1e293b" />
          <polygon points="310,465 365,435 365,480 310,510" fill="url(#body-dark)" />

          {/* Actuator arm */}
          <line x1="340" y1="430" x2="355" y2="420" stroke="#94a3b8" strokeWidth="2" />
          <circle cx="340" cy="430" r="2" fill="#94a3b8" />
        </g>

        {/* ───────── Servo Motor (bottom-right) ───────── */}
        <g filter="url(#module-shadow)" className="animate-float-slow" style={{ animationDelay: '1s' }}>
          {/* Body */}
          <polygon points="550,450 670,395 720,420 600,475" fill="url(#body-dark)" />
          <polygon points="550,450 600,475 600,540 550,515" fill="#1e293b" />
          <polygon points="600,475 720,420 720,485 600,540" fill="url(#body-dark)" />

          {/* Mounting flange */}
          <polygon points="720,420 740,430 740,495 720,485" fill="#334155" />

          {/* Rotating shaft */}
          <g style={{ transformOrigin: '735px 455px' }} className="animate-spin-slow">
            <circle cx="735" cy="455" r="14" fill="#475569" />
            <circle cx="735" cy="455" r="10" fill="#64748b" />
            <rect x="721" y="453" width="28" height="4" fill="#94a3b8" />
            <rect x="733" y="441" width="4" height="28" fill="#94a3b8" />
          </g>

          {/* Nameplate */}
          <rect x="615" y="500" width="80" height="10" fill="#334155" rx="1" />
        </g>

        {/* ───────── Data particle traversing the PLC → Drive bus ───────── */}
        <circle r="4" fill="#22d3ee" className="ics-particle">
          <animateMotion dur="3.5s" repeatCount="indefinite" path="M 560 230 Q 620 240 650 260" />
          <animate attributeName="opacity" values="0;1;1;0" dur="3.5s" repeatCount="indefinite" />
        </circle>
        <circle r="3" fill="#7c3aed" className="ics-particle">
          <animateMotion dur="4s" repeatCount="indefinite" path="M 195 430 Q 290 410 350 370" />
          <animate attributeName="opacity" values="0;1;1;0" dur="4s" repeatCount="indefinite" />
        </circle>
        <circle r="3" fill="#22d3ee" className="ics-particle">
          <animateMotion dur="5s" repeatCount="indefinite" path="M 460 370 Q 480 470 600 490" />
          <animate attributeName="opacity" values="0;1;1;0" dur="5s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}
