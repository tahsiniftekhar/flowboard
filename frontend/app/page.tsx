'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { Board, User } from '@/types';
import { api } from '@/lib/api';
import {
  SELECTED_BOARD_KEY,
  SESSION_EXPIRED_EVENT,
  SIDEBAR_COLLAPSED_KEY,
  TOKEN_KEY,
  USER_KEY,
} from '@/lib/constants';

import { AuthForm } from '@/components/auth/auth-form';
import { BoardView } from '@/components/board/board-view';
import { Sidebar } from '@/components/board/sidebar';
import { IconClose } from '@/components/ui/icons';

const emptySubscribe = () => () => {};

function useIsHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

function FlowboardApp() {
  const queryClient = useQueryClient();

  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  });

  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(USER_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
  });

  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(SELECTED_BOARD_KEY);
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  });

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);

  // Listen for session expiry from API responses
  useEffect(() => {
    const handleExpired = () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(SELECTED_BOARD_KEY);
      setToken(null);
      setUser(null);
      setIsSessionExpired(true);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, []);

  const boardsQuery = useQuery({
    queryKey: ['boards'],
    queryFn: () => api<Board[]>('/boards', token),
    enabled: Boolean(token),
  });

  const activeBoardQuery = useQuery({
    queryKey: ['board', selectedBoardId],
    queryFn: () => api<Board>(`/boards/${selectedBoardId}`, token),
    enabled: Boolean(token && selectedBoardId),
  });

  function handleAuthSuccess(nextToken: string, nextUser: User) {
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
    setIsSessionExpired(false);
  }

  function handleSignOut() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SELECTED_BOARD_KEY);
    setToken(null);
    setUser(null);
    setSelectedBoardId(null);
  }

  function handleSelectBoard(boardId: string) {
    setSelectedBoardId(boardId);
    localStorage.setItem(SELECTED_BOARD_KEY, boardId);
    setIsMobileOpen(false);
  }

  function handleToggleSidebar() {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }

  async function handleCreateBoard(name: string): Promise<boolean> {
    setIsCreatingBoard(true);
    try {
      await api('/boards', token, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      await queryClient.invalidateQueries({ queryKey: ['boards'] });
      return true;
    } catch {
      return false;
    } finally {
      setIsCreatingBoard(false);
    }
  }

  if (!token || !user) {
    return (
      <AuthForm
        message={isSessionExpired ? 'Your session has expired. Please sign in again.' : undefined}
        onAuth={handleAuthSuccess}
      />
    );
  }

  return (
    <main className="app-shell">
      <button
        type="button"
        className="mobile-menu"
        aria-label={isMobileOpen ? 'Close navigation' : 'Open navigation'}
        onClick={() => setIsMobileOpen((prev) => !prev)}
      >
        {isMobileOpen ? <IconClose /> : '☰'}
      </button>

      <Sidebar
        user={user}
        boards={boardsQuery.data ?? []}
        isLoadingBoards={boardsQuery.isLoading}
        isBoardsError={boardsQuery.isError}
        onRetryBoards={() => void boardsQuery.refetch()}
        selectedBoardId={selectedBoardId}
        onSelectBoard={handleSelectBoard}
        onCreateBoard={handleCreateBoard}
        isCreatingBoard={isCreatingBoard}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        isMobileOpen={isMobileOpen}
        onSignOut={handleSignOut}
      />

      <div className="main-content">
        {!selectedBoardId ? (
          <div className="welcome">
            <p className="eyebrow">YOUR WORKSPACE</p>
            <h1>
              Choose a board
              <br />
              to get moving.
            </h1>
            <p>Select a board from the sidebar, or create a new one to begin.</p>
          </div>
        ) : activeBoardQuery.isLoading ? (
          <div className="state-panel">Loading board...</div>
        ) : activeBoardQuery.isError ? (
          <div className="state-panel error">
            <p>We couldn&apos;t load this board.</p>
            <button type="button" className="text-button" onClick={() => void activeBoardQuery.refetch()}>
              Try again
            </button>
          </div>
        ) : activeBoardQuery.data ? (
          <BoardView
            board={activeBoardQuery.data}
            token={token}
            user={user}
            refresh={() => void queryClient.invalidateQueries({ queryKey: ['board', selectedBoardId] })}
          />
        ) : null}
      </div>
    </main>
  );
}

export default function Home() {
  const isHydrated = useIsHydrated();

  if (!isHydrated) {
    return (
      <main className="app-shell-loading">
        <div className="brand splash-brand">
          <span>FB</span>
          <strong>Flowboard</strong>
        </div>
      </main>
    );
  }

  return <FlowboardApp />;
}
