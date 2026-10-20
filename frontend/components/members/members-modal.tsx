'use client';

import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Board, Notice } from '@/types';
import { api, ApiError } from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { IconPlus, IconTrash } from '@/components/ui/icons';
import { Modal } from '@/components/ui/modal';

interface MembersModalProps {
  board: Board;
  token: string;
  isOwner: boolean;
  onClose: () => void;
  notify: (notice: Notice) => void;
}

export function MembersModal({ board, token, isOwner, onClose, notify }: MembersModalProps) {
  const queryClient = useQueryClient();
  const members = board.members ?? [];
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['board', board.id] });

  async function handleAddMember(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setBusy('add');
    setError('');
    try {
      await api(`/boards/${board.id}/members`, token, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setEmail('');
      notify({ text: 'Member added' });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add member.');
    } finally {
      setBusy('');
    }
  }

  async function handleRemoveMember(userId: string) {
    setBusy(userId);
    setError('');
    try {
      await api(`/boards/${board.id}/members/${userId}`, token, { method: 'DELETE' });
      notify({ text: 'Member removed' });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove member.');
    } finally {
      setBusy('');
    }
  }

  return (
    <Modal title="Share board" description="People who can access this board." close={onClose}>
      {isOwner && (
        <form className="member-add" onSubmit={handleAddMember}>
          <label>
            Invite by email
            <input
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <Button busy={busy === 'add'}>
            <IconPlus /> Add
          </Button>
        </form>
      )}
      {error && (
        <p className="form-alert" role="alert">
          {error}
        </p>
      )}
      <div className="member-list">
        {members.map((member) => (
          <div className="member-row" key={member.id}>
            <Avatar user={member.user} />
            <div className="member-details">
              <strong>{member.user.name}</strong>
              <small>{member.user.email}</small>
            </div>
            <span className={`role-badge ${member.role === 'OWNER' ? 'role-owner' : 'role-member'}`}>
              {member.role === 'OWNER' ? 'Owner' : 'Member'}
            </span>
            {isOwner && member.role !== 'OWNER' && (
              <button
                type="button"
                className="member-remove-btn"
                title={`Remove ${member.user.name}`}
                aria-label={`Remove ${member.user.name}`}
                onClick={() => void handleRemoveMember(member.userId)}
                disabled={busy === member.userId}
              >
                <IconTrash />
              </button>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
