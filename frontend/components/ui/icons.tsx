interface IconProps {
  className?: string;
}

export function IconGrip({ className = '' }: IconProps) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="3.5" r="1.5" />
      <circle cx="11" cy="3.5" r="1.5" />
      <circle cx="5" cy="8" r="1.5" />
      <circle cx="11" cy="8" r="1.5" />
      <circle cx="5" cy="12.5" r="1.5" />
      <circle cx="11" cy="12.5" r="1.5" />
    </svg>
  );
}

export function IconDots({ className = '' }: IconProps) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="8" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="13" cy="8" r="1.5" />
    </svg>
  );
}

export function IconPencil({ className = '' }: IconProps) {
  return (
    <svg
      className={className}
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H2.5v-2.5l8.5-8.5z" />
      <path d="M10 4l2 2" />
    </svg>
  );
}

export function IconTrash({ className = '' }: IconProps) {
  return (
    <svg
      className={className}
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 4h11" />
      <path d="M5.5 4V2.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V4" />
      <path d="M3.5 4l.8 9.5a1.5 1.5 0 0 0 1.5 1.4h4.4a1.5 1.5 0 0 0 1.5-1.4l.8-9.5" />
    </svg>
  );
}

export function IconArrowRight({ className = '' }: IconProps) {
  return (
    <svg
      className={className}
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8h10" />
      <path d="M9 4l4 4-4 4" />
    </svg>
  );
}

export function IconPlus({ className = '' }: IconProps) {
  return (
    <svg
      className={className}
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 2.5v11" />
      <path d="M2.5 8h11" />
    </svg>
  );
}

export function IconUsers({ className = '' }: IconProps) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 14v-1.5a2.5 2.5 0 0 0-2.5-2.5h-3A2.5 2.5 0 0 0 3 12.5V14" />
      <circle cx="7" cy="5" r="2.5" />
      <path d="M14 14v-1a2 2 0 0 0-1.5-1.9" />
      <path d="M11 3.2a2.5 2.5 0 0 1 0 4.6" />
    </svg>
  );
}

export function IconClose({ className = '' }: IconProps) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3l10 10" />
      <path d="M13 3L3 13" />
    </svg>
  );
}

export function IconSidebar({ className = '' }: IconProps) {
  return (
    <svg
      className={className}
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2.5" width="12" height="11" rx="2" />
      <path d="M6.5 2.5v11" />
    </svg>
  );
}

function StrokeIcon({ className = '', children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconSun({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <circle cx="8" cy="8" r="2.8" />
      <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
    </StrokeIcon>
  );
}

export function IconMoon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z" />
    </StrokeIcon>
  );
}

export function IconMonitor({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <rect x="2" y="2.5" width="12" height="8" rx="1.5" />
      <path d="M5.5 13.5h5M8 10.5v3" />
    </StrokeIcon>
  );
}

export function IconBoards({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <rect x="2" y="2.5" width="3.5" height="11" rx="1" />
      <rect x="6.5" y="2.5" width="3.5" height="7" rx="1" />
      <rect x="11" y="2.5" width="3" height="9" rx="1" />
    </StrokeIcon>
  );
}

export function IconMenu({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
    </StrokeIcon>
  );
}

export function IconSearch({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </StrokeIcon>
  );
}

export function IconCalendar({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.8" />
      <path d="M2.5 6.8h11M5.5 2v3M10.5 2v3" />
    </StrokeIcon>
  );
}

export function IconText({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M2.5 4h11M2.5 8h11M2.5 12h7" />
    </StrokeIcon>
  );
}

export function IconCheck({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M3 8.5l3.2 3.2L13 4.8" />
    </StrokeIcon>
  );
}

export function IconAlert({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3.4M8 10.8v.1" />
    </StrokeIcon>
  );
}

export function IconShare({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <circle cx="6" cy="5.5" r="2.3" />
      <path d="M1.8 13.2a4.2 4.2 0 0 1 8.4 0" />
      <path d="M12.5 4v4M10.5 6h4" />
    </StrokeIcon>
  );
}

export function IconLogOut({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M6.5 2.5h-3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3" />
      <path d="M10 5l3 3-3 3M13 8H6" />
    </StrokeIcon>
  );
}

export function IconChevronRight({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M6 3.5L10.5 8 6 12.5" />
    </StrokeIcon>
  );
}
