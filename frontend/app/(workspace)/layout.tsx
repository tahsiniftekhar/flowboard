'use client';

import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { SIDEBAR_COLLAPSED_KEY } from '@/lib/constants';
import type { BoardSummary } from '@/types';

import { Sidebar } from '@/components/board/sidebar';
import { IconClose, IconMenu } from '@/components/ui/icons';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { user, token, isReady, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const signingOut = useRef(false);

  // Safe to read storage in the initializer: the shell only renders once hydrated.
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (isReady && !user) {
      const next = signingOut.current ? '' : `?next=${encodeURIComponent(pathname)}`;
      router.replace(`/login${next}`);
    }
  }, [isReady, user, pathname, router]);

  const boardsQuery = useQuery({
    queryKey: ['boards'],
    queryFn: () => api<BoardSummary[]>('/boards', token),
    enabled: Boolean(token),
  });

  function handleToggleSidebar() {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }

  function handleSignOut() {
    signingOut.current = true;
    signOut();
  }

  if (!isReady || !user) {
    return (
      <div className="splash">
        <div className="brand splash-brand">
          <Image src="/fb-icon.png" alt="Flowboard" width={30} height={30} />
          <strong>Flowboard</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="mobile-topbar">
        <Link href="/boards" className="brand">
          <Image src="/fb-icon.png" alt="Flowboard" width={30} height={30} />
          <strong>Flowboard</strong>
        </Link>
        <button
          type="button"
          className="mobile-topbar-btn"
          aria-label={isMobileOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={isMobileOpen}
          onClick={() => setIsMobileOpen((prev) => !prev)}
        >
          {isMobileOpen ? <IconClose /> : <IconMenu />}
        </button>
      </header>

      <Sidebar
        user={user}
        boards={boardsQuery.data ?? []}
        isLoadingBoards={boardsQuery.isLoading}
        isBoardsError={boardsQuery.isError}
        onRetryBoards={() => void boardsQuery.refetch()}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        isMobileOpen={isMobileOpen}
        onNavigate={() => setIsMobileOpen(false)}
        onSignOut={handleSignOut}
      />

      <main className="main-content">{children}</main>
    </div>
  );
}
