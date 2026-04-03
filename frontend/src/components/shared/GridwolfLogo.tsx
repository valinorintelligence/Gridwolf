interface LogoProps {
  size?: number;
  className?: string;
}

export default function GridwolfLogo({ size = 32, className = '' }: LogoProps) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}logo.png`}
      alt="Gridwolf"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}
