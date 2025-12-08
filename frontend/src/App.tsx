import { useEffect, useMemo, useState } from 'react';
import './App.css';

type User = { id: string; name: string; email: string; role: 'admin' | 'user' };
type Document = {
  _id: string;
  title: string;
  category: string;
  description?: string;
  originalName: string;
  createdAt: string;
  mimeType?: string;
  cloudinaryUrl?: string;
  cloudinaryPublicId?: string;
  filePath?: string; // Keep for backward compatibility
};
type List = { _id: string; title: string; items: { text: string; done: boolean }[]; createdAt: string };

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [activeTab, setActiveTab] = useState<'documents' | 'upload' | 'lists' | 'admin'>('documents');
  const [docQuery, setDocQuery] = useState('');
  const [listQuery, setListQuery] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [docForm, setDocForm] = useState({ title: '', category: 'other', description: '' });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [listForm, setListForm] = useState({ title: '', items: '' });
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(false);
  const isLoggedIn = useMemo(() => Boolean(token && user), [token, user]);

  const handleApi = async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers = new Headers(options.headers || undefined);
    if (!isFormData) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers
    });
    if (!res.ok) {
      const message = (await res.json().catch(() => ({}))).message || 'Request failed';
      throw new Error(message);
    }
    return res.json();
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await handleApi<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm)
      });
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    if (!token) return;
    try {
      const me = await handleApi<User>('/api/users/me');
      setUser(me);
      localStorage.setItem('user', JSON.stringify(me));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchData = async () => {
    if (!token) return;
    try {
      const [docs, userLists] = await Promise.all([
        handleApi<Document[]>('/api/documents'),
        handleApi<List[]>('/api/lists')
      ]);
      setDocuments(docs);
      setLists(userLists);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProfile();
      fetchData();
    }
  }, [token]);

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) return;
    try {
      const data = await handleApi<{ user: User }>('/api/users', {
        method: 'POST',
        body: JSON.stringify(newUserForm)
      });
      alert(`User ${data.user.email} created`);
      setNewUserForm({ name: '', email: '', password: '', role: 'user' });
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const submitDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile) return alert('Choose a file');
    const form = new FormData();
    form.append('title', docForm.title);
    form.append('category', docForm.category);
    form.append('description', docForm.description);
    form.append('file', docFile);

    try {
      const doc = await handleApi<Document>('/api/documents', { method: 'POST', body: form });
      setDocuments((prev) => [doc, ...prev]);
      setDocForm({ title: '', category: 'other', description: '' });
      setDocFile(null);
      setActiveTab('documents');
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const submitList = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = listForm.items
      .split('\n')
      .map((i) => i.trim())
      .filter(Boolean);
    try {
      if (editingListId) {
        // Update existing list
        const updatedList = await handleApi<List>(`/api/lists/${editingListId}`, {
          method: 'PUT',
          body: JSON.stringify({ title: listForm.title, items })
        });
        setLists((prev) => prev.map((l) => (l._id === editingListId ? updatedList : l)));
        setEditingListId(null);
      } else {
        // Create new list
        const list = await handleApi<List>('/api/lists', {
          method: 'POST',
          body: JSON.stringify({ title: listForm.title, items })
        });
        setLists((prev) => [list, ...prev]);
      }
      setListForm({ title: '', items: '' });
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const editList = (list: List) => {
    setListForm({
      title: list.title,
      items: list.items.map((item) => item.text).join('\n')
    });
    setEditingListId(list._id);
  };

  const cancelEdit = () => {
    setListForm({ title: '', items: '' });
    setEditingListId(null);
  };

  const downloadDoc = async (docId: string, filename: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/documents/${docId}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const filteredDocs = documents.filter((doc) => {
    const q = docQuery.toLowerCase();
    return (
      doc.title.toLowerCase().includes(q) ||
      (doc.description || '').toLowerCase().includes(q) ||
      doc.originalName.toLowerCase().includes(q)
    );
  });

  const filteredLists = lists.filter((l) => {
    const q = listQuery.toLowerCase();
    return l.title.toLowerCase().includes(q) || l.items.some((it) => it.text.toLowerCase().includes(q));
  });

  const fileUrl = (doc: Document) => {
    // Use Cloudinary URL if available, otherwise fallback to local uploads
    if (doc.cloudinaryUrl) {
      return doc.cloudinaryUrl;
    }
    if (doc.filePath) {
      const fileName = doc.filePath.split(/[/\\\\]/).pop();
      return `${API_URL}/uploads/${fileName}`;
    }
    return '';
  };

  const deleteDoc = async (docId: string) => {
    if (!token) return;
    if (!confirm('Delete this document?')) return;
    try {
      await handleApi(`/api/documents/${docId}`, { method: 'DELETE' });
      setDocuments((prev) => prev.filter((d) => d._id !== docId));
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const deleteList = async (listId: string) => {
    if (!token) return;
    if (!confirm('Delete this list?')) return;
    try {
      await handleApi(`/api/lists/${listId}`, { method: 'DELETE' });
      setLists((prev) => prev.filter((l) => l._id !== listId));
    } catch (err) {
      alert((err as Error).message);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-slate-900/70 border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-blue-400 mb-2">Welcome</p>
            <h1 className="text-3xl font-semibold">Organizer</h1>
            <p className="text-slate-300 mt-2">Securely store IDs, health files, education and more.</p>
          </div>
          <form className="space-y-4" onSubmit={login}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Email</label>
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 outline-none"
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Password</label>
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 outline-none"
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 transition disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-blue-500">Dashboard</p>
            <h1 className="text-3xl font-semibold">Welcome back, {user?.name}</h1>
            <p className="text-slate-600">Manage documents, uploads, and family lists from one place.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-medium">
              {user?.role === 'admin' ? 'Admin' : 'Member'}
            </span>
            <button
              onClick={logout}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100"
            >
              Log out
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === 'documents' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border border-slate-200'
            }`}
          >
            Documents
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === 'upload' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border border-slate-200'
            }`}
          >
            Upload
          </button>
          <button
            onClick={() => setActiveTab('lists')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === 'lists' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border border-slate-200'
            }`}
          >
            Lists
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === 'admin' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border border-slate-200'
              }`}
            >
              Admin
            </button>
          )}
        </div>

        {activeTab === 'documents' && (
          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Your documents</h2>
                <p className="text-sm text-slate-500">Search and download your stored files.</p>
              </div>
              <input
                type="search"
                value={docQuery}
                onChange={(e) => setDocQuery(e.target.value)}
                placeholder="Search by title or description..."
                className="w-full md:w-72 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none"
              />
            </div>

            {filteredDocs.length === 0 ? (
              <p className="text-slate-500 text-sm">No documents found.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredDocs.map((doc) => {
                  const isImage = doc.mimeType?.startsWith('image/');
                  const previewSrc = isImage ? fileUrl(doc) : '';
                  return (
                    <div key={doc._id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.15em] text-blue-500">{doc.category}</p>
                          <h3 className="text-lg font-semibold">{doc.title}</h3>
                          <p className="text-xs text-slate-500">{new Date(doc.createdAt).toLocaleDateString()}</p>
                        </div>
                        <span className="text-[11px] px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-600">
                          {doc.originalName}
                        </span>
                      </div>
                      {doc.description && <p className="text-sm text-slate-600 line-clamp-3">{doc.description}</p>}
                      {isImage && previewSrc && (
                        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                          <img src={previewSrc} alt={doc.title} className="w-full h-40 object-cover" />
                        </div>
                      )}
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => deleteDoc(doc._id)}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadDoc(doc._id, doc.originalName)}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === 'upload' && (
          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Upload a document</h2>
              <p className="text-sm text-slate-500">Attach files by category with a short description.</p>
            </div>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={submitDocument}>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Title</label>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none"
                  value={docForm.title}
                  onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Category</label>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none"
                  value={docForm.category}
                  onChange={(e) => setDocForm({ ...docForm, category: e.target.value })}
                >
                  <option value="business">Business</option>
                  <option value="health">Health</option>
                  <option value="education">Education</option>
                  <option value="identification">Identification</option>
                  <option value="finance">Finance</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Description</label>
                <textarea
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none"
                  value={docForm.description}
                  onChange={(e) => setDocForm({ ...docForm, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">File</label>
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600 hover:border-blue-400">
                  <span>{docFile ? docFile.name : 'Choose a file to upload'}</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                    required
                  />
                  <span className="rounded-md bg-white border border-slate-200 px-3 py-1 text-xs font-semibold">Browse</span>
                </label>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700 transition shadow-md shadow-blue-500/20"
                >
                  Upload
                </button>
              </div>
            </form>
          </section>
        )}

        {activeTab === 'lists' && (
          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Family lists</h2>
                <p className="text-sm text-slate-500">Track tasks, reminders, and essentials.</p>
              </div>
              <input
                type="search"
                value={listQuery}
                onChange={(e) => setListQuery(e.target.value)}
                placeholder="Search lists..."
                className="w-full md:w-72 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none"
              />
            </div>

            <form className="grid gap-4 md:grid-cols-2" onSubmit={submitList}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Title</label>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none"
                  value={listForm.title}
                  onChange={(e) => setListForm({ ...listForm, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Items (one per line)</label>
                <textarea
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none"
                  value={listForm.items}
                  onChange={(e) => setListForm({ ...listForm, items: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                {editingListId && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700 transition shadow-md shadow-blue-500/20"
                >
                  {editingListId ? 'Update list' : 'Save list'}
                </button>
              </div>
            </form>

            <div className="grid gap-4 md:grid-cols-2">
              {filteredLists.length === 0 && <p className="text-slate-500 text-sm">No lists found.</p>}
              {filteredLists.map((l) => (
                <div key={l._id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{l.title}</h3>
                      <p className="text-xs text-slate-500">{new Date(l.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => editList(l)}
                        className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteList(l._id)}
                        className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                    {l.items.map((it, idx) => (
                      <li key={idx}>{it.text}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'admin' && user?.role === 'admin' && (
          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Create user</h2>
              <p className="text-sm text-slate-500">Add new members or admins to the organizer.</p>
            </div>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={createUser}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Name</label>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none"
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Role</label>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none"
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700 transition shadow-md shadow-blue-500/20"
                >
                  Create user
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}

export default App;
