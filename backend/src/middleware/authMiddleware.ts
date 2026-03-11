import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Expressの標準のRequest型を拡張し、user情報を持たせられるようにする
export interface AuthRequest extends Request {
  user?: {
    userId: number;
    tenantId: number;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  // フロントエンドは "Bearer <token>" という形式で送ってくる
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: '認証トークンがありません。ログインしてください。' });
    return;
  }

  // トークンが本物（改ざんされていないか、期限切れでないか）を検証
  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) {
      res.status(403).json({ error: 'トークンが無効または期限切れです。' });
      return;
    }

    // 検証成功、リクエストにユーザー情報を乗せて次の処理（コントローラー）へ進む
    req.user = decodedUser as { userId: number; tenantId: number };
    next();
  });
};
