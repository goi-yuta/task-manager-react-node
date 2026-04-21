import { Router } from 'express';
import { userController } from '../controllers/userController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// 💡 ユーザーAPIにも関所（ミドルウェア）を適用
router.use(authenticateToken);

// GET /users -> メンバー一覧取得
router.get('/', userController.getAllUsers);

// POST /users/invite -> メンバー招待（新規追加）
router.post('/invite', userController.inviteUser);

// GET /users/notifications/unread-count -> 未読通知件数取得
router.get('/notifications/unread-count', userController.getUnreadCount);

// GET /users/notifications -> 通知リスト取得
router.get('/notifications', userController.getNotifications);

// POST /users/notifications/tasks/:taskId/read -> 特定タスクの通知を既読にする
router.post('/notifications/tasks/:taskId/read', userController.markTaskNotificationsAsRead);

// POST /users/notifications/read -> 全ての通知を既読にする
router.post('/notifications/read', userController.markNotificationsAsRead);

export default router;
