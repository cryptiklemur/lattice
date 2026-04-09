interface LatticeLogomarkProps {
  size: number;
}

export function LatticeLogomark(props: LatticeLogomarkProps) {
  const s = props.size;
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="18" height="18" rx="3" fill="currentColor" />
      <rect x="26" y="4" width="18" height="18" rx="3" fill="currentColor" opacity="0.55" />
      <rect x="4" y="26" width="18" height="18" rx="3" fill="currentColor" opacity="0.55" />
      <rect x="26" y="26" width="18" height="18" rx="3" fill="currentColor" opacity="0.25" />
      <line x1="13" y1="22" x2="13" y2="26" stroke="currentColor" strokeWidth="1.5" opacity="0.8" />
      <line x1="35" y1="22" x2="35" y2="26" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <line x1="22" y1="13" x2="26" y2="13" stroke="currentColor" strokeWidth="1.5" opacity="0.8" />
      <line x1="22" y1="35" x2="26" y2="35" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
    </svg>
  );
}
