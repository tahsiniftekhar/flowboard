'use client';

import { useState, type FormEvent } from 'react';
import type { Board, Member } from '@/types';
import { IconPencil, IconUsers } from '@/components/ui/icons';

interface BoardHeaderProps {
  board: Board;
  isOwner: boolean;
  members: Member[];
  onRenameBoard: (name: string) => Promise<void>;
  onOpenMembers: () => void;
}

export function BoardHeader({
  board,
  isOwner,
  members,
  onRenameBoard,
  onOpenMembers,
}: BoardHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(board.name);

  async function handleTitleSubmit(event?: FormEvent) {
    if (event) event.preventDefault();
    if (!titleDraft.trim() || titleDraft.trim() === board.name) {
      setTitleDraft(board.name);
      setIsEditingTitle(false);
      return;
    }
    await onRenameBoard(titleDraft.trim());
    setIsEditingTitle(false);
  }

  return (
    <header className="board-header">
      <div>
        <p className="eyebrow">WORKSPACE / BOARDS / {board.name.toUpperCase()}</p>
        <div className="title-row">
          {isOwner ? (
            isEditingTitle ? (
              <form className="inline-title-form" onSubmit={handleTitleSubmit}>
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onBlur={() => void handleTitleSubmit()}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setTitleDraft(board.name);
                      setIsEditingTitle(false);
                    }
                  }}
                  aria-label="Board name"
                  className="inline-title-input"
                />
              </form>
            ) : (
              <button
                type="button"
                className="board-title-button"
                title="Click to rename board"
                onClick={() => {
                  setTitleDraft(board.name);
                  setIsEditingTitle(true);
                }}
              >
                <h2>{board.name}</h2>
                <span className="title-edit-hint" aria-hidden="true">
                  <IconPencil />
                </span>
              </button>
            )
          ) : (
            <h2>{board.name}</h2>
          )}
        </div>
      </div>
      <button
        type="button"
        className="secondary-button member-button"
        onClick={onOpenMembers}
      >
        <span className="facepile" aria-hidden="true">
          {members.slice(0, 3).map((member) => (
            <span className="avatar facepile-avatar" key={member.id}>
              {member.user.name[0]?.toUpperCase()}
            </span>
          ))}
        </span>
        <IconUsers />
        Members{members.length > 0 ? ` (${members.length})` : ''}
      </button>
    </header>
  );
}
