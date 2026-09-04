export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
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
  columns?: Column[];
  members?: Member[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Notice {
  text: string;
  error?: boolean;
}
