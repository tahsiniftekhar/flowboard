'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';

import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Board } from '@/types';

import { BoardView } from '@/components/board/board-view';

// 400 covers a malformed id (the API validates UUIDs); 403/404 are no access / missing.
const isMissing = (error: unknown) =>
  error instanceof ApiError && [400, 403, 404].includes(error.status);

function BoardSkeleton() {
  return (
    <div className="board-skeleton" aria-busy="true" aria-label="Loading board">
      <div className="skeleton" style={{ width: 280, height: 38 }} />
      <div className="board-skeleton-cols">
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    </div>
  );
}

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const { token, user } = useAuth();

  const boardQuery = useQuery({
    queryKey: ['board', boardId],
    queryFn: () => api<Board>(`/boards/${boardId}`, token),
    enabled: Boolean(token && boardId),
    retry: (count, error) => !isMissing(error) && count < 2,
  });

  const boardName = boardQuery.data?.name;
  useEffect(() => {
    document.title = boardName ? `${boardName} · Flowboard` : 'Flowboard';
  }, [boardName]);

  if (boardQuery.isPending) return <BoardSkeleton />;

  if (boardQuery.isError) {
    if (isMissing(boardQuery.error)) {
      return (
        <div className="state-card">
          <h2>Board not found</h2>
          <p>This board doesn&apos;t exist, or you don&apos;t have access to it.</p>
          <Link href="/boards" className="button link-button">
            Back to all boards
          </Link>
        </div>
      );
    }
    return (
      <div className="state-card">
        <h2>We couldn&apos;t load this board</h2>
        <p>Something went wrong while contacting the server.</p>
        <button type="button" className="button" onClick={() => void boardQuery.refetch()}>
          Try again
        </button>
      </div>
    );
  }

  if (!token || !user) return null;

  return (
    <BoardView board={boardQuery.data} token={token} user={user} />
  );
}
