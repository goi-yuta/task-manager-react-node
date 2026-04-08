import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

// uploadsディレクトリが存在しない場合は自動で作成する
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// サーバーのディスクに保存する設定
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 保存先のフォルダを指定
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 同名のファイルの上書きや、日本語ファイル名の文字化けによるエラーを防ぐため、
    // サーバー上の実際のファイル名は「ランダムな16進数 + 元の拡張子」に変換して保存します。
    // 例: a1b2c3d4e5f6.jpg
    const randomName = crypto.randomBytes(16).toString('hex');
    const extension = path.extname(file.originalname);
    cb(null, `${randomName}${extension}`);
  }
});

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

// ファイルのフィルタリング（許可する形式と 10MB のサイズ制限を設定）
export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`許可されていないファイル形式です: ${file.mimetype}`));
    }
  },
});
