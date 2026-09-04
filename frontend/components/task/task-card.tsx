/* eslint-disable react-hooks/refs */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '@/types';
import {
  IconArrowRight,
  IconDots,
  IconGrip,
  IconPencil,
  IconTrash,
} from '@/components/ui/icons';

interface TaskCardProps {
  task: Task;
  edit: () => void;
  move: () => void;
  remove: () => void;
}

export function TaskCard({ task, edit, move, remove }: TaskCardProps) {
  const sortable = useSortable({ id: task.id });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.35 : 1,
  };

  return (
    <article
      ref={sortable.setNodeRef}
      style={style}
      className={`task-card ${menuOpen ? 'menu-open' : ''} ${sortable.isDragging ? 'is-dragging' : ''}`}
    >
      <button
        type="button"
        className="drag-handle"
        aria-label={`Drag ${task.title}`}
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <IconGrip />
      </button>
      <div className="task-copy">
        <h4 title={task.title}>{task.title}</h4>
        {task.description && <p title={task.description}>{task.description}</p>}
      </div>
      <div className="task-actions" ref={menuRef}>
        <button
          type="button"
          className="task-menu-trigger"
          aria-label={`Actions for ${task.title}`}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <IconDots />
        </button>
        {menuOpen && (
          <div className="task-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                move();
              }}
            >
              <IconArrowRight /> Move to...
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                edit();
              }}
            >
              <IconPencil /> Edit
            </button>
            <button
              type="button"
              role="menuitem"
              className="menu-item-danger"
              onClick={() => {
                setMenuOpen(false);
                remove();
              }}
            >
              <IconTrash /> Delete
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
