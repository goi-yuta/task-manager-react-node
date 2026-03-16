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

export default router;
