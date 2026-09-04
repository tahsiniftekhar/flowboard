import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  busy?: boolean;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function Button({
  busy = false,
  children,
  variant = 'primary',
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  const baseClass =
    variant === 'secondary'
      ? 'secondary-button'
      : variant === 'danger'
        ? 'button danger'
        : 'button';

  return (
    <button
      className={`${baseClass} ${className}`.trim()}
      disabled={busy || disabled}
      {...rest}
    >
      {busy ? 'Working...' : children}
    </button>
  );
}
