'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { Notice } from '@/types';
import { api, ApiError } from '@/lib/api';

interface UseBoardActionsOptions {
  boardId: string;
  token: string;
  notify: (notice: Notice) => void;
}

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Could not complete that action. Try again.';

// Column and task mutations that are simple request + refetch. Each returns
// whether it succeeded so callers can close or reset their UI.
export function useBoardActions({ boardId, token, notify }: UseBoardActionsOptions) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState('');

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['board', boardId] });

  async function run(key: string, work: () => Promise<unknown>, success?: string) {
    setBusy(key);
    try {
      await work();
      if (success) notify({ text: success });
      void refresh();
      return true;
    } catch (err) {
      notify({ text: errorText(err), error: true });
      void refresh();
      return false;
    } finally {
      setBusy('');
    }
  }

  const send = (path: string, method: string, body?: unknown) =>
    api(path, token, { method, body: body === undefined ? undefined : JSON.stringify(body) });

  return {
    busy,
    refresh,
    addTask: (columnId: string, title: string) =>
      run('add-task', () => send(`/columns/${columnId}/tasks`, 'POST', { title })),
    deleteTask: (taskId: string) =>
      run('delete-task', () => send(`/tasks/${taskId}`, 'DELETE'), 'Task deleted'),
    addColumn: (name: string) =>
      run('add-column', () => send(`/boards/${boardId}/columns`, 'POST', { name }), 'Column added'),
    addColumns: (names: string[]) =>
      run(
        'add-column',
        async () => {
          for (const name of names) await send(`/boards/${boardId}/columns`, 'POST', { name });
        },
        'Columns added',
      ),
    renameColumn: (columnId: string, name: string) =>
      run('rename-column', () => send(`/columns/${columnId}`, 'PATCH', { name }), 'Column renamed'),
    deleteColumn: (columnId: string) =>
      run('delete-column', () => send(`/columns/${columnId}`, 'DELETE'), 'Column deleted'),
  };
}
