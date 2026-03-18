import React, { useState } from 'react';
import { type UserData } from '../types';
import { X, Mail, Lock, User } from 'lucide-react';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInviteSuccess: (newUser: UserData) => void;
  apiFetch: (endpoint: string, options?: RequestInit) => Promise<Response>;
}

export const InviteUserModal: React.FC<InviteUserModalProps> = ({ isOpen, onClose, onInviteSuccess, apiFetch }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit: React.ComponentProps<'form'>['onSubmit'] = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await apiFetch('/users/invite', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();
      onInviteSuccess(data.user);
      setName('');
      setEmail('');
      setPassword('');
      onClose();
      alert('メンバーを組織に招待しました！');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-extrabold text-slate-800">組織へメンバーを招待</h2>
            <p className="text-sm text-slate-500 mt-1">テナントに新しいユーザーアカウントを作成します</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-xl mb-4 text-sm font-bold border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">名前</label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <input required type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="山田 太郎" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">メールアドレス</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="yamada@example.com" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">初期パスワード</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="••••••••" />
            </div>
            <p className="text-xs text-slate-500 mt-2 font-medium">招待する方にこのパスワードを伝えてください。</p>
          </div>

          <button type="submit" disabled={isLoading} className="mt-4 w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md disabled:opacity-70 flex justify-center items-center">
            {isLoading ? '招待中...' : '招待する'}
          </button>
        </form>
      </div>
    </div>
  );
};
