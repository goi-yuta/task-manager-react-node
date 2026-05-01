import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || 'admin',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'task_manager_db',
  password: process.env.DB_PASSWORD || 'password123',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function setupDatabase() {
  let client;
  try {
    client = await pool.connect();
    console.log('🔄 Database setup started...');

    // --- 1. schema.sql の読み込みと実行 ---
    const sqlPath = path.join(__dirname, '../db/schema.sql');
    const schemaSql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📜 Executing schema.sql...');
    await client.query(schemaSql);
    console.log('✅ All tables and indexes created.');

    // --- 2. テストデータの投入 ---
    console.log('🌱 Inserting test data...');

    // ① テナントの作成
    const tenantRes = await client.query(`
      INSERT INTO tenants (name) VALUES ('株式会社テスト') RETURNING id;
    `);
    const tenantId = tenantRes.rows[0].id;

    // ② ユーザーの作成
    const passwordHash = await bcrypt.hash('password123', 10);
    const userRes = await client.query(`
      INSERT INTO users (tenant_id, name, email, password_hash)
      VALUES ($1, '山田太郎', 'yamada@example.com', $2) RETURNING id;
    `, [tenantId, passwordHash]);
    const userId = userRes.rows[0].id;

    // ③ プロジェクトの作成
    const projectRes = await client.query(`
      INSERT INTO projects (tenant_id, created_by, name, description)
      VALUES ($1, $2, 'メインプロジェクト', '最初のプロジェクトです') RETURNING id;
    `, [tenantId, userId]);
    const projectId = projectRes.rows[0].id;

    // ④ プロジェクトメンバーとしての紐付け
    await client.query(`
      INSERT INTO project_members (project_id, user_id, role)
      VALUES ($1, $2, 'Owner');
    `, [projectId, userId]);

    // ⑤ タスクの作成（リマインドのテスト用に「今日が期限」のものを入れる）
    await client.query(`
      INSERT INTO tasks (tenant_id, title, status, project_id, assignee_id, created_by, start_date, due_date) VALUES
      ($1, 'バッチ処理の実装確認', 'TODO', $2, $3, $3, CURRENT_DATE, CURRENT_TIMESTAMP),
      ($1, 'まとめメールの動作確認', 'TODO', $2, $3, $3, CURRENT_DATE, CURRENT_TIMESTAMP),
      ($1, 'Reactコンポーネントの実装', 'TODO', $2, $3, $3, CURRENT_DATE, CURRENT_TIMESTAMP + INTERVAL '1 day'),
      ($1, 'Node.js APIの構築', 'DONE', $2, $3, $3, CURRENT_DATE - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '2 days');
    `, [tenantId, projectId, userId]);

    console.log('✅ Test data inserted successfully!');

  } catch (err) {
    console.error('❌ Error during setup:', err);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

setupDatabase().then(() => {
  console.log('🚀 Setup process finished.');
});
