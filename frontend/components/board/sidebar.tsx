'use client';

import { useState, type FormEvent } from 'react';
import type { Board, User } from '@/types';
import { Button } from '@/components/ui/button';
import { IconPlus, IconSidebar } from '@/components/ui/icons';
import { Status } from '@/components/ui/status';

interface SidebarProps {
  user: User;
  boards: Board[];
  isLoadingBoards: boolean;
  isBoardsError: boolean;
  onRetryBoards: () => void;
  selectedBoardId: string | null;
  onSelectBoard: (boardId: string) => void;
  onCreateBoard: (name: string) => Promise<boolean>;
  isCreatingBoard: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onSignOut: () => void;
}

export function Sidebar({
  user,
  boards,
  isLoadingBoards,
  isBoardsError,
  onRetryBoards,
  selectedBoardId,
  onSelectBoard,
  onCreateBoard,
  isCreatingBoard,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onSignOut,
}: SidebarProps) {
  const [newBoardName, setNewBoardName] = useState('');
  const [notice, setNotice] = useState('');

  async function handleCreateBoard(event: FormEvent) {
    event.preventDefault();
    if (!newBoardName.trim()) return;
    setNotice('');
    const success = await onCreateBoard(newBoardName.trim());
    if (success) {
      setNewBoardName('');
      setNotice('Board created');
    } else {
      setNotice('Could not create board. Try again.');
    }
  }

  return (
    <aside className={`sidebar ${isCollapsed ? 'sidebar-collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-top">
        <div className="brand" title="Flowboard">
          <span>FB</span>
          {!isCollapsed && <strong>Flowboard</strong>}
        </div>
        <button
          type="button"
          className="sidebar-toggle-btn"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggleCollapse}
        >
          <IconSidebar />
        </button>
      </div>

      <div className="profile" title={isCollapsed ? `${user.name} (${user.email})` : undefined}>
        <span className="avatar">{user.name[0]?.toUpperCase()}</span>
        {!isCollapsed && (
          <div>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
        )}
      </div>

      {!isCollapsed && <div className="sidebar-label">Your boards</div>}

      {isLoadingBoards && <p className="muted">{isCollapsed ? '...' : 'Loading boards...'}</p>}

      {isBoardsError && (
        <>
          {!isCollapsed && <p className="error">We couldn&apos;t load your boards.</p>}
          <button type="button" className="text-button" onClick={onRetryBoards}>
            Try again
          </button>
        </>
      )}

      {boards.map((item) => (
        <button
          type="button"
          title={item.name}
          className={`board-link ${selectedBoardId === item.id ? 'selected' : ''}`}
          key={item.id}
          onClick={() => onSelectBoard(item.id)}
        >
          <span>{item.name[0]?.toUpperCase()}</span>
          <b>{item.name}</b>
        </button>
      ))}

      {boards.length === 0 && !isCollapsed && <p className="muted">No boards yet.</p>}

      {!isCollapsed && (
        <form className="new-board" onSubmit={handleCreateBoard}>
          <input
            aria-label="Board name"
            value={newBoardName}
            onChange={(event) => setNewBoardName(event.target.value)}
            placeholder="Board name"
          />
          <Button busy={isCreatingBoard}>
            <IconPlus /> Create board
          </Button>
        </form>
      )}

      {notice && !isCollapsed && <Status error={notice.startsWith('Could')}>{notice}</Status>}

      <button type="button" className="logout" title="Sign out" onClick={onSignOut}>
        {isCollapsed ? 'Exit' : 'Sign out'}
      </button>
    </aside>
  );
}
