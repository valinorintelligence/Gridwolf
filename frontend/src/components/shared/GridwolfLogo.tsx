interface LogoProps {
  size?: number;
  className?: string;
}

export default function GridwolfLogo({ size = 32, className = '' }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={className}
    >
      {/*
        Gridwolf isometric brand mark — right-pointing arrow/chevron
        composed of 3D blocks:
          - Top bar: magenta parallelogram
          - Left column: blue/purple
          - Bottom-left: small dark blue cube
          - Center: cyan block
          - Right: purple face
      */}

      {/* === TOP BAR (Magenta) === */}
      {/* Top face */}
      <polygon points="25,30 60,10 95,30 60,50" fill="#e879f9" />
      {/* Front face */}
      <polygon points="25,30 60,50 60,58 25,38" fill="#c026d3" />
      {/* Right face */}
      <polygon points="60,50 95,30 95,38 60,58" fill="#d946ef" />

      {/* === LEFT COLUMN (Blue) === */}
      {/* Front face */}
      <polygon points="25,38 45,50 45,90 25,78" fill="#2563eb" />
      {/* Top face */}
      <polygon points="25,38 60,58 60,58 45,50" fill="#3b82f6" opacity="0" />

      {/* === BOTTOM-LEFT SMALL CUBE (Dark Blue) === */}
      {/* Front face */}
      <polygon points="25,78 45,90 45,110 25,98" fill="#1e40af" />
      {/* Top face */}
      <polygon points="25,78 45,68 60,78 45,90" fill="#3b82f6" opacity="0" />

      {/* === CENTER BLOCK (Cyan) === */}
      {/* Top face (light cyan) */}
      <polygon points="45,50 95,38 95,58 60,78 45,68 45,50" fill="#67e8f9" />
      {/* Front face (cyan) */}
      <polygon points="45,68 60,78 60,110 45,98" fill="#06b6d4" />
      {/* Alternate: keep as single piece */}
      <polygon points="45,90 45,110 60,110 60,78 45,68 45,90" fill="#22d3ee" />

      {/* === RIGHT FACE (Purple/Blue) === */}
      {/* Right outer face */}
      <polygon points="60,78 95,58 95,90 60,110" fill="#3b82f6" />

      {/* === Inner small cube highlight (bottom-left step) === */}
      {/* Top */}
      <polygon points="25,78 45,68 60,78 45,90" fill="#60a5fa" opacity="0.5" />
      {/* Left face */}
      <polygon points="25,78 25,98 45,110 45,90" fill="#1e40af" />
    </svg>
  );
}
