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

router.get('/:id/members', projectController.getProjectMembers);
router.post('/:id/members', projectController.addMember);
router.put('/:id/members/:userId', projectController.updateMemberRole);
router.delete('/:id/members/:userId', projectController.removeMember)

export default router;
