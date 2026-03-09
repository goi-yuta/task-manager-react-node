import { Pool } from 'pg';
import * as dotenv from 'dotenv';

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

    // 依存関係があるため tasks -> projects / users の順番で削除
    await client.query('DROP TABLE IF EXISTS tasks;');
    await client.query('DROP TABLE IF EXISTS projects;');
    await client.query('DROP TABLE IF EXISTS users;');
    console.log('🗑️ Old tables dropped.');

    // 1. users テーブル作成
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "users" created.');

    // 2. projects テーブル作成
    await client.query(`
      CREATE TABLE projects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "projects" created.');

    // 3. tasks テーブル作成 (status と deleted_at カラムを含む)
    await client.query(`
      CREATE TABLE tasks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT DEFAULT 'TODO',
        due_date TIMESTAMP,
        project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP -- 論理削除用カラムを追加
      );
    `);
    console.log('✅ Table "tasks" created.');

    // --- テストデータの投入 (Seed) ---

    const userRes = await client.query(`
      INSERT INTO users (name, email)
      VALUES ('山田太郎', 'yamada@example.com')
      RETURNING id;
    `);
    const userId = userRes.rows[0].id;

    const projectRes = await client.query(`
      INSERT INTO projects (name, description)
      VALUES ('メインプロジェクト', '最初のプロジェクトです')
      RETURNING id;
    `);
    const projectId = projectRes.rows[0].id;

    await client.query(`
      INSERT INTO tasks (title, status, project_id, assignee_id) VALUES
      ('Reactコンポーネントの実装', 'TODO', $1, $2),
      ('Node.js APIの構築', 'DONE', $1, $2),
      ('CORS設定の有効化', 'DONE', $1, $2);
    `, [projectId, userId]);

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
