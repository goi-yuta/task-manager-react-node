import React, { useMemo, useState } from 'react';
import { TASK_STATUS, type Task } from '../types';
import { User, Calendar } from 'lucide-react';

interface GanttChartProps {
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onUpdateDates: (taskId: number, newStart: string, newDue: string) => void;
  currentUserRole?: string;
}

export const GanttChart: React.FC<GanttChartProps> = ({ tasks, onEditTask, onUpdateDates, currentUserRole }) => {
  const isViewer = currentUserRole === 'Viewer';
  const [isDragging, setIsDragging] = useState(false);

  // 1. チャートの表示期間を決定する（タスクの最小開始日〜最大期限日）
  const { chartStartDate, days } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let minDate = new Date(today);
    let maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 30); // 最低でも今日から30日間は表示する

    // タスク群から最小の開始日・最大の期限日を抽出
    tasks.forEach(task => {
      if (task.start_date) {
        const start = new Date(task.start_date);
        start.setHours(0, 0, 0, 0);
        if (start < minDate) minDate = new Date(start);
      }
      if (task.due_date) {
        const due = new Date(task.due_date);
        due.setHours(0, 0, 0, 0);
        if (due > maxDate) maxDate = new Date(due);
      }
    });

    // 見栄えのために前後に3日間の余白を持たせる
    minDate.setDate(minDate.getDate() - 3);
    maxDate.setDate(maxDate.getDate() + 3);

    // 日付配列を生成
    const d = [];
    let current = new Date(minDate);
    while (current <= maxDate) {
      d.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return { chartStartDate: minDate, days: d };
  }, [tasks]);

  // 2. ある日付がカレンダーの「何番目のマス目（インデックス）か」を計算するヘルパー
  const getDayIndex = (targetDateString: string) => {
    const target = new Date(targetDateString);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - chartStartDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col mt-4">
      <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
        <Calendar className="w-5 h-5 text-indigo-500" />
        <h3 className="font-bold text-slate-800">ガントチャートビュー</h3>
      </div>

      <div className="overflow-x-auto pb-6">
        {/* CSS Gridの本体。1列目はタスク名(250px)、2列目以降は日付マス(40px) */}
        <div
          className="min-w-max"
          style={{
            display: 'grid',
            gridTemplateColumns: `250px repeat(${days.length}, 40px)`
          }}
        >
          {/* ========== ヘッダー行（日付） ========== */}
          <div className="border-b border-slate-200 border-r p-3 font-bold text-xs text-slate-500 sticky left-0 bg-slate-50 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
            タスク名
          </div>
          {days.map((d, i) => {
            const isToday = d.toDateString() === new Date().toDateString();
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div
                key={i}
                className={`border-b border-r border-slate-200 flex flex-col items-center justify-center text-[10px] font-bold
                  ${isToday ? 'bg-indigo-50 text-indigo-700' : isWeekend ? 'bg-slate-50 text-slate-400' : 'bg-white text-slate-600'}`}
              >
                <span>{d.getMonth() + 1}/{d.getDate()}</span>
                <span className="font-normal opacity-70">
                  {['日', '月', '火', '水', '木', '金', '土'][d.getDay()]}
                </span>
              </div>
            );
          })}

          {/* ========== タスク行（横棒グラフ） ========== */}
          {tasks.map((task, rowIndex) => {
            // バーの開始位置と期間を計算
            const startIndex = task.start_date ? getDayIndex(task.start_date) : null;
            const endIndex = task.due_date ? getDayIndex(task.due_date) : startIndex;

            // 最低1日は表示する（+1）
            const duration = (startIndex !== null && endIndex !== null)
              ? Math.max(1, endIndex - startIndex + 1)
              : 0;

            const isDone = task.status === TASK_STATUS.DONE;

            return (
              <React.Fragment key={task.id}>
                {/* 1列目：タスク名（左側にSticky固定） */}
                <div
                  onClick={() => onEditTask(task)}
                  className={`p-3 text-sm font-bold border-b border-r border-slate-100 sticky left-0 z-20 flex flex-col justify-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] cursor-pointer hover:bg-indigo-50/50 transition-colors
                  ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                  ${isDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}
                >
                  <div className="truncate w-full pr-2" title={`${task.title} (クリックして編集)`}>{task.title}</div>
                  {task.assignee_name && <span className="text-[10px] text-slate-400 font-normal truncate mt-0.5"><User className="w-3 h-3 inline mr-1" />{task.assignee_name}</span>}
                </div>

                {/* 2列目以降：背景のマス目 */}
                {days.map((d, i) => {
                   const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                   return (
                     <div
                       key={`bg-${i}`}
                       className={`border-b border-r border-slate-100/50
                         ${isWeekend ? 'bg-slate-50/80' : rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                       style={{ gridRow: rowIndex + 2, gridColumn: i + 2 }} // ヘッダーが1行目なので +2
                       onDragOver={(e) => {
                         if (isViewer) return;
                         e.preventDefault(); // ドロップを許可するために必須
                         e.dataTransfer.dropEffect = 'move';
                       }}
                       onDrop={(e) => {
                         if (isViewer) return;
                         e.preventDefault();
                         try {
                           const dataStr = e.dataTransfer.getData('application/json');
                           if (!dataStr) return;
                           const data = JSON.parse(dataStr);
                           if (!data.taskId || !data.startDate) return;

                           // 元のタスクの期間を計算
                           const oldStart = new Date(data.startDate);
                           oldStart.setHours(0,0,0,0);
                           const oldDue = data.dueDate ? new Date(data.dueDate) : new Date(data.startDate);
                           oldDue.setHours(0,0,0,0);
                           const durationMs = oldDue.getTime() - oldStart.getTime();

                           // ドロップされたマス目の日付から、掴んだ位置のオフセット日数を引くことで正しい開始日を算出
                           const newStart = new Date(d);
                           newStart.setDate(newStart.getDate() - (data.grabOffsetDays || 0));

                           // 新しい期限日を算出（開始日 + 期間）
                           const newDue = new Date(newStart.getTime() + durationMs);

                           // タイムゾーンずれを防ぐためローカルの YYYY-MM-DD にフォーマットして渡す
                           const formatYMD = (date: Date) => {
                             const y = date.getFullYear();
                             const m = String(date.getMonth() + 1).padStart(2, '0');
                             const day = String(date.getDate()).padStart(2, '0');
                             return `${y}-${m}-${day}`;
                           };

                           onUpdateDates(data.taskId, formatYMD(newStart), formatYMD(newDue));
                         } catch (err) {
                           console.error('Drop error:', err);
                         }
                       }}
                     />
                   );
                })}

                {/* タスクバーの描画 */}
                {startIndex !== null && startIndex >= 0 && (
                  <div
                    onClick={() => onEditTask(task)}
                    className={`my-2 mx-1 rounded-md shadow-sm flex items-center px-2 text-[10px] font-bold text-white truncate transition-all relative z-10
                      ${isViewer ? 'cursor-pointer hover:opacity-90' : 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-indigo-400 hover:ring-offset-1'}
                      ${isDragging ? 'pointer-events-none' : ''}`}
                    style={{
                      gridRow: rowIndex + 2, // どの行に描画するか
                      gridColumn: `${startIndex + 2} / span ${duration}`, // 何列目から、何列分またがるか
                      backgroundColor: isDone ? '#94a3b8' : '#6366f1' // 完了と未完了の色の指定
                    }}
                    title={`${task.title} (${task.start_date} ~ ${task.due_date ? task.due_date.split('T')[0] : '未定'})`}
                    draggable={!isViewer}
                    onDragStart={(e) => {
                      if (isViewer) {
                        e.preventDefault();
                        return;
                      }
                      // ドラッグ開始時に、対象のタスク情報を格納する
                      // タスクの開始日から何マス目(何日目)の部分を掴んだかを計算
                      // 画面全体の座標(clientX)と要素の左端座標の差分を使用
                      const rect = e.currentTarget.getBoundingClientRect();
                      const preciseOffsetX = e.clientX - rect.left;
                      // mx-1 (4px) の左マージンがあるため、+4 してから 40px(1マスの幅) で割る
                      const grabOffsetDays = Math.floor((preciseOffsetX + 4) / 40);
                      e.dataTransfer.setData('application/json', JSON.stringify({
                        taskId: task.id,
                        startDate: task.start_date,
                        dueDate: task.due_date,
                        grabOffsetDays: grabOffsetDays
                      }));
                      e.currentTarget.style.opacity = '0.5'; // ドラッグ中は半透明に
                      setTimeout(() => setIsDragging(true), 0);
                    }}
                    onDragEnd={(e) => {
                      e.currentTarget.style.opacity = '1';
                      setIsDragging(false);
                    }}
                  >
                    {task.title}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
