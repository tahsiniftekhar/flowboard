import type { ReactNode } from 'react';

interface StatusProps {
  children: ReactNode;
  error?: boolean;
}

export function Status({ children, error = false }: StatusProps) {
  return (
    <p
      className={`status ${error ? 'status-error' : 'status-success'}`}
      role={error ? 'alert' : 'status'}
      aria-live="polite"
    >
      {children}
    </p>
  );
}
