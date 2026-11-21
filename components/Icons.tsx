type Props = { className?: string };
const base = { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true } as const;

export const PlayIcon = ({ className = "h-6 w-6" }: Props) => (
  <svg {...base} className={className}><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" /></svg>
);
export const PauseIcon = ({ className = "h-6 w-6" }: Props) => (
  <svg {...base} className={className}><path d="M7 5h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm7 0h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /></svg>
);
export const NextIcon = ({ className = "h-6 w-6" }: Props) => (
  <svg {...base} className={className}><path d="M5 5.6v12.8a1 1 0 0 0 1.55.83L15 13.5V18a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v4.5L6.55 4.77A1 1 0 0 0 5 5.6z" /></svg>
);
export const CloseIcon = ({ className = "h-5 w-5" }: Props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className={className}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const PlusIcon = ({ className = "h-5 w-5" }: Props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden className={className}><path d="M12 5v14M5 12h14" /></svg>
);
export const CheckIcon = ({ className = "h-5 w-5" }: Props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const TopIcon = ({ className = "h-5 w-5" }: Props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}><path d="M5 5h14M12 20V9M7 14l5-5 5 5" /></svg>
);
export const SearchIcon = ({ className = "h-5 w-5" }: Props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className={className}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
);
export const VolumeIcon = ({ className = "h-5 w-5" }: Props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}><path d="M4 9.5h3l5-4v13l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /></svg>
);
export const FullscreenIcon = ({ className = "h-5 w-5" }: Props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
);
export const MicIcon = ({ className = "h-6 w-6" }: Props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M8.5 21h7" /></svg>
);
export const Forward10Icon = ({ className = "h-6 w-6" }: Props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}><path d="M20 4v5h-5" /><path d="M19.4 9A8 8 0 1 0 20 12" /><text x="12" y="15.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none">10</text></svg>
);
export const QueueIcon = ({ className = "h-5 w-5" }: Props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden className={className}><path d="M4 6h16M4 12h16M4 18h10" /></svg>
);
