'use client';

import { useState, type FormEvent } from 'react';
import type { Board, Member, Notice } from '@/types';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { IconPlus, IconTrash } from '@/components/ui/icons';
import { Modal } from '@/components/ui/modal';

interface MembersModalProps {
  board: Board;
  members: Member[];
  isLoading: boolean;
  token: string;
  isOwner: boolean;
  isOpen: boolean;
  onClose: () => void;
  onMembersUpdated: () => void;
  setNotice: (notice: Notice) => void;
}

export function MembersModal({
  board,
  members,
  isLoading,
  token,
  isOwner,
  isOpen,
  onClose,
  onMembersUpdated,
  setNotice,
}: MembersModalProps) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState('');

  if (!isOpen) return null;

  async function handleAddMember(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setBusy('add');
    try {
      await api(`/boards/${board.id}/members`, token, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setEmail('');
      setNotice({ text: 'Member added' });
      onMembersUpdated();
    } catch (err) {
      setNotice({
        text: err instanceof ApiError ? err.message : 'Could not add member.',
        error: true,
      });
    } finally {
      setBusy('');
    }
  }

  async function handleRemoveMember(userId: string) {
    setBusy(userId);
    try {
      await api(`/boards/${board.id}/members/${userId}`, token, { method: 'DELETE' });
      setNotice({ text: 'Member removed' });
      onMembersUpdated();
    } catch {
      setNotice({ text: 'Could not remove member.', error: true });
    } finally {
      setBusy('');
    }
  }

  return (
    <Modal
      title="Board members"
      description="People who can access this board."
      close={onClose}
    >
      <div className="member-list">
        {isLoading ? (
          <div className="members-loading">Loading members...</div>
        ) : members.length > 0 ? (
          members.map((member) => (
            <div className="member-row" key={member.id}>
              <span className="avatar">{member.user.name[0]?.toUpperCase()}</span>
              <div className="member-details">
                <strong>{member.user.name}</strong>
                <small>{member.user.email}</small>
              </div>
              <span
                className={`member-role ${member.role === 'OWNER' ? 'role-owner' : 'role-member'}`}
              >
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
          ))
        ) : (
          <p className="muted">No members found.</p>
        )}
      </div>
      {isOwner && (
        <form className="member-add" onSubmit={handleAddMember}>
          <label>
            Add member by email
            <input
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <Button busy={busy === 'add'}>
            <IconPlus /> Add member
          </Button>
        </form>
      )}
    </Modal>
  );
}
