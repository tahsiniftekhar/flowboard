import type { User } from '@/types';
import { avatarTone, initials } from '@/lib/task-utils';

interface AvatarProps {
  user: Pick<User, 'id' | 'name'>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({ user, size = 'md', className = '' }: AvatarProps) {
  return (
    <span
      className={`user-avatar avatar-${size} tone-${avatarTone(user.id)} ${className}`.trim()}
      title={user.name}
      role="img"
      aria-label={user.name}
    >
      {initials(user.name)}
    </span>
  );
}
