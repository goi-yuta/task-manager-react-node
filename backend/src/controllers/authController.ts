import { Request, Response } from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
// dotenv をインポートして追加
import * as dotenv from 'dotenv';

// 確実に環境変数を読み込む
dotenv.config();

// setup_db.ts と同じように、.envが読み込めなかった時のための安全なデフォルト値を設定
const pool = new Pool({
  user: process.env.DB_USER || 'admin',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'task_manager_db',
  password: process.env.DB_PASSWORD || 'password123',
  port: parseInt(process.env.DB_PORT || '5432'),
});

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export const authController = {
  // サインアップ（テナント作成 ＋ ユーザー作成）はスーパーadmin専用！
  async signup(req: Request, res: Response): Promise<void> {
    // 💡 1. スーパーadminの合言葉チェック
    const superAdminKey = req.headers['x-super-admin-key'];
    const expectedKey = process.env.SUPER_ADMIN_KEY || 'my_super_secret_key_123';

    if (superAdminKey !== expectedKey) {
      res.status(403).json({ error: '権限がありません。組織の作成はシステム管理者のみ可能です。' });
      return;
    }

    // 💡 2. 通常の入力値チェック
    const { tenantName, userName, email, password } = req.body;

    if (!tenantName || !userName || !email || !password) {
      res.status(400).json({ error: 'すべての項目を入力してください' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. テナントの作成
      const tenantRes = await client.query(
        'INSERT INTO tenants (name) VALUES ($1) RETURNING id',
        [tenantName]
      );
      const tenantId = tenantRes.rows[0].id;

      // 2. パスワードのハッシュ化
      const passwordHash = await bcrypt.hash(password, 10);

      // 3. ユーザーの作成
      const userRes = await client.query(
        'INSERT INTO users (tenant_id, name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, name, email',
        [tenantId, userName, email, passwordHash]
      );
      const user = userRes.rows[0];

      await client.query('COMMIT');

      // 4. JWTの発行 (ペイロードに tenant_id と user_id を含める)
      const token = jwt.sign(
        { userId: user.id, tenantId: tenantId },
        JWT_SECRET,
        { expiresIn: '1d' } // 1日で有効期限切れ
      );

      res.status(201).json({
        message: 'ユーザー登録が完了しました',
        token,
        user
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      if (err.code === '23505') { // PostgreSQLの一意制約違反エラーコード
        res.status(409).json({ error: 'このメールアドレスは既に登録されています' });
      } else {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
      }
    } finally {
      client.release();
    }
  },

  // ログイン
  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'メールアドレスとパスワードを入力してください' });
      return;
    }

    try {
      // 1. ユーザーの検索
      const userRes = await pool.query(
        'SELECT id, tenant_id, name, email, password_hash FROM users WHERE email = $1',
        [email]
      );

      if (userRes.rows.length === 0) {
        res.status(401).json({ error: 'メールアドレスまたはパスワードが間違っています' });
        return;
      }

      const user = userRes.rows[0];

      // 2. パスワードの照合
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        res.status(401).json({ error: 'メールアドレスまたはパスワードが間違っています' });
        return;
      }

      // 3. JWTの発行
      const token = jwt.sign(
        { userId: user.id, tenantId: user.tenant_id },
        JWT_SECRET,
        { expiresIn: '1d' }
      );

      // パスワードハッシュは返却データから除外
      delete user.password_hash;

      res.json({
        message: 'ログインに成功しました',
        token,
        user
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
  }
};
