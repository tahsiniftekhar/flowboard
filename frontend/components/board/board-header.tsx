'use client';

import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import type { Board, Notice } from '@/types';
import { api, ApiError } from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';
import { IconChevronRight, IconLogOut, IconPencil, IconShare, IconTrash } from '@/components/ui/icons';
import { Menu } from '@/components/ui/menu';
import { ConfirmModal } from '@/components/ui/modal';

interface BoardHeaderProps {
  board: Board;
  token: string;
  userId: string;
  isOwner: boolean;
  taskCount: number;
  notify: (notice: Notice) => void;
  onOpenMembers: () => void;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
const MAX_FACES = 4;

export function BoardHeader({
  board,
  token,
  userId,
  isOwner,
  taskCount,
  notify,
  onOpenMembers,
}: BoardHeaderProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const members = board.members ?? [];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(board.name);
  const [confirm, setConfirm] = useState<'delete' | 'leave' | null>(null);
  const [busy, setBusy] = useState(false);

  // Enter, Escape and blur can all end an edit; only the first one counts.
  const finishedRef = useRef(false);

  function startEditing() {
    finishedRef.current = false;
    setDraft(board.name);
    setEditing(true);
  }

  async function submitRename(event?: FormEvent) {
    event?.preventDefault();
    if (finishedRef.current) return;
    finishedRef.current = true;
    const name = draft.trim();
    setEditing(false);
    if (!name || name === board.name) return;
    try {
      await api(`/boards/${board.id}`, token, { method: 'PATCH', body: JSON.stringify({ name }) });
      notify({ text: 'Board renamed' });
      void queryClient.invalidateQueries({ queryKey: ['board', board.id] });
      void queryClient.invalidateQueries({ queryKey: ['boards'] });
    } catch (err) {
      notify({ text: err instanceof ApiError ? err.message : 'Could not rename the board.', error: true });
    }
  }

  async function leaveOrDelete() {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm === 'delete') {
        await api(`/boards/${board.id}`, token, { method: 'DELETE' });
      } else {
        await api(`/boards/${board.id}/members/${userId}`, token, { method: 'DELETE' });
      }
      await queryClient.invalidateQueries({ queryKey: ['boards'] });
      router.push('/boards');
    } catch (err) {
      notify({ text: err instanceof ApiError ? err.message : 'Could not complete that action.', error: true });
      setBusy(false);
      setConfirm(null);
    }
  }

  return (
    <header className="board-header">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/boards">Boards</Link>
        <IconChevronRight />
        <span aria-current="page">{board.name}</span>
      </nav>

      <div className="board-header-row">
        <div className="board-heading">
          {editing ? (
            <form onSubmit={submitRename}>
              <input
                autoFocus
                value={draft}
                maxLength={100}
                onChange={(event) => setDraft(event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                onBlur={() => void submitRename()}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    finishedRef.current = true;
                    setEditing(false);
                  }
                }}
                aria-label="Board name"
                className="board-title-input"
              />
            </form>
          ) : isOwner ? (
            <button
              type="button"
              className="board-title-button"
              title="Click to rename board"
              onClick={startEditing}
            >
              <h1>{board.name}</h1>
              <IconPencil className="title-edit-hint" />
            </button>
          ) : (
            <h1 className="board-title">{board.name}</h1>
          )}
          <p className="board-meta">
            <span>{plural(taskCount, 'task')}</span>
            <span aria-hidden="true">·</span>
            <span>{plural(board.columns?.length ?? 0, 'column')}</span>
            <span className={`role-badge ${isOwner ? 'role-owner' : 'role-member'}`}>
              {isOwner ? 'Owner' : 'Member'}
            </span>
          </p>
        </div>

        <div className="board-actions">
          <button
            type="button"
            className="facepile"
            onClick={onOpenMembers}
            aria-label={`View ${plural(members.length, 'member')}`}
          >
            {members.slice(0, MAX_FACES).map((member) => (
              <Avatar key={member.id} user={member.user} size="sm" className="facepile-avatar" />
            ))}
            {members.length > MAX_FACES && (
              <span className="user-avatar avatar-sm facepile-avatar facepile-more">
                +{members.length - MAX_FACES}
              </span>
            )}
          </button>
          <button type="button" className="secondary-button share-button" onClick={onOpenMembers}>
            <IconShare /> Share
          </button>
          <Menu
            label="Board actions"
            triggerClassName="menu-trigger board-menu-trigger"
            items={[
              { label: 'Rename board', icon: <IconPencil />, hidden: !isOwner, onSelect: startEditing },
              {
                label: 'Delete board',
                icon: <IconTrash />,
                danger: true,
                hidden: !isOwner,
                onSelect: () => setConfirm('delete'),
              },
              {
                label: 'Leave board',
                icon: <IconLogOut />,
                danger: true,
                hidden: isOwner,
                onSelect: () => setConfirm('leave'),
              },
            ]}
          />
        </div>
      </div>

      {confirm && (
        <ConfirmModal
          title={confirm === 'delete' ? `Delete “${board.name}”?` : `Leave “${board.name}”?`}
          description={
            confirm === 'delete'
              ? 'The board, its columns and all its tasks will be permanently removed for everyone.'
              : 'You will lose access to this board and your tasks on it will be unassigned.'
          }
          confirmLabel={confirm === 'delete' ? 'Delete board' : 'Leave board'}
          busyLabel={confirm === 'delete' ? 'Deleting...' : 'Leaving...'}
          busy={busy}
          onConfirm={() => void leaveOrDelete()}
          onCancel={() => setConfirm(null)}
        />
      )}
    </header>
  );
}
