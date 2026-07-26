interface BrandMarkProps {
  size?: number;
}

export function BrandMark({ size = 34 }: BrandMarkProps) {
  return (
    <div className="brand-mark" style={{ width: size, height: size }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M9 18L3 12L9 6"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15 6L21 12L15 18"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
