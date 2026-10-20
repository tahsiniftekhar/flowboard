'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconDots } from './icons';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  hidden?: boolean;
  onSelect: () => void;
}

interface MenuProps {
  label: string;
  items: MenuItem[];
  triggerClassName?: string;
  children?: ReactNode;
}

interface Position {
  top?: number;
  bottom?: number;
  right: number;
}

const ITEM_HEIGHT = 34;

// Rendered in a portal with fixed positioning so scroll containers and
// transformed (dragging) ancestors can never clip or misplace it.
export function Menu({ label, items, triggerClassName = 'menu-trigger', children }: MenuProps) {
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const visible = items.filter((item) => !item.hidden);

  const close = useCallback((restoreFocus = false) => {
    setPosition(null);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  function toggle() {
    if (position) return close();
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const height = visible.length * ITEM_HEIGHT + 12;
    const right = Math.max(8, window.innerWidth - rect.right);
    if (rect.bottom + height + 8 > window.innerHeight && rect.top > height) {
      setPosition({ bottom: window.innerHeight - rect.top + 4, right });
    } else {
      setPosition({ top: rect.bottom + 4, right });
    }
  }

  const isOpen = position !== null;
  useEffect(() => {
    if (!isOpen) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close(true);
      }
    };
    const onDismiss = () => close();
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', onDismiss);
    window.addEventListener('scroll', onDismiss, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', onDismiss);
      window.removeEventListener('scroll', onDismiss, true);
    };
  }, [isOpen, close]);

  function onMenuKeyDown(event: React.KeyboardEvent) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    nodes[(index + step + nodes.length) % nodes.length]?.focus();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={toggle}
      >
        {children ?? <IconDots />}
      </button>
      {position &&
        createPortal(
          <div
            ref={menuRef}
            className="menu-popover"
            role="menu"
            aria-label={label}
            style={position}
            onKeyDown={onMenuKeyDown}
          >
            {visible.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={item.danger ? 'menu-item menu-item-danger' : 'menu-item'}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
