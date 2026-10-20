export interface User {
  id: string;
  email: string;
  name: string;
}

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  dueDate?: string | null;
  assigneeId?: string | null;
  assignee?: User | null;
  position: number;
  columnId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Column {
  id: string;
  name: string;
  position: number;
  boardId?: string;
  tasks: Task[];
  createdAt?: string;
  updatedAt?: string;
}

export type BoardRole = 'OWNER' | 'MEMBER';

export interface Member {
  id: string;
  userId: string;
  boardId?: string;
  role: string;
  user: User;
  createdAt?: string;
}

export interface Board {
  id: string;
  name: string;
  ownerId: string;
  owner?: { id: string; name: string };
  columns?: Column[];
  members?: Member[];
  createdAt?: string;
  updatedAt?: string;
}

export interface BoardSummary extends Board {
  role: BoardRole;
  memberCount: number;
  columnCount: number;
  taskCount: number;
  owner: { id: string; name: string };
}

export interface Notice {
  text: string;
  error?: boolean;
}
