import nodemailer from 'nodemailer';

// 1. 引数の型定義（インターフェース）
interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string; // HTMLメールはオプション（省略可能）にする
}

// 2. トランスポーター（送信機）の生成
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  // process.envの返り値は string | undefined なので、ポート番号はNumberでキャストする
  port: Number(process.env.MAIL_PORT) || 2525,
  auth: {
    user: process.env.MAIL_USER || '',
    pass: process.env.MAIL_PASS || '',
  },
});

// 3. メール送信の共通関数
export const sendMail = async ({ to, subject, text, html }: MailOptions) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || '"Task Manager Admin" <noreply@example.com>',
      to,
      subject,
      text,
      html,
    });

    console.log(`✉️ メール送信成功: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('❌ メール送信エラー:', error);
    throw error;
  }
};
