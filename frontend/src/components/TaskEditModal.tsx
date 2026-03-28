import React, { useState, useEffect } from 'react';
import { X, Save, User, Calendar, Bold, Italic, List, ListOrdered, AlignLeft, CheckCircle2, CircleDot, Circle, MessageSquare, Send } from 'lucide-react';
import { TASK_STATUS, type Task, type ProjectMember, type TaskStatus } from '../types';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

interface TaskComment {
  id: number;
  content: string;
  user_name: string;
  created_at: string;
}

interface TaskEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  users: ProjectMember[];
  onSave: (updates: { title: string; status?: TaskStatus; assignee_id: number | null; start_date: string | null; due_date: string | null; description: string | null; }) => Promise<void>;
  currentUserRole?: string;
  apiFetch?: any;
}

const MenuBar = ({ editor, disabled }: { editor: any, disabled: boolean }) => {
  if (!editor) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1 p-2 border-b border-slate-200 bg-slate-50 rounded-t-xl ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`p-1.5 rounded-lg transition-colors ${editor.isActive('bold') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}
        title="太字"
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`p-1.5 rounded-lg transition-colors ${editor.isActive('italic') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}
        title="斜体"
      >
        <Italic className="w-4 h-4" />
      </button>
      <div className="w-px h-5 bg-slate-300 mx-1" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-1.5 rounded-lg transition-colors ${editor.isActive('bulletList') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}
        title="箇条書きリスト"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-1.5 rounded-lg transition-colors ${editor.isActive('orderedList') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}
        title="番号付きリスト"
      >
        <ListOrdered className="w-4 h-4" />
      </button>
    </div>
  );
};

export const TaskEditModal: React.FC<TaskEditModalProps> = ({ isOpen, onClose, task, users, onSave, currentUserRole, apiFetch }) => {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<TaskStatus>(TASK_STATUS.TODO);
  const [assigneeId, setAssigneeId] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isCommentLoading, setIsCommentLoading] = useState(false);

  const isViewer = currentUserRole === 'Viewer';

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    editable: !isViewer,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[200px] p-4 [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5 [&_p]:mb-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4',
      },
    },
  });

  // モーダルが開かれたときの初期化＆コメント取得
  useEffect(() => {
    if (task && isOpen) {
      const formatDateForInput = (dateString: string | null | undefined) => {
        if (!dateString) return '';
        // 例: "2026-03-21T15:00:00.000Z" -> "2026-03-21"
        // 例: "2026-03-21" -> "2026-03-21"
        return dateString.substring(0, 10);
      };

      setTitle(task.title);
      setStatus(task.status);
      setAssigneeId(task.assignee_id || '');
      setStartDate(task.start_date ? formatDateForInput(task.start_date) : '');
      setDueDate(task.due_date ? formatDateForInput(task.due_date) : '');

      if (editor) {
        // モーダルが開かれた時に、タスクの description をエディタにセット
        editor.commands.setContent(task.description || '');
        editor.setEditable(!isViewer);
      }

      if (apiFetch) {
        fetchComments();
      }
    }
  }, [task, isOpen, editor, isViewer, apiFetch]);

  const fetchComments = async () => {
    if (!task || !apiFetch) return;
    try {
      const res = await apiFetch(`/tasks/${task.id}/comments`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch (err: any) {
      console.error('コメントの取得に失敗しました', err);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || !task || !apiFetch || isViewer) return;

    setIsCommentLoading(true);
    try {
      await apiFetch(`/tasks/${task.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: newComment })
      });
      setNewComment('');
      await fetchComments(); // 投稿後に再取得して表示を更新
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsCommentLoading(false);
    }
  };

  if (!isOpen || !task) return null;

  const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!title.trim() || isViewer) return;

    if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
      alert('開始日は期限日より前（または同じ日）を指定してください');
      return;
    }

    setIsSubmitting(true);
    setIsSaved(false);
    try {
      await onSave({
        title,
        status,
        assignee_id: assigneeId === '' ? null : Number(assigneeId),
        start_date: startDate || null,
        due_date: dueDate || null,
        description: editor ? editor.getHTML() : null
      });

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err: any) {
      // エラーハンドリングは親（App.tsx）で行う
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (s: TaskStatus) => {
    if (s === TASK_STATUS.DONE) return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    if (s === TASK_STATUS.DOING) return <CircleDot className="w-5 h-5 text-blue-500" />;
    return <Circle className="w-5 h-5 text-slate-300" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
      {/* 背景のオーバーレイ */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* 右からスライドインするパネル本体 */}
      <div className="relative w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl transform transition-transform duration-300 ease-in-out">

        {/* パネルヘッダー */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-500">{task.project_name || 'プロジェクト'}</span>
          </div>
          <div className="flex items-center gap-2">
            {!isViewer && (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !title.trim() || isSaved}
                className={`px-4 py-2 text-white text-sm font-bold rounded-lg transition-all shadow-sm flex items-center gap-2 ${
                  isSaved
                    ? 'bg-emerald-500 hover:bg-emerald-600 disabled:opacity-100' // 保存完了時は緑色
                    : 'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70'    // 通常時は青色
                }`}
              >
                {isSubmitting ? (
                  '保存中...'
                ) : isSaved ? (
                  <><CheckCircle2 className="w-4 h-4" /> 保存しました</>
                ) : (
                  <><Save className="w-4 h-4" /> 保存する</>
                )}
              </button>
            )}
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* パネルのスクロール領域 */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">

          {/* メインコンテンツ：タイトル */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-slate-500 bg-slate-200/50 px-2 py-1 rounded-md border border-slate-200">ID: {task.id}</span>
            </div>
            <input
              required
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isViewer || isSubmitting}
              placeholder="タスクのタイトル"
              className="w-full bg-transparent text-3xl font-extrabold text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-0 resize-none" 
            />
          </div>

          {/* プロパティエリア：ステータス、担当者、日付など */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500">ステータス</label>
              <div className="relative flex items-center">
                <div className="absolute left-3">
                  {getStatusIcon(status)}
                </div>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  disabled={isViewer || isSubmitting}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer disabled:opacity-70"
                >
                  <option value={TASK_STATUS.TODO}>未着手 (TODO)</option>
                  <option value={TASK_STATUS.DOING}>進行中 (DOING)</option>
                  <option value={TASK_STATUS.DONE}>完了 (DONE)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500">担当者</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : '')}
                  disabled={isViewer || isSubmitting}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer disabled:opacity-70"
                >
                  <option value="">未担当</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500">期間</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={isViewer || isSubmitting}
                    className="w-full pl-10 pr-2 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-70"
                  />
                </div>
                <span className="text-slate-400 font-bold">〜</span>
                <div className="relative flex-1">
                  <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    disabled={isViewer || isSubmitting}
                    className="w-full pl-10 pr-2 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-70"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* リッチテキストエディタ（Tiptap） */}
          <div className="flex flex-col mb-10">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
              <AlignLeft className="w-4 h-4 text-slate-400" /> 詳細な説明
            </label>
            <div className={`bg-white border rounded-xl overflow-hidden transition-all ${!isViewer ? 'border-slate-200 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500' : 'border-transparent'}`}>
              <MenuBar editor={editor} disabled={isViewer || isSubmitting} />
              <EditorContent editor={editor} className="bg-white" />
            </div>
          </div>

          {/* コメントセクション */}
          <div className="mt-8 pt-8 border-t border-slate-200">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 mb-6">
              <MessageSquare className="w-5 h-5 text-indigo-500" />
              コメント ({comments.length})
            </h3>

            {/* コメント一覧 */}
            <div className="space-y-6 mb-8">
              {comments.map(comment => {
                const date = new Date(comment.created_at);
                const isSystemMsg = !comment.user_name; // 退職者などの場合
                return (
                  <div key={comment.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                      {isSystemMsg ? '?' : comment.user_name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-bold text-sm text-slate-800">{comment.user_name || '不明なユーザー'}</span>
                        <span className="text-xs text-slate-400">{date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="text-sm text-slate-600 bg-white p-3 rounded-tr-xl rounded-b-xl border border-slate-200 shadow-sm whitespace-pre-wrap leading-relaxed">
                        {comment.content}
                      </div>
                    </div>
                  </div>
                );
              })}
              {comments.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">まだコメントはありません。タスクに関する相談やメモを残しましょう。</p>
              )}
            </div>

            {/* 新規コメント投稿フォーム (Viewerは非表示) */}
            {!isViewer && (
              <div className="flex gap-3 items-start bg-white p-4 rounded-xl border border-slate-200 shadow-sm focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400 transition-all">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="質問や進捗をコメント..."
                  className="flex-1 min-h-[44px] max-h-[200px] text-sm resize-y outline-none py-1 text-slate-800 placeholder-slate-400"
                  rows={2}
                  disabled={isCommentLoading}
                  onKeyDown={(e) => {
                    // Cmd+Enter or Ctrl+Enter で送信
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handlePostComment();
                    }
                  }}
                />
                <button
                  onClick={handlePostComment}
                  disabled={!newComment.trim() || isCommentLoading}
                  className="p-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shrink-0 mt-auto"
                  title="送信 (Cmd + Enter)"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {isViewer && <p className="text-xs text-slate-400 mt-2 ml-1">※タスクを編集する権限がありません（Viewer権限です）</p>}
        </div>
      </div>
    </div>
  );
};
