// The CoinLeak mark: a coin with one drop leaking out. Inline SVG, no files.

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <circle cx="14" cy="14" r="10.5" fill="var(--primary)" fillOpacity="0.12" />
      <circle cx="14" cy="14" r="10.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="14" cy="14" r="6.4" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.35" />
      <path d="M25.6 19.6c0 0-3.6 4.2-3.6 6.6a3.6 3.6 0 0 0 7.2 0c0-2.4-3.6-6.6-3.6-6.6Z" fill="var(--primary)" />
    </svg>
  );
}
