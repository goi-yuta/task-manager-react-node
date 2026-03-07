import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'admin',
  host: 'localhost',
  database: process.env.POSTGRES_DB || 'task_manager_db',
  password: process.env.POSTGRES_PASSWORD || 'password123',
  port: 5432,
});

async function setup() {
  try {
    // SQLファイルを読み込む
    // __dirname は現在のファイル(src/setup_db.ts)の場所。
    // そこから ../db/schema.sql を探しに行きます。
    const sqlPath = path.join(__dirname, '../db/schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('🔄 Database setup started...');
    await pool.query(sql);
    console.log('✅ Database setup completed successfully!');
  } catch (err) {
    console.error('❌ Error executing SQL:', err);
  } finally {
    await pool.end();
  }
}

setup();
