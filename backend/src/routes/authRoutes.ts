import { Router } from 'express';
import { authController } from '../controllers/authController';

const router = Router();

// /auth/signup に POSTリクエストが来たら、authController.signup を実行
router.post('/signup', authController.signup);

// /auth/login に POSTリクエストが来たら、authController.login を実行
router.post('/login', authController.login);

export default router;
