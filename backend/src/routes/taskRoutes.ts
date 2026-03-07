import { Router } from 'express';
import {
  getAllTasks,
  createTask,
  updateTaskStatus,
  deleteTask
} from '../controllers/taskController';

const router = Router();

// 一覧取得 (GET /tasks)
router.get('/', getAllTasks);

// 新規作成 (POST /tasks)
router.post('/', createTask);

// 更新 (PUT /tasks/:taskId)
router.put('/:taskId', updateTaskStatus);

// 論理削除 (DELETE /tasks/:taskId)
router.delete('/:taskId', deleteTask);

export default router;
