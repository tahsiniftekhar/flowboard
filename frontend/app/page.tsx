'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
type User = { id: string; email: string; name: string };
type Task = {
  id: string;
  title: string;
  description?: string | null;
  position: number;
  columnId: string;
};
type Column = { id: string; name: string; position: number; tasks: Task[] };
type Board = { id: string; name: string; ownerId: string; columns?: Column[] };

async function api<T>(path: string, token: string | null, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message ?? 'Request failed');
  return body as T;
}
function Button({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={`button ${props.className ?? ''}`}>
      {children}
    </button>
  );
}

function Auth({ onAuth }: { onAuth: (token: string, user: User) => void }) {
  const [register, setRegister] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.email || !form.password || (register && !form.name))
      return setError('Complete all required fields.');
    if (register && form.password.length < 8)
      return setError('Password must be at least 8 characters.');
    setBusy(true);
    setError('');
    try {
      const result = await api<{ accessToken: string; user: User }>(
        `/auth/${register ? 'register' : 'login'}`,
        null,
        { method: 'POST', body: JSON.stringify(form) }
      );
      onAuth(result.accessToken, result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to continue');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <div className="auth-copy">
        <p className="eyebrow">FLOWBOARD / WORKSPACE</p>
        <h1>Make progress visible.</h1>
        <p>One calm place for the work your team is carrying.</p>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-tabs">
          <button
            type="button"
            className={!register ? 'active' : ''}
            onClick={() => setRegister(false)}
          >
            Log in
          </button>
          <button
            type="button"
            className={register ? 'active' : ''}
            onClick={() => setRegister(true)}
          >
            Register
          </button>
        </div>
        <h2>{register ? 'Start a workspace' : 'Welcome back'}</h2>
        {register && (
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Your name"
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@company.com"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="At least 8 characters"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <Button disabled={busy}>
          {busy ? 'Working...' : register ? 'Create account' : 'Enter workspace'}
        </Button>
      </form>
    </main>
  );
}

function TaskCard({
  task,
  setEdit,
  remove,
}: {
  task: Task;
  setEdit: () => void;
  remove: () => void;
}) {
  return (
    <article
      className="task-card"
      draggable
      onDragStart={(event) => event.dataTransfer.setData('taskId', task.id)}
    >
      <div>
        <h4>{task.title}</h4>
        {task.description && <p>{task.description}</p>}
      </div>
      <div className="task-actions">
        <button onClick={setEdit}>Edit</button>
        <button onClick={remove}>×</button>
      </div>
    </article>
  );
}

function BoardView({
  board,
  token,
  refresh,
}: {
  board: Board;
  token: string;
  refresh: () => void;
}) {
  const [column, setColumn] = useState('');
  const [newTask, setNewTask] = useState<{ columnId: string; title: string } | null>(null);
  const [edit, setEdit] = useState<Task | null>(null);
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const columns = board.columns ?? [];
  async function addColumn(e: FormEvent) {
    e.preventDefault();
    if (!column.trim()) return;
    await api(`/boards/${board.id}/columns`, token, {
      method: 'POST',
      body: JSON.stringify({ name: column }),
    });
    setColumn('');
    refresh();
  }
  async function addTask(e: FormEvent) {
    e.preventDefault();
    if (!newTask?.title.trim()) return;
    await api(`/columns/${newTask.columnId}/tasks`, token, {
      method: 'POST',
      body: JSON.stringify({ title: newTask.title }),
    });
    setNewTask(null);
    refresh();
  }
  async function saveTask(e: FormEvent) {
    e.preventDefault();
    if (!edit?.title.trim()) return;
    await api(`/tasks/${edit.id}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ title: edit.title, description: edit.description ?? '' }),
    });
    setEdit(null);
    refresh();
  }
  async function share(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      await api(`/boards/${board.id}/members`, token, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setEmail('');
      setNotice('Member added');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to share');
    }
  }
  async function move(taskId: string, destinationColumnId: string) {
    const destination = columns.find((item) => item.id === destinationColumnId);
    if (!destination) return;
    await api(`/tasks/${taskId}/move`, token, {
      method: 'PATCH',
      body: JSON.stringify({ destinationColumnId, destinationIndex: destination.tasks.length }),
    });
    refresh();
  }
  return (
    <section className="board-space">
      <header className="board-header">
        <div>
          <p className="eyebrow">BOARD / {columns.length} COLUMNS</p>
          <h2>{board.name}</h2>
        </div>
        <div className="share-control">
          <form onSubmit={share}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Add member by email"
            />
            <Button>Share</Button>
          </form>
          {notice && <small>{notice}</small>}
        </div>
      </header>
      <form className="inline-form" onSubmit={addColumn}>
        <input
          value={column}
          onChange={(e) => setColumn(e.target.value)}
          placeholder="New column name"
        />
        <Button>Add column</Button>
      </form>
      {columns.length === 0 ? (
        <div className="empty-state">
          <strong>No columns yet</strong>
          <span>Add your first workflow column above.</span>
        </div>
      ) : (
        <div className="kanban-grid">
          {columns.map((item) => (
            <div
              className="column"
              key={item.id}
              id={item.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData('taskId');
                if (taskId) void move(taskId, item.id);
              }}
            >
              <div className="column-heading">
                <div>
                  <span className="column-index">0{item.position + 1}</span>
                  <h3>{item.name}</h3>
                </div>
                <button
                  onClick={async () => {
                    if (confirm(`Delete ${item.name} and its tasks?`)) {
                      await api(`/columns/${item.id}`, token, { method: 'DELETE' });
                      refresh();
                    }
                  }}
                >
                  Delete
                </button>
              </div>
              <div className="task-list">
                {item.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    setEdit={() => setEdit(task)}
                    remove={async () => {
                      await api(`/tasks/${task.id}`, token, { method: 'DELETE' });
                      refresh();
                    }}
                  />
                ))}
                {item.tasks.length === 0 && <p className="column-empty">Drop work here</p>}
              </div>
              <button
                className="add-task"
                onClick={() => setNewTask({ columnId: item.id, title: '' })}
              >
                + Add task
              </button>
            </div>
          ))}
        </div>
      )}
      {newTask && (
        <Modal title="New task" close={() => setNewTask(null)}>
          <form onSubmit={addTask}>
            <label>
              Title
              <input
                autoFocus
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              />
            </label>
            <Button>Add task</Button>
          </form>
        </Modal>
      )}
      {edit && (
        <Modal title="Edit task" close={() => setEdit(null)}>
          <form onSubmit={saveTask}>
            <label>
              Title
              <input
                autoFocus
                value={edit.title}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              />
            </label>
            <label>
              Description
              <textarea
                value={edit.description ?? ''}
                onChange={(e) => setEdit({ ...edit, description: e.target.value })}
              />
            </label>
            <Button>Save changes</Button>
          </form>
        </Modal>
      )}
    </section>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-heading">
          <h3>{title}</h3>
          <button onClick={close}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Home() {
  const client = useQueryClient();
  const [token, setToken] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : localStorage.getItem('flowboard_token')
  );
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    const value = localStorage.getItem('flowboard_user');
    return value ? JSON.parse(value) : null;
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const boards = useQuery({
    queryKey: ['boards'],
    queryFn: () => api<Board[]>('/boards', token),
    enabled: Boolean(token),
  });
  const board = useQuery({
    queryKey: ['board', selected],
    queryFn: () => api<Board>(`/boards/${selected}`, token),
    enabled: Boolean(token && selected),
  });
  if (!token || !user)
    return (
      <Auth
        onAuth={(t, u) => {
          localStorage.setItem('flowboard_token', t);
          localStorage.setItem('flowboard_user', JSON.stringify(u));
          setToken(t);
          setUser(u);
        }}
      />
    );
  async function createBoard(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await api('/boards', token, { method: 'POST', body: JSON.stringify({ name }) });
    setName('');
    client.invalidateQueries({ queryKey: ['boards'] });
  }
  function refresh() {
    client.invalidateQueries({ queryKey: ['board', selected] });
    client.invalidateQueries({ queryKey: ['boards'] });
  }
  function logout() {
    localStorage.clear();
    setToken(null);
    setUser(null);
    setSelected(null);
  }
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span>FB</span>
          <strong>Flowboard</strong>
        </div>
        <div className="profile">
          <span className="avatar">{user.name[0].toUpperCase()}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
        </div>
        <div className="sidebar-label">Your boards</div>
        {boards.isLoading && <p className="muted">Loading boards...</p>}
        {boards.isError && <p className="error">Couldn&apos;t load boards.</p>}
        {boards.data?.map((item) => (
          <button
            className={`board-link ${selected === item.id ? 'selected' : ''}`}
            key={item.id}
            onClick={() => setSelected(item.id)}
          >
            <span>{item.name[0].toUpperCase()}</span>
            {item.name}
          </button>
        ))}
        {boards.data?.length === 0 && <p className="muted">No boards yet.</p>}
        <form className="new-board" onSubmit={createBoard}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Board name" />
          <Button>Create board</Button>
        </form>
        <button className="logout" onClick={logout}>
          Sign out
        </button>
      </aside>
      <div className="main-content">
        {!selected ? (
          <div className="welcome">
            <p className="eyebrow">YOUR WORKSPACE</p>
            <h1>
              Choose a board
              <br />
              to get moving.
            </h1>
            <p>Select a board from the sidebar, or create a new one to begin.</p>
          </div>
        ) : board.isLoading ? (
          <div className="state-panel">Loading board...</div>
        ) : board.isError ? (
          <div className="state-panel error">Couldn&apos;t load this board.</div>
        ) : (
          board.data && <BoardView board={board.data} token={token} refresh={refresh} />
        )}
      </div>
    </main>
  );
}
