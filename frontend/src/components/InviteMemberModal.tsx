import React, { useState, useEffect, useCallback } from 'react';
import { X, UserPlus, Shield, ShieldAlert, Trash2 } from 'lucide-react';
import type { ProjectMember } from '../types';

type User = { id: number; name: string; email: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  currentUserRole?: string; // 自分の権限（Ownerかどうか判定するため）
  apiFetch: (endpoint: string, options?: RequestInit) => Promise<Response>;
};

export const InviteMemberModal: React.FC<Props> = ({ isOpen, onClose, projectId, currentUserRole, apiFetch }) => {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 追加フォーム用ステート
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<'Owner' | 'Editor' | 'Viewer'>('Viewer');

  const isOwner = currentUserRole === 'Owner';

  // メンバー一覧と、追加候補となる全ユーザー一覧を取得
  const fetchData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [membersRes, usersRes] = await Promise.all([
        apiFetch(`/projects/${projectId}/members`),
        apiFetch(`/users`) // テナントの全ユーザー
      ]);
      const membersData = await membersRes.json();
      const usersData = await usersRes.json();

      setMembers(membersData.members || []);
      setAllUsers(usersData.users || []);
    } catch (err: any) {
      setError(err.message || 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [projectId, apiFetch]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
      setSelectedUserId('');
      setSelectedRole('Viewer');
    }
  }, [isOpen, fetchData]);

  // メンバーを追加する
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;

    try {
      setError(null);
      await apiFetch(`/projects/${projectId}/members`, {
        method: 'POST',
        body: JSON.stringify({ user_id: parseInt(selectedUserId), role: selectedRole })
      });
      await fetchData(); // リストを再取得
      setSelectedUserId(''); // フォームをリセット
    } catch (err: any) {
      setError(err.message);
    }
  };

  // メンバーの権限を変更する
  const handleRoleChange = async (userId: number, newRole: string) => {
    if (!window.confirm('権限を変更しますか？')) return;
    try {
      setError(null);
      await apiFetch(`/projects/${projectId}/members/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole })
      });
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // メンバーを削除する
  const handleRemoveMember = async (userId: number) => {
    if (!window.confirm('このメンバーをプロジェクトから外してもよろしいですか？')) return;
    try {
      setError(null);
      await apiFetch(`/projects/${projectId}/members/${userId}`, {
        method: 'DELETE'
      });
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!isOpen) return null;

  // まだプロジェクトに追加されていないユーザーだけをプルダウンの選択肢にする
  const availableUsers = allUsers.filter(u => !members.some(m => m.id === u.id));

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800">プロジェクトメンバー管理</h2>
            <p className="text-sm text-slate-500 mt-1">プロジェクトに参加するメンバーと権限を設定します</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm flex items-start gap-2">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* メンバー追加フォーム (Ownerのみ表示) */}
          {isOwner && (
            <form onSubmit={handleAddMember} className="mb-8 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> メンバーを追加
              </h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  required
                >
                  <option value="">ユーザーを選択...</option>
                  {availableUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
                <select
                  className="w-full sm:w-32 px-4 py-2 border border-slate-200 rounded-xl text-sm"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as any)}
                >
                  <option value="Owner">Owner</option>
                  <option value="Editor">Editor</option>
                  <option value="Viewer">Viewer</option>
                </select>
                <button
                  type="submit"
                  disabled={!selectedUserId || loading}
                  className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
                >
                  追加
                </button>
              </div>
            </form>
          )}

          {/* メンバー一覧 */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4" /> 参加中のメンバー ({members.length}名)
            </h3>
            {loading && members.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">読み込み中...</p>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-medium">名前</th>
                      <th className="px-4 py-3 font-medium">権限</th>
                      {isOwner && <th className="px-4 py-3 font-medium text-right">操作</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {members.map(member => (
                      <tr key={member.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-800">{member.name}</p>
                          <p className="text-xs text-slate-500">{member.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          {isOwner ? (
                            <select
                              value={member.role}
                              onChange={(e) => handleRoleChange(member.id, e.target.value)}
                              className="px-2 py-1 border border-slate-200 rounded-lg text-sm bg-white"
                            >
                              <option value="Owner">Owner</option>
                              <option value="Editor">Editor</option>
                              <option value="Viewer">Viewer</option>
                            </select>
                          ) : (
                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                              member.role === 'Owner' ? 'bg-amber-100 text-amber-700' :
                              member.role === 'Editor' ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {member.role}
                            </span>
                          )}
                        </td>
                        {isOwner && (
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="プロジェクトから外す"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
