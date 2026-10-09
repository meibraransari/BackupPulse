import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  KeyRound,
  Trash2,
  Edit2,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  History,
  Globe,
  Monitor,
  Camera,
  Check,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../services/api';
import { User, UserLoginLog } from '../types';
import { useTimezone } from '../context/TimezoneContext';

interface UserManagementViewProps {
  currentUser: User | null;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
];

export const UserManagementView: React.FC<UserManagementViewProps> = ({ currentUser }) => {
  const { formatTimestamp, formatDateOnly } = useTimezone();
  const [activeTab, setActiveTab] = useState<'users' | 'logins'>('users');

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [searchUser, setSearchUser] = useState<string>('');

  // Login tracker state
  const [loginLogs, setLoginLogs] = useState<UserLoginLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [logPage, setLogPage] = useState<number>(1);
  const [logPagination, setLogPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [logStatusFilter, setLogStatusFilter] = useState<string>('ALL');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  // Form states
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'operator' | 'viewer'>('operator');
  const [formAvatar, setFormAvatar] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Multi-Tenant Project Scoping State
  const [availableProjects, setAvailableProjects] = useState<string[]>([]);
  const [formProjectScope, setFormProjectScope] = useState<'all' | 'custom'>('all');
  const [formAssignedProjects, setFormAssignedProjects] = useState<string[]>([]);
  const [customProjectInput, setCustomProjectInput] = useState<string>('');

  // Load users & available projects
  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const [data, projects] = await Promise.all([
        api.getUsers(),
        api.getProjects().catch(() => []),
      ]);
      setUsers(data);
      if (projects) setAvailableProjects(projects);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Load login tracker logs
  const loadLoginLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await api.getLoginLogs({
        page: logPage,
        limit: 15,
        status: logStatusFilter !== 'ALL' ? logStatusFilter : undefined,
      });
      setLoginLogs(res.data);
      setLogPagination(res.pagination);
    } catch (err) {
      console.error('Failed to load login audit logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, [logPage, logStatusFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (activeTab === 'logins') {
      loadLoginLogs();
    }
  }, [activeTab, loadLoginLogs]);

  // Open Add User
  const handleOpenAdd = () => {
    setFormUsername('');
    setFormPassword('');
    setFormFullName('');
    setFormEmail('');
    setFormRole('operator');
    setFormAvatar('');
    setFormIsActive(true);
    setFormProjectScope('all');
    setFormAssignedProjects([]);
    setCustomProjectInput('');
    setFormError(null);
    setIsAddModalOpen(true);
  };

  // Open Edit User
  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setFormUsername(user.username);
    setFormPassword('');
    setFormFullName(user.fullName || '');
    setFormEmail(user.email || '');
    setFormRole((user.role as any) || 'operator');
    setFormAvatar(user.avatar || '');
    setFormIsActive(user.isActive !== false);

    if (user.assignedProjects && user.assignedProjects.length > 0 && !user.assignedProjects.includes('*')) {
      setFormProjectScope('custom');
      setFormAssignedProjects(user.assignedProjects);
    } else {
      setFormProjectScope('all');
      setFormAssignedProjects([]);
    }
    setCustomProjectInput('');
    setFormError(null);
  };

  // Handle Add Submit
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formUsername.trim()) {
      setFormError('Username is required.');
      return;
    }
    if (!formPassword || formPassword.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    setFormSubmitting(true);
    try {
      await api.createUser({
        username: formUsername.trim(),
        password: formPassword,
        fullName: formFullName.trim() || undefined,
        email: formEmail.trim() || undefined,
        role: formRole,
        avatar: formAvatar.trim() || undefined,
        isActive: formIsActive,
        assignedProjects: formRole === 'admin' || formProjectScope === 'all' ? [] : formAssignedProjects,
      });
      setIsAddModalOpen(false);
      await loadUsers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create user account.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Edit Submit
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setFormError(null);

    setFormSubmitting(true);
    try {
      await api.updateUser(editingUser.id, {
        fullName: formFullName.trim() || undefined,
        email: formEmail.trim() || undefined,
        role: formRole,
        avatar: formAvatar.trim() || undefined,
        isActive: formIsActive,
        newPassword: formPassword.trim() || undefined,
        assignedProjects: formRole === 'admin' || formProjectScope === 'all' ? [] : formAssignedProjects,
      });
      setEditingUser(null);
      await loadUsers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update user account.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Delete User
  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    try {
      await api.deleteUser(deletingUser.id);
      setDeletingUser(null);
      await loadUsers();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchUser) return true;
    const term = searchUser.toLowerCase();
    return (
      u.username.toLowerCase().includes(term) ||
      (u.fullName && u.fullName.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      u.role.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Users className="h-6 w-6 text-emerald-400" />
            <span>Identity & Access Management</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage multi-user administrative accounts, role assignments, avatars, and review login security audit trails.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* View Tab Switcher */}
          <div className="flex items-center bg-slate-900 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'users' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>User Directory</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950/60 font-mono">
                {users.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('logins')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'logins' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>Login Tracker</span>
            </button>
          </div>

          {activeTab === 'users' && currentUser?.role === 'admin' && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Add User</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'users' ? (
        /* ================= USERS DIRECTORY TAB ================= */
        <div className="space-y-4">
          {/* Search bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search users by handle, full name, email, or role..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              onClick={loadUsers}
              disabled={loadingUsers}
              className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              title="Refresh User Directory"
            >
              <RefreshCw className={`h-4 w-4 ${loadingUsers ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>

          {/* Users Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-slate-950/80 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800 select-none">
                  <tr>
                    <th className="py-3 px-4">User Identity</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
                        <span>Loading user accounts...</span>
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        No users found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center space-x-3">
                            <div className="h-9 w-9 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                              {user.avatar ? (
                                <img src={user.avatar} alt={user.username} className="h-full w-full object-cover" />
                              ) : (
                                <span className="font-bold text-xs uppercase text-slate-300">
                                  {user.username.slice(0, 2)}
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-white">
                                {user.fullName || user.username}
                                {user.id === currentUser?.id && (
                                  <span className="ml-1.5 text-[10px] text-emerald-400 font-normal">(You)</span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">@{user.username}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                          {user.email || '—'}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex flex-col space-y-1">
                            <div>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${
                                  user.role === 'admin'
                                    ? 'bg-purple-950/80 text-purple-300 border-purple-700/50'
                                    : user.role === 'operator'
                                    ? 'bg-blue-950/80 text-blue-300 border-blue-700/50'
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                                }`}
                              >
                                {user.role}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {user.role === 'admin' || !user.assignedProjects || user.assignedProjects.length === 0 || user.assignedProjects.includes('*') ? (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {user.role === 'admin' ? 'Global Access' : 'All Projects'}
                                </span>
                              ) : (
                                user.assignedProjects.map((p) => (
                                  <span
                                    key={p}
                                    className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-blue-950/70 text-blue-300 border border-blue-800/50"
                                  >
                                    {p}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {user.isActive !== false ? (
                            <span className="inline-flex items-center space-x-1 text-emerald-400 text-xs font-medium">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 text-rose-400 text-xs font-medium">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                              <span>Disabled</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap font-mono">
                          {user.createdAt ? formatDateOnly(user.createdAt) : '—'}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {currentUser?.role === 'admin' && (
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => handleOpenEdit(user)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                title="Edit user"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              {user.id !== currentUser?.id && (
                                <button
                                  onClick={() => setDeletingUser(user)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                                  title="Delete user"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ================= LOGIN TRACKER TAB ================= */
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400 font-medium">Status Filter:</span>
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setLogStatusFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    logStatusFilter === 'ALL' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setLogStatusFilter('SUCCESS')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    logStatusFilter === 'SUCCESS' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-emerald-400'
                  }`}
                >
                  Success
                </button>
                <button
                  onClick={() => setLogStatusFilter('FAILED')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    logStatusFilter === 'FAILED' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-rose-400'
                  }`}
                >
                  Failed
                </button>
              </div>
            </div>

            <button
              onClick={loadLoginLogs}
              disabled={loadingLogs}
              className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors self-end sm:self-auto"
              title="Refresh Login Audit Logs"
            >
              <RefreshCw className={`h-4 w-4 ${loadingLogs ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-slate-950/80 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800 select-none">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4">Client IP Address</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Reason / Details</th>
                    <th className="py-3 px-4">User Agent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingLogs ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-400" />
                        <span>Querying login telemetry...</span>
                      </td>
                    </tr>
                  ) : loginLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        No login events recorded for this criteria.
                      </td>
                    </tr>
                  ) : (
                    loginLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-400">
                          {formatTimestamp(log.createdAt)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-white whitespace-nowrap">
                          {log.username}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                          {log.ipAddress || '127.0.0.1'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {log.status === 'SUCCESS' ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-600/40">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>SUCCESS</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950 text-rose-400 border border-rose-600/40">
                              <AlertCircle className="h-3 w-3" />
                              <span>FAILED</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-xs">
                          {log.failureReason ? (
                            <span className="text-rose-400 font-mono text-[11px]">{log.failureReason}</span>
                          ) : (
                            <span className="text-slate-500">Authenticated OK</span>
                          )}
                        </td>
                        <td className="py-3 px-4 max-w-[220px] truncate font-mono text-[10px] text-slate-500" title={log.userAgent}>
                          {log.userAgent || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= ADD USER MODAL ================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="font-bold text-white text-base">Add New User</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-700 text-rose-300">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="e.g. devops_lead"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Initial Password *</label>
                  <input
                    type="password"
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Min 6 chars"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Full Name</label>
                  <input
                    type="text"
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    placeholder="e.g. Jordan Smith"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="user@company.internal"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Role</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="operator">Operator (View & Resolve Backups)</option>
                  <option value="admin">Administrator (Full Access & User Control)</option>
                  <option value="viewer">Viewer (Read-Only Telemetry)</option>
                </select>
              </div>

              {/* Multi-Tenant RBAC Project Permissions */}
              {formRole !== 'admin' && (
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-0.5">
                      🏢 Multi-Tenant Project Permissions (RBAC Scope)
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Restrict this user to specific project tags or grant global project access.
                    </p>
                  </div>

                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="add-project-scope"
                        checked={formProjectScope === 'all'}
                        onChange={() => setFormProjectScope('all')}
                        className="text-emerald-500 bg-slate-900 border-slate-700 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-slate-300 text-xs">Global (All Projects)</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="add-project-scope"
                        checked={formProjectScope === 'custom'}
                        onChange={() => setFormProjectScope('custom')}
                        className="text-emerald-500 bg-slate-900 border-slate-700 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-slate-300 text-xs">Assigned Projects Only</span>
                    </label>
                  </div>

                  {formProjectScope === 'custom' && (
                    <div className="space-y-2 pt-2 border-t border-slate-800/80">
                      <label className="block text-slate-400 text-[11px]">
                        Select allowed projects:
                      </label>

                      {availableProjects.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-slate-900/60 rounded-xl border border-slate-800">
                          {availableProjects.map((p) => {
                            const isChecked = formAssignedProjects.includes(p);
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => {
                                  if (isChecked) {
                                    setFormAssignedProjects(formAssignedProjects.filter((item) => item !== p));
                                  } else {
                                    setFormAssignedProjects([...formAssignedProjects, p]);
                                  }
                                }}
                                className={`px-2 py-0.5 rounded-lg text-[11px] font-mono transition-colors border ${
                                  isChecked
                                    ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                {isChecked ? '✓ ' : '+ '}{p}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={customProjectInput}
                          onChange={(e) => setCustomProjectInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const trimmed = customProjectInput.trim();
                              if (trimmed && !formAssignedProjects.includes(trimmed)) {
                                setFormAssignedProjects([...formAssignedProjects, trimmed]);
                                setCustomProjectInput('');
                              }
                            }
                          }}
                          placeholder="Type custom project tag and click Add..."
                          className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-[11px] focus:outline-none focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const trimmed = customProjectInput.trim();
                            if (trimmed && !formAssignedProjects.includes(trimmed)) {
                              setFormAssignedProjects([...formAssignedProjects, trimmed]);
                              setCustomProjectInput('');
                            }
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-semibold rounded-xl"
                        >
                          Add
                        </button>
                      </div>

                      {formAssignedProjects.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {formAssignedProjects.map((p) => (
                            <span
                              key={p}
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-blue-950 border border-blue-700/60 text-blue-300 text-[11px] font-mono"
                            >
                              <span>{p}</span>
                              <button
                                type="button"
                                onClick={() => setFormAssignedProjects(formAssignedProjects.filter((item) => item !== p))}
                                className="hover:text-white ml-0.5 text-slate-400"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-medium mb-1">Avatar Image URL (Optional)</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={formAvatar}
                    onChange={(e) => setFormAvatar(e.target.value)}
                    placeholder="https://... or choose below"
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  {PRESET_AVATARS.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setFormAvatar(p)}
                      className={`h-7 w-7 rounded-lg overflow-hidden border ${formAvatar === p ? 'border-emerald-500' : 'border-slate-800'}`}
                    >
                      <img src={p} alt="preset" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="user-active"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="user-active" className="text-slate-300 font-medium">
                  Active Account (Permit immediate login)
                </label>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 bg-slate-800 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center space-x-1.5"
                >
                  {formSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= EDIT USER MODAL ================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="font-bold text-white text-base">Edit User: {editingUser.username}</h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-700 text-rose-300">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Full Name</label>
                  <input
                    type="text"
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Role</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="operator">Operator (View & Resolve Backups)</option>
                  <option value="admin">Administrator (Full Access & User Control)</option>
                  <option value="viewer">Viewer (Read-Only Telemetry)</option>
                </select>
              </div>

              {/* Multi-Tenant RBAC Project Permissions */}
              {formRole !== 'admin' && (
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-0.5">
                      🏢 Multi-Tenant Project Permissions (RBAC Scope)
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Restrict this user to specific project tags or grant global project access.
                    </p>
                  </div>

                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="edit-project-scope"
                        checked={formProjectScope === 'all'}
                        onChange={() => setFormProjectScope('all')}
                        className="text-emerald-500 bg-slate-900 border-slate-700 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-slate-300 text-xs">Global (All Projects)</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="edit-project-scope"
                        checked={formProjectScope === 'custom'}
                        onChange={() => setFormProjectScope('custom')}
                        className="text-emerald-500 bg-slate-900 border-slate-700 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-slate-300 text-xs">Assigned Projects Only</span>
                    </label>
                  </div>

                  {formProjectScope === 'custom' && (
                    <div className="space-y-2 pt-2 border-t border-slate-800/80">
                      <label className="block text-slate-400 text-[11px]">
                        Select allowed projects:
                      </label>

                      {availableProjects.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-slate-900/60 rounded-xl border border-slate-800">
                          {availableProjects.map((p) => {
                            const isChecked = formAssignedProjects.includes(p);
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => {
                                  if (isChecked) {
                                    setFormAssignedProjects(formAssignedProjects.filter((item) => item !== p));
                                  } else {
                                    setFormAssignedProjects([...formAssignedProjects, p]);
                                  }
                                }}
                                className={`px-2 py-0.5 rounded-lg text-[11px] font-mono transition-colors border ${
                                  isChecked
                                    ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                {isChecked ? '✓ ' : '+ '}{p}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={customProjectInput}
                          onChange={(e) => setCustomProjectInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const trimmed = customProjectInput.trim();
                              if (trimmed && !formAssignedProjects.includes(trimmed)) {
                                setFormAssignedProjects([...formAssignedProjects, trimmed]);
                                setCustomProjectInput('');
                              }
                            }
                          }}
                          placeholder="Type custom project tag and click Add..."
                          className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-[11px] focus:outline-none focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const trimmed = customProjectInput.trim();
                            if (trimmed && !formAssignedProjects.includes(trimmed)) {
                              setFormAssignedProjects([...formAssignedProjects, trimmed]);
                              setCustomProjectInput('');
                            }
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-semibold rounded-xl"
                        >
                          Add
                        </button>
                      </div>

                      {formAssignedProjects.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {formAssignedProjects.map((p) => (
                            <span
                              key={p}
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-blue-950 border border-blue-700/60 text-blue-300 text-[11px] font-mono"
                            >
                              <span>{p}</span>
                              <button
                                type="button"
                                onClick={() => setFormAssignedProjects(formAssignedProjects.filter((item) => item !== p))}
                                className="hover:text-white ml-0.5 text-slate-400"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-medium mb-1">Reset Password (Leave empty to keep current)</label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Enter new password..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Avatar Image URL</label>
                <input
                  type="text"
                  value={formAvatar}
                  onChange={(e) => setFormAvatar(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="edit-user-active"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="edit-user-active" className="text-slate-300 font-medium">
                  Active Account
                </label>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 bg-slate-800 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center space-x-1.5"
                >
                  {formSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= DELETE CONFIRMATION ================= */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-4 text-center">
            <div className="h-12 w-12 rounded-full bg-rose-950 text-rose-400 flex items-center justify-center mx-auto border border-rose-800">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Delete User Account?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to delete user <strong className="text-white">"{deletingUser.username}"</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center space-x-2 pt-2">
              <button
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 bg-slate-800 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white"
              >
                Yes, Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
