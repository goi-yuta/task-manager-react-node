import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import bcrypt from 'bcrypt'; // bcrypt をインポート

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

    // 依存関係を考慮して削除 (子テーブルから先に削除)
    await client.query('DROP TABLE IF EXISTS project_members;');
    await client.query('DROP TABLE IF EXISTS tasks;');
    await client.query('DROP TABLE IF EXISTS projects;');
    await client.query('DROP TABLE IF EXISTS users;');
    await client.query('DROP TABLE IF EXISTS tenants;');
    console.log('🗑️ Old tables dropped.');

    // 0. tenants テーブル作成
    await client.query(`
      CREATE TABLE tenants (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "tenants" created.');

    // 1. users テーブル作成 (tenant_id, password_hash を追加)
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "users" created.');

    // 2. projects テーブル作成 (tenant_id, created_by を追加)
    await client.query(`
      CREATE TABLE projects (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "projects" created.');

    // 3. tasks テーブル作成 (tenant_id を追加)
    await client.query(`
      CREATE TABLE tasks (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        status TEXT DEFAULT 'TODO',
        due_date TIMESTAMP,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );
    `);
    console.log('✅ Table "tasks" created.');

    // 4. project_members テーブル作成
    await client.query(`
      CREATE TABLE project_members (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'Viewer',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, user_id)
      );
    `);
    console.log('✅ Table "project_members" created.');

    // --- テストデータの投入 ---
    // ① テナントの作成
    const tenantRes = await client.query(`
      INSERT INTO tenants (name) VALUES ('株式会社テスト') RETURNING id;
    `);
    const tenantId = tenantRes.rows[0].id;

    // ② ユーザーの作成 (bcryptを使って実際のパスワードをハッシュ化)
    const plainPassword = 'password123'; // テスト用のパスワード
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(plainPassword, saltRounds);

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

    // ④ プロジェクトメンバーとしての紐付け (Owner権限)
    await client.query(`
      INSERT INTO project_members (project_id, user_id, role)
      VALUES ($1, $2, 'Owner');
    `, [projectId, userId]);

    // ⑤ タスクの作成
    await client.query(`
      INSERT INTO tasks (tenant_id, title, status, project_id, assignee_id, created_by, due_date) VALUES
      ($1, 'Reactコンポーネントの実装', 'TODO', $2, $3, $3, CURRENT_TIMESTAMP + INTERVAL '1 day'),
      ($1, 'Node.js APIの構築', 'DONE', $2, $3, $3, CURRENT_TIMESTAMP + INTERVAL '2 days'),
      ($1, 'CORS設定の有効化', 'DONE', $2, $3, $3, CURRENT_TIMESTAMP + INTERVAL '3 days');
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
