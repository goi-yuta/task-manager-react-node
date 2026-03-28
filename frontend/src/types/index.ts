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
  start_date?: string | null;
  due_date?: string | null;
  description?: string | null;
  assignee_id: number | null;
  assignee_name: string | null;
  project_id: number;
  project_name?: string;
}

export interface UserData {
  id: number;
  name: string;
  email: string;
  tenant_id: number;
}

export interface ProjectData {
  id: number;
  name: string;
  description: string;
  role?: string;
}

export type SortOrder = 'default' | 'asc' | 'desc';

export type ProjectMember = {
  id: number;
  name: string;
  email: string;
  role: 'Owner' | 'Editor' | 'Viewer';
  joined_at: string;
};
