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
      viewBox="0 0 32 32"
      fill="none"
      className={className}
    >
      {/* Top face (magenta/pink) */}
      <polygon points="8,10 16,5 24,10 16,15" fill="#d946ef" />
      {/* Left face (blue) */}
      <polygon points="8,10 16,15 16,25 8,20" fill="#3b82f6" />
      {/* Right face (cyan) */}
      <polygon points="16,15 24,10 24,20 16,25" fill="#22d3ee" />
      {/* Inner cube highlight */}
      <polygon points="12,14 16,12 20,14 16,16" fill="#67e8f9" opacity="0.6" />
      <polygon points="12,14 16,16 16,20 12,18" fill="#2563eb" opacity="0.7" />
      <polygon points="16,16 20,14 20,18 16,20" fill="#7c3aed" opacity="0.5" />
    </svg>
  );
}
