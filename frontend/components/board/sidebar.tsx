'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { BoardSummary, User } from '@/types';
import { IconBoards, IconPlus, IconSidebar } from '@/components/ui/icons';
import { ThemeToggle } from '@/components/ui/theme-toggle';

interface SidebarProps {
  user: User;
  boards: BoardSummary[];
  isLoadingBoards: boolean;
  isBoardsError: boolean;
  onRetryBoards: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onNavigate: () => void;
  onSignOut: () => void;
}

export function Sidebar({
  user,
  boards,
  isLoadingBoards,
  isBoardsError,
  onRetryBoards,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onNavigate,
  onSignOut,
}: SidebarProps) {
  const pathname = usePathname();
  const activeBoardId = pathname.startsWith('/boards/') ? pathname.split('/')[2] : null;
  const isAllBoards = pathname === '/boards';

  return (
    <aside
      className={`sidebar ${isCollapsed ? 'sidebar-collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
    >
      <div className="sidebar-top">
        <Link href="/boards" className="brand" title="Flowboard" onClick={onNavigate}>
          <Image src="/fb-icon.png" alt="Flowboard" width={30} height={30} />
          {!isCollapsed && <strong>Flowboard</strong>}
        </Link>
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

      <nav aria-label="Boards" className="sidebar-boards">
        <Link
          href="/boards"
          title="All boards"
          className={`board-link ${isAllBoards ? 'selected' : ''}`}
          aria-current={isAllBoards ? 'page' : undefined}
          onClick={onNavigate}
        >
          <span>
            <IconBoards />
          </span>
          <b>All boards</b>
        </Link>

        <div className="sidebar-label">
          {!isCollapsed && <>Your boards</>}
          {!isCollapsed && (
            <Link
              href="/boards?new=1"
              className="sidebar-add"
              title="New board"
              aria-label="New board"
              onClick={onNavigate}
            >
              <IconPlus />
            </Link>
          )}
        </div>

        {isLoadingBoards &&
          [0, 1, 2].map((item) => <div key={item} className="skeleton sidebar-skeleton" />)}

        {isBoardsError && (
          <>
            {!isCollapsed && <p className="error">We couldn&apos;t load your boards.</p>}
            <button type="button" className="text-button" onClick={onRetryBoards}>
              Try again
            </button>
          </>
        )}

        {boards.map((item) => (
          <Link
            href={`/boards/${item.id}`}
            title={item.name}
            className={`board-link ${activeBoardId === item.id ? 'selected' : ''}`}
            aria-current={activeBoardId === item.id ? 'page' : undefined}
            key={item.id}
            onClick={onNavigate}
          >
            <span>{item.name[0]?.toUpperCase()}</span>
            <b>{item.name}</b>
          </Link>
        ))}

        {!isLoadingBoards && !isBoardsError && boards.length === 0 && !isCollapsed && (
          <p className="muted">No boards yet.</p>
        )}
      </nav>

      <div className="sidebar-footer">
        <ThemeToggle />
        <button type="button" className="logout" title="Sign out" onClick={onSignOut}>
          {isCollapsed ? 'Exit' : 'Sign out'}
        </button>
      </div>
    </aside>
  );
}
