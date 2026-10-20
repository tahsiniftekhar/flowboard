'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import type { Board, BoardSummary } from '@/types';

import { Button } from '@/components/ui/button';
import { IconPlus } from '@/components/ui/icons';
import { Modal } from '@/components/ui/modal';

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function BoardCard({ board }: { board: BoardSummary }) {
  const isOwner = board.role === 'OWNER';
  return (
    <Link href={`/boards/${board.id}`} className="board-card">
      <div className="board-card-top">
        <div>
          <h3>{board.name}</h3>
          <p className="board-card-owner">{isOwner ? 'You' : board.owner.name}</p>
        </div>
        <span className={`role-badge ${isOwner ? 'role-owner' : 'role-member'}`}>
          {isOwner ? 'Owner' : 'Member'}
        </span>
      </div>
      <div className="board-card-stats">
        <span>{plural(board.columnCount, 'column')}</span>
        <span>{plural(board.taskCount, 'task')}</span>
        <span>{plural(board.memberCount, 'member')}</span>
      </div>
      {board.updatedAt && (
        <span className="board-card-updated">Updated {timeAgo(board.updatedAt)}</span>
      )}
    </Link>
  );
}

function CreateBoardModal({ close }: { close: () => void }) {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const createBoard = useMutation({
    mutationFn: (boardName: string) =>
      api<Board>('/boards', token, { method: 'POST', body: JSON.stringify({ name: boardName }) }),
    onSuccess: async (board) => {
      await queryClient.invalidateQueries({ queryKey: ['boards'] });
      router.push(`/boards/${board.id}`);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'Could not create board. Try again.'),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError('Give your board a name.');
    setError('');
    createBoard.mutate(trimmed);
  }

  return (
    <Modal title="New board" description="Boards hold your columns and tasks." close={close}>
      <form className="create-form" onSubmit={handleSubmit} noValidate>
        <label>
          Board name
          <input
            autoFocus
            value={name}
            maxLength={80}
            placeholder="e.g. Product launch"
            aria-invalid={Boolean(error)}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={close}>
            Cancel
          </button>
          <Button busy={createBoard.isPending || createBoard.isSuccess}>Create board</Button>
        </div>
      </form>
    </Modal>
  );
}

export function Dashboard() {
  const { user, token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const showCreate = isCreateOpen || searchParams.get('new') === '1';

  const boardsQuery = useQuery({
    queryKey: ['boards'],
    queryFn: () => api<BoardSummary[]>('/boards', token),
    enabled: Boolean(token),
  });

  function closeCreate() {
    setIsCreateOpen(false);
    if (searchParams.get('new')) router.replace('/boards');
  }

  const boards = boardsQuery.data ?? [];
  const firstName = user?.name.split(' ')[0] ?? '';
  const totalTasks = boards.reduce((sum, board) => sum + board.taskCount, 0);
  const sharedCount = boards.filter((board) => board.role === 'MEMBER').length;

  return (
    <div className="dash">
      <div className="dash-header">
        <div>
          <p className="eyebrow">YOUR WORKSPACE</p>
          <h1>Hello, {firstName}</h1>
          <p>Pick up where you left off, or start something new.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} type="button">
          <IconPlus /> New board
        </Button>
      </div>

      {boardsQuery.isPending ? (
        <div aria-busy="true" aria-label="Loading boards">
          <div className="dash-stats">
            {[0, 1, 2].map((item) => (
              <div key={item} className="skeleton" style={{ height: 82 }} />
            ))}
          </div>
          <div className="board-grid">
            {[0, 1, 2].map((item) => (
              <div key={item} className="skeleton board-card-skeleton" />
            ))}
          </div>
        </div>
      ) : boardsQuery.isError ? (
        <div className="state-card">
          <h2>We couldn&apos;t load your boards</h2>
          <p>Check your connection and try again.</p>
          <button type="button" className="button" onClick={() => void boardsQuery.refetch()}>
            Try again
          </button>
        </div>
      ) : boards.length === 0 ? (
        <div className="dash-empty">
          <div className="empty-illustration" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <h2>Create your first board</h2>
          <p>
            A board is a shared workspace with columns and tasks. Create one to start tracking
            work, then invite teammates.
          </p>
          <Button type="button" onClick={() => setIsCreateOpen(true)}>
            <IconPlus /> New board
          </Button>
        </div>
      ) : (
        <>
          <div className="dash-stats">
            <div className="dash-stat">
              <strong>{boards.length}</strong>
              <span>{boards.length === 1 ? 'Board' : 'Boards'}</span>
            </div>
            <div className="dash-stat">
              <strong>{totalTasks}</strong>
              <span>{totalTasks === 1 ? 'Task' : 'Tasks'} across boards</span>
            </div>
            <div className="dash-stat">
              <strong>{sharedCount}</strong>
              <span>Shared with you</span>
            </div>
          </div>

          <h2 className="dash-section-title">Your boards</h2>
          <div className="board-grid">
            {boards.map((board) => (
              <BoardCard key={board.id} board={board} />
            ))}
            <button type="button" className="board-card board-card-new" onClick={() => setIsCreateOpen(true)}>
              <IconPlus /> New board
            </button>
          </div>
        </>
      )}

      {showCreate && <CreateBoardModal close={closeCreate} />}
    </div>
  );
}
