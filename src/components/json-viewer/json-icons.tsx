type IconProps = {
  className?: string;
};

const DEFAULT_ICON_CLASS = "h-4 w-4";

export const TreeIcon = ({ className = DEFAULT_ICON_CLASS }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M6 5v14" />
    <path d="M6 8h6" />
    <path d="M6 16h6" />
    <rect x="12" y="5" width="6" height="6" rx="1.5" />
    <rect x="12" y="13" width="6" height="6" rx="1.5" />
  </svg>
);

export const TextIcon = ({ className = DEFAULT_ICON_CLASS }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M5 7h14" />
    <path d="M12 7v10" />
    <path d="M8 17h8" />
  </svg>
);

export const CompactIcon = ({ className = DEFAULT_ICON_CLASS }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M8 8 5 12l3 4" />
    <path d="M16 8 19 12l-3 4" />
    <path d="M10 18h4" />
    <path d="M10 6h4" />
  </svg>
);

export const CopyIcon = ({ className = DEFAULT_ICON_CLASS }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <rect x="9" y="9" width="10" height="10" rx="2" />
    <path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
  </svg>
);

export const SparklesIcon = ({ className = DEFAULT_ICON_CLASS }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" />
    <path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z" />
  </svg>
);

export const CollapseIcon = ({ className = DEFAULT_ICON_CLASS }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M7 10h10" />
    <path d="M7 14h10" />
    <path d="M7 6h10" />
    <path d="M7 18h10" />
    <path d="m10 8 2 2 2-2" />
    <path d="m10 16 2-2 2 2" />
  </svg>
);

export const ExpandIcon = ({ className = DEFAULT_ICON_CLASS }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M7 10h10" />
    <path d="M7 14h10" />
    <path d="M7 6h10" />
    <path d="M7 18h10" />
    <path d="m10 10 2-2 2 2" />
    <path d="m10 14 2 2 2-2" />
  </svg>
);

export const CompareIcon = ({ className = DEFAULT_ICON_CLASS }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M7 7h10" />
    <path d="m13 3 4 4-4 4" />
    <path d="M17 17H7" />
    <path d="m11 21-4-4 4-4" />
  </svg>
);

export const SunIcon = ({ className = DEFAULT_ICON_CLASS }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2.5" />
    <path d="M12 19.5V22" />
    <path d="m4.93 4.93 1.77 1.77" />
    <path d="m17.3 17.3 1.77 1.77" />
    <path d="M2 12h2.5" />
    <path d="M19.5 12H22" />
    <path d="m4.93 19.07 1.77-1.77" />
    <path d="m17.3 6.7 1.77-1.77" />
  </svg>
);

export const MoonIcon = ({ className = DEFAULT_ICON_CLASS }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
  </svg>
);
