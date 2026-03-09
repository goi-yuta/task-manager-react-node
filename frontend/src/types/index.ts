export const TASK_STATUS = {
  TODO: 'TODO',
  DOING: 'DOING',
  DONE: 'DONE',
} as const;

export type TaskStatus = typeof TASK_STATUS[keyof typeof TASK_STATUS];

export interface Task {
  id: number;
  title: string;
  status: TaskStatus;
  assignee_name: string | null;
  project_name?: string;
}

export interface UserData {
  id: number;
  name: string;
}

export type SortOrder = 'default' | 'asc' | 'desc';
