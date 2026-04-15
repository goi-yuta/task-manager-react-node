import React, { useState, useEffect, useRef, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { TASK_STATUS, TASK_STATUS_LABEL, type Task, type ProjectMember, type TaskStatus } from '../types';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import tippy from 'tippy.js';
import { TaskActivityLog } from './TaskActivityLog';
import {
  X, Save, User, Calendar, Bold, Italic, List, ListOrdered, AlignLeft,
  CheckCircle2, CircleDot, Circle, MessageSquare, Send, Loader2,
  Paperclip, Trash2, File, Plus
} from 'lucide-react';
import { API_BASE } from '../config';

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
  apiFetch?: (endpoint: string, options?: RequestInit) => Promise<Response>;
  currentUserId?: number;
}

interface TaskAttachment {
  id: number;
  original_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

const MentionList = React.forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command({ id: item.id, label: item.name });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  React.useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }
      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }
      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden w-56 text-sm z-[9999]">
      {props.items.length > 0 ? (
        props.items.map((item: any, index: number) => (
          <button
            className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${index === selectedIndex ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
            key={index}
            onClick={() => selectItem(index)}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] shrink-0 ${index === selectedIndex ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-100 text-slate-500'}`}>
              {item.name.charAt(0)}
            </div>
            <span className="truncate">{item.name}</span>
          </button>
        ))
      ) : (
        <div className="px-4 py-3 text-slate-400 text-center text-xs">メンバーが見つかりません</div>
      )}
    </div>
  );
});

const getSuggestion = (getUsers: () => ProjectMember[], currentUserId?: number) => ({
  items: ({ query }: { query: string }) => {
    const users = getUsers();
    return users
      .filter(item => item.id !== currentUserId)
      .filter(item => item.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5); // 最大5件までサジェスト
  },
  render: () => {
    let component: ReactRenderer;
    let popup: any;

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });
      },
      onUpdate(props: any) {
        component.updateProps(props);
        if (!props.clientRect) {
          return;
        }
        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
      },
      onKeyDown(props: any) {
        if (props.event.key === 'Escape') {
          popup[0].hide();
          return true;
        }
        return (component.ref as any)?.onKeyDown(props);
      },
      onExit() {
        popup[0]?.destroy();
        component?.destroy();
      },
    };
  },
});

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

export const TaskEditModal: React.FC<TaskEditModalProps> = ({ isOpen, onClose, task, users, onSave, currentUserRole, apiFetch, currentUserId }) => {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<TaskStatus>(TASK_STATUS.TODO);
  const [assigneeId, setAssigneeId] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [isCommentLoading, setIsCommentLoading] = useState(false);
  const [isCommentEmpty, setIsCommentEmpty] = useState(true);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [isAttachmentLoading, setIsAttachmentLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [refreshLogTrigger, setRefreshLogTrigger] = useState(0);

  const isViewer = currentUserRole === 'Viewer';

  const usersRef = useRef(users);
  useEffect(() => {
    usersRef.current = users;
  }, [users])

  const editorClasses = [
    'prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[200px] p-4',
    // リスト・見出し・段落のスタイル
    '[&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5',
    '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4',
    '[&_p]:mb-2',
    // メンションのスタイル
    '[&_.mention]:bg-indigo-100 [&_.mention]:text-indigo-700 [&_.mention]:px-1 [&_.mention]:py-0.5 [&_.mention]:mr-1 [&_.mention]:inline-block [&_.mention]:rounded-md [&_.mention]:font-bold [&_.mention]:cursor-pointer',
    // プレースホルダーのスタイル
    '[&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.is-editor-empty:first-child::before]:text-slate-400 [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:h-0'
  ].join(' ');

  const commentEditorClasses = [
    'prose prose-sm max-w-none focus:outline-none min-h-[44px] max-h-[200px] overflow-y-auto px-3 py-2.5 text-slate-800 bg-transparent',
    // 段落のスタイル
    '[&_p]:m-0',
    // メンションのスタイル
    '[&_.mention]:bg-indigo-100 [&_.mention]:text-indigo-700 [&_.mention]:px-1 [&_.mention]:py-0.5 [&_.mention]:mr-1 [&_.mention]:inline-block [&_.mention]:rounded-md [&_.mention]:font-bold',
    // プレースホルダーのスタイル
    '[&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.is-editor-empty:first-child::before]:text-slate-400 [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:h-0'
  ].join(' ');

  const commentDisplayClasses = [
    'text-sm text-slate-600 bg-white p-3 rounded-tr-xl rounded-b-xl border border-slate-200 shadow-sm whitespace-pre-wrap leading-relaxed',
    'prose prose-sm max-w-none',
    // メンションのスタイル
    '[&_.mention]:bg-indigo-100 [&_.mention]:text-indigo-700 [&_.mention]:px-1 [&_.mention]:py-0.5 [&_.mention]:mr-1 [&_.mention]:inline-block [&_.mention]:rounded-md [&_.mention]:font-bold',
    '[&_p]:m-0'
  ].join(' ');

  // 説明文用エディタの初期化
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'タスクの詳細な説明を記入... (@でメンバーをメンションできます)',
        emptyEditorClass: 'is-editor-empty',
      }),
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        suggestion: getSuggestion(() => usersRef.current, currentUserId),
      }),
    ],
    content: '',
    editable: !isViewer,
    editorProps: {
      attributes: {
        class: editorClasses,
      },
    },
  });

  // コメント用エディタの初期化
  const commentEditor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: '質問や進捗をコメント... (@でメンション)',
        emptyEditorClass: 'is-editor-empty',
      }),
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        suggestion: getSuggestion(() => usersRef.current, currentUserId),
      }),
    ],
    content: '',
    editable: !isViewer,
    editorProps: {
      attributes: {
        class: commentEditorClasses,
      },
    },
    onUpdate: ({ editor }) => {
      setIsCommentEmpty(editor.getText().trim() === '');
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

      if (commentEditor) {
        commentEditor.commands.setContent('');
        commentEditor.setEditable(!isViewer);
        setIsCommentEmpty(true);
      }
    }
  }, [task, isOpen, editor, commentEditor, isViewer]);

  const fetchComments = useCallback(async () => {
    if (!task?.id || !apiFetch) return;
    setIsCommentLoading(true);
    try {
      const res = await apiFetch(`/tasks/${task.id}/comments`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch (err: any) {
      console.error('コメントの取得に失敗しました', err);
    } finally {
      setIsCommentLoading(false);
    }
  }, [task?.id, apiFetch]);

  const fetchAttachments = useCallback(async () => {
    if (!task?.id || !apiFetch) return;

    setIsAttachmentLoading(true);
    try {
      const res = await apiFetch(`/tasks/${task.id}/attachments`);
      const data = await res.json();
      setAttachments(data.attachments || []);
    } catch (err: any) {
      console.error('添付ファイルの取得に失敗しました', err);
    } finally {
      setIsAttachmentLoading(false);
    }
  }, [task?.id, apiFetch]);

  useEffect(() => {
    if (task?.id && isOpen && apiFetch) {
      fetchComments();
      fetchAttachments();
    }
  }, [task?.id, isOpen, apiFetch, fetchComments, fetchAttachments]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !task?.id || !apiFetch || isViewer) return;
    const file = e.target.files[0];

    if (file.size > 10 * 1024 * 1024) {
      alert('ファイルサイズは10MB以下にしてください。')
      return;
    }

    setIsUploading(true);
    try {
      // multipart/form-data 形式で送信するため、FormData オブジェクトを生成
      const formData = new FormData();

      formData.append('file', file);

      await apiFetch(`/tasks/${task.id}/attachments`, {
        method: 'POST',
        body: formData,
      });

      await fetchAttachments();
      setRefreshLogTrigger(prev => prev + 1);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!task?.id || !apiFetch) return;

    if (!window.confirm('この添付ファイルを削除してもよろしいですか？')) return;
    try {
      await apiFetch(`/tasks/${task.id}/attachments/${attachmentId}`, {
        method: 'DELETE'
      });
      await fetchAttachments();
      setRefreshLogTrigger(prev => prev + 1);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePostComment = async () => {
    if (!commentEditor || isCommentEmpty || !task?.id || !apiFetch || isViewer) return;

    setIsCommentLoading(true);
    try {
      await apiFetch(`/tasks/${task.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: commentEditor.getHTML() })
      });
      commentEditor.commands.setContent('');
      setIsCommentEmpty(true);
      await fetchComments(); // 投稿後に再取得して表示を更新
      setRefreshLogTrigger(prev => prev + 1);
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
      setRefreshLogTrigger(prev => prev + 1);
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat(((bytes / Math.pow(k, i)).toFixed(2))) + ' ' + sizes[i];
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
                  {Object.values(TASK_STATUS).map((s) => (
                    <option key={s} value={s}>{TASK_STATUS_LABEL[s]} ({s})</option>
                  ))}
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

          {/* 説明セクション（Tiptap） */}
          <div className="flex flex-col mb-10">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
              <AlignLeft className="w-4 h-4 text-slate-400" /> 詳細な説明
            </label>
            <div className={`bg-white border rounded-xl overflow-hidden transition-all ${!isViewer ? 'border-slate-200 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500' : 'border-transparent'}`}>
              <MenuBar editor={editor} disabled={isViewer || isSubmitting} />
              <EditorContent editor={editor} className="bg-white" />
            </div>
          </div>

          {/* ファイル添付セクション */}
          <div className="mt-8 pt-8 border-t border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                <Paperclip className="w-5 h-5 text-indigo-500" />
                添付ファイル ({attachments.length})
              </h3>
              {!isViewer && (
                <div>
                  <input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="text-sm px-3 py-1.5 bg-indigo-50 text-indigo-600 font-bold rounded-lg hover:bg-indigo-100 flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {isUploading ? 'アップロード中...' : 'ファイルを追加'}
                  </button>
                </div>
              )}
            </div>
            {isAttachmentLoading ? (
              <div className="flex justify-center items-center py-6">
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
              </div>
            ) : attachments.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6 bg-white rounded-xl border border-slate-200 border-dashed">添付されたファイルはありません</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {attachments.map(att => (
                  <div key={att.id} className="border border-slate-200 rounded-xl p-3 flex items-start gap-3 bg-white shadow-sm hover:border-indigo-300 transition-colors group">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0 overflow-hidden border border-indigo-100/50">
                      {att.file_type?.startsWith('image/') ? (
                        <img src={`${API_BASE}${att.file_path}`} alt={att.original_name} className="w-full h-full object-cover" />
                      ) : (
                        <File className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center h-10">
                      <a href={`${API_BASE}${att.file_path}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-slate-700 hover:text-indigo-600 truncate block transition-colors">
                        {att.original_name}
                      </a>
                      <p className="text-xs text-slate-400 mt-0.5">{formatFileSize(att.file_size)} • {new Date(att.created_at).toLocaleDateString()}</p>
                    </div>
                    {!isViewer && (
                      <button onClick={() => handleDeleteAttachment(att.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0" title="削除">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* コメントセクション */}
          <div className="mt-8 pt-8 border-t border-slate-200">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 mb-6">
              <MessageSquare className="w-5 h-5 text-indigo-500" />
              コメント ({comments.length})
            </h3>

            {/* コメント一覧 */}
            <div className="space-y-6 mb-8">
              {isCommentLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                  <span className="ml-2 text-sm font-bold text-slate-500">コメントを読み込み中...</span>
                </div>
              ) : comments.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">まだコメントはありません。タスクに関する相談やメモを残しましょう。</p>
              ) : (
                comments.map(comment => {
                  const date = new Date(comment.created_at);
                  const isSystemMsg = !comment.user_name;
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
                        <div
                          className={commentDisplayClasses}
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.content) }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 新規コメント投稿フォーム (Viewerは非表示) */}
            {!isViewer && (
              <div className="flex gap-3 items-end bg-white p-3 rounded-xl border border-slate-200 shadow-sm focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400 transition-all">
                <div
                  className="flex-1 min-w-0"
                  onKeyDown={(e) => {
                    // Cmd+Enter or Ctrl+Enter で送信
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handlePostComment();
                    }
                  }}
                >
                  <EditorContent editor={commentEditor} className="w-full bg-transparent" />
                </div>
                <button
                  onClick={handlePostComment}
                  disabled={!commentEditor || isCommentEmpty || isCommentLoading}
                  className="p-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shrink-0 mb-0.5"
                  title="送信 (Cmd + Enter)"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {isViewer && <p className="text-xs text-slate-400 mt-2 ml-1">※タスクを編集する権限、コメントを投稿する権限がありません（Viewer権限です）</p>}

          <TaskActivityLog
            taskId={task.id}
            apiFetch={apiFetch}
            refreshTrigger={refreshLogTrigger}
          />
        </div>
      </div>
    </div>
  );
};
