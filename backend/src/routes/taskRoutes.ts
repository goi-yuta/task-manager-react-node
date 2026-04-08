import { Router } from 'express';
import { taskController } from '../controllers/taskController';
import { authenticateToken } from '../middleware/authMiddleware';
import { upload } from '../middleware/uploadMiddleware';

const router = Router();

// router.use() を使うことで、これより下に書かれたすべてのルートに
// 自動的に authenticateToken（身分証チェック）が適用。
router.use(authenticateToken);

// 各エンドポイント（処理自体は taskController に任せる）
router.get('/', taskController.getAllTasks);
router.post('/', taskController.createTask);
router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

router.get('/:id/comments', taskController.getComments);
router.post('/:id/comments', taskController.addComment);

router.get('/:id/attachments', taskController.getAttachments);
router.post('/:id/attachments', upload.single('file'), taskController.uploadAttachment);
router.delete('/:id/attachments/:attachmentId', taskController.deleteAttachment);

export default router;
