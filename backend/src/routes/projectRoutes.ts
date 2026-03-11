import { Router } from 'express';
import { projectController } from '../controllers/projectController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// 💡 プロジェクトAPIにも関所（ミドルウェア）を適用
router.use(authenticateToken);

router.get('/', projectController.getAllProjects);
router.post('/', projectController.createProject);
router.put('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

export default router;
