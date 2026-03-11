import { Router } from 'express';
import { userController } from '../controllers/userController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// 💡 ユーザーAPIにも関所（ミドルウェア）を適用
router.use(authenticateToken);

// ユーザーの作成（サインアップ）は authRoutes にあるので、ここでは一覧取得などのみ
router.get('/', userController.getAllUsers);

export default router;
