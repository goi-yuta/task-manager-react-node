import { Response } from 'express';
import { Pool } from 'pg';
import { AuthRequest } from '../middleware/authMiddleware';

const pool = new Pool({
  user: process.env.DB_USER || 'admin',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'task_manager_db',
  password: String(process.env.DB_PASSWORD || 'password123'),
  port: parseInt(process.env.DB_PORT || '5432'),
});

export const projectController = {
  // プロジェクト一覧の取得（自テナントのもののみ）
  async getAllProjects(req: AuthRequest, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;
    try {
      const result = await pool.query(`
        SELECT p.*, pm.role
        FROM projects p
        INNER JOIN project_members pm ON p.id = pm.project_id
        WHERE p.tenant_id = $1 AND pm.user_id = $2
        ORDER BY p.id ASC
      `,[tenantId, userId]);
      res.json({ projects: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'プロジェクトの取得に失敗しました' });
    }
  },

  // プロジェクトの作成
  async createProject(req: AuthRequest, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;
    const { name, description } = req.body;

    if (!name) {
      res.status(400).json({ error: 'プロジェクト名は必須です' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. プロジェクト作成
      const result = await pool.query(
        'INSERT INTO projects (tenant_id, created_by, name, description) VALUES ($1, $2, $3, $4) RETURNING *',
        [tenantId, userId, name, description || null]
      );
      const newProject = result.rows[0]

      // 2. 作成者を Owner として project_members に登録
      await client.query(
        'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
        [newProject.id, userId, 'Owner']
      );

      await client.query('COMMIT');
      // 作成したプロジェクトをフロントに返す（role も付ける）
      res.status(201).json({ ...newProject, role: 'Owner' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: 'プロジェクトの作成に失敗しました' });
    } finally {
      client.release();
    }
  },

  // プロジェクトの更新
  async updateProject(req: AuthRequest, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId;
    const projectId = req.params.id;
    const { name, description } = req.body;

    try {
      const result = await pool.query(
        `UPDATE projects
         SET name = COALESCE($1, name),
             description = COALESCE($2, description)
         WHERE id = $3 AND tenant_id = $4
         RETURNING *`,
        [name, description, projectId, tenantId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'プロジェクトが見つからないか、権限がありません' });
        return;
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'プロジェクトの更新に失敗しました' });
    }
  },

  // プロジェクトの削除
  async deleteProject(req: AuthRequest, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId;
    const projectId = req.params.id;

    try {
      const result = await pool.query(
        'DELETE FROM projects WHERE id = $1 AND tenant_id = $2 RETURNING id',
        [projectId, tenantId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'プロジェクトが見つからないか、権限がありません' });
        return;
      }
      res.json({ message: 'プロジェクトを削除しました', id: projectId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'プロジェクトの削除に失敗しました' });
    }
  },

  // メンバー一覧の取得（プロジェクト参加者のみ可能）
  async getProjectMembers(req: AuthRequest, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;
    const projectId = req.params.id;

    try {
      // 1. 自分がこのプロジェクトに参加しているかチェック
      const memberCheck = await pool.query(
        'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, userId]
      );

      if (memberCheck.rows.length === 0) {
        res.status(403).json({ error: 'このプロジェクトにアクセスする権限がありません' });
        return;
      }

      const result = await pool.query(
        `SELECT u.id, u.name, u.email, pm.role, pm.joined_at
         FROM project_members pm
         INNER JOIN users u ON pm.user_id = u.id
         WHERE pm.project_id = $1 AND u.tenant_id = $2
         ORDER BY pm.joined_at ASC`,
        [projectId, tenantId]
      );
      res.json({ members: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'メンバー一覧の取得に失敗しました' });
    }
  },

  // メンバーの追加（Ownerのみ可能）
  async addMember(req: AuthRequest, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId;
    const operatorId = req.user?.userId;
    const projectId = req.params.id;
    const { user_id, role } = req.body;

    if (!user_id || !role) {
      res.status(400).json({ error: 'ユーザーIDと権限（role）は必須です' });
      return;
    }

    try {
      // 2. 操作者がOwnerかチェック
      const ownerCheck = await pool.query(
        'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, operatorId]
      );

      if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].role !== 'Owner') {
        res.status(403).json({ error: 'メンバーを追加する権限がありません（Ownerのみ可能です）' });
        return;
      }

      // 3. 追加対象のユーザーが「同じテナント」に所属しているか絶対確認（他社のユーザーを入れないため）
      const userCheck = await pool.query(
        'SELECT id FROM users WHERE id = $1 AND tenant_id = $2',
        [user_id, tenantId]
      );

      if (userCheck.rows.length === 0) {
        res.status(404).json({ error: '指定されたユーザーが見つからないか、別の組織のユーザーです' });
        return;
      }

      await pool.query(
        'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
        [projectId, user_id, role]
      );
      res.status(202).json({ message: 'メンバーを追加しました' });
    } catch (err: any) {
      if (err.code === '23505') { // PostgreSQLの一意制約違反エラーコード
        res.status(409).json({ error: 'このユーザーは既にプロジェクトに参加しています' });
      } else {
        console.error(err);
        res.status(500).json({ error: 'メンバーの追加に失敗しました' });
      }
    }
  },

  // メンバーの権限変更（Ownerのみ可能）
  async updateMemberRole(req: AuthRequest, res: Response): Promise<void> {
    const operatorId = req.user?.userId;
    const projectId = req.params.id;
    const targetUserId = req.params.userId;
    const { role } = req.body;

    if (!role) {
      res.status(400).json({ error: '権限（role）を指定してください' });
      return;
    }

    try {
      const ownerCheck = await pool.query(
        'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, operatorId]
      );

      if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].role !== 'Owner') {
        res.status(403).json({ error: '権限を変更する権限がありません（Ownerのみ可能です）' });
        return;
      }

      const result = await pool.query(
        'UPDATE project_members SET role = $1 WHERE project_id = $2 AND user_id = $3 RETURNING *',
        [role, projectId, targetUserId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: '対象のメンバーがプロジェクトに見るかりません' });
        return;
      }
      res.json({ message: '権限を変更しました', member: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '権限の変更に失敗しました' });
    }
  },

  // メンバーの削除（Ownerのみ可能）
  async removeMember(req: AuthRequest, res: Response): Promise<void> {
    const operatorId = req.user?.userId;
    const projectId = req.params.id;
    const targetUserId = req.params.userId;

    try {
      const ownerCheck = await pool.query(
        'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, operatorId]
      );

      if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].role !== 'Owner') {
        res.status(403).json({ error: 'メンバーを削除する権限がありません（Ownerのみ可能です）' });
        return;
      }

      const result = await pool.query(
        'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2 RETURNING *',
        [projectId, targetUserId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: '対象のメンバーがプロジェクトに見つかりません' });
        return;
      }
      res.json({ message: 'メンバーをプロジェクトから外しました' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'メンバーの削除に失敗しました' });
    }
  }
};
