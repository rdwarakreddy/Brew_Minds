/**
 * documentController.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   A "document" is either an uploaded FILE (a contract, quotation,
 *   etc.) or a LINK (e.g. a Google Doc URL). Both share the same list/
 *   search/filter UI, so they live in one table (see the
 *   `chk_documents_type_payload` constraint in the schema that enforces
 *   a file has file_path and a link has link_url).
 *
 *   `download` streams the file back ONLY if the requesting user owns
 *   it -- files are never served from a public/static folder, which
 *   would let anyone with a guessed URL download another user's
 *   contract.
 */

const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const { query } = require('../config/db');
const { UPLOAD_DIR } = require('../utils/upload');

// A Client on its own is fine (e.g. a general document about that
// client), but a Project can only be attached if its Client is also
// chosen -- a project floating with no client would be ambiguous on
// the Client's document list. Enforced here (in addition to the DB's
// own CHECK constraint) so the user gets a clear message immediately.
const PROJECT_REQUIRES_CLIENT_MESSAGE = 'Select the Client this project belongs to as well.';

function projectRequiresClientRefinement(data, ctx) {
  if (data.projectId && !data.clientId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: PROJECT_REQUIRES_CLIENT_MESSAGE, path: ['clientId'] });
  }
}

const linkDocumentSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    projectId: z.string().uuid().optional().nullable(),
    clientId: z.string().uuid().optional().nullable(),
    linkUrl: z.string().url('Enter a valid URL'),
  })
  .superRefine(projectRequiresClientRefinement);

const fileDocumentMetaSchema = z
  .object({
    projectId: z.string().uuid().optional().nullable().or(z.literal('')),
    clientId: z.string().uuid().optional().nullable().or(z.literal('')),
  })
  .superRefine(projectRequiresClientRefinement);

function toDocumentDto(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    projectId: row.project_id,
    projectName: row.project_name || null,
    clientId: row.client_id,
    clientName: row.client_name || null,
    linkUrl: row.link_url,
    fileSize: row.file_size ? Number(row.file_size) : null,
    createdAt: row.created_at,
  };
}

const BASE_SELECT = `
  SELECT d.*, p.name AS project_name, c.name AS client_name
  FROM documents d
  LEFT JOIN projects p ON p.id = d.project_id
  LEFT JOIN clients c ON c.id = d.client_id
`;

/** GET /api/documents -- searchable/filterable list */
async function list(req, res) {
  const { search, type, projectId, clientId } = req.query;
  const conditions = ['d.user_id = $1'];
  const params = [req.user.id];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`d.name ILIKE $${params.length}`);
  }
  if (type) {
    params.push(type);
    conditions.push(`d.type = $${params.length}`);
  }
  if (projectId) {
    params.push(projectId);
    conditions.push(`d.project_id = $${params.length}`);
  }
  if (clientId) {
    params.push(clientId);
    conditions.push(`d.client_id = $${params.length}`);
  }

  const result = await query(
    `${BASE_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY d.created_at DESC`,
    params
  );
  res.json({ documents: result.rows.map(toDocumentDto) });
}

/** POST /api/documents/file -- upload button, type = File (multipart/form-data) */
async function createFile(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file was uploaded.' });

  const { name, projectId, clientId } = req.body;
  const metaParsed = fileDocumentMetaSchema.safeParse({ projectId, clientId });
  if (!metaParsed.success) return res.status(400).json({ error: metaParsed.error.errors[0].message });

  const displayName = (name && name.trim()) || req.file.originalname;

  const result = await query(
    `INSERT INTO documents (user_id, project_id, client_id, name, type, file_path, file_size)
     VALUES ($1,$2,$3,$4,'file',$5,$6) RETURNING id`,
    [req.user.id, projectId || null, clientId || null, displayName, req.file.filename, req.file.size]
  );
  const full = await query(`${BASE_SELECT} WHERE d.id = $1`, [result.rows[0].id]);
  res.status(201).json({ document: toDocumentDto(full.rows[0]) });
}

/** POST /api/documents/link -- "Add Document" button, type = Link */
async function createLink(req, res) {
  const parsed = linkDocumentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const d = parsed.data;

  const result = await query(
    `INSERT INTO documents (user_id, project_id, client_id, name, type, link_url)
     VALUES ($1,$2,$3,$4,'link',$5) RETURNING id`,
    [req.user.id, d.projectId || null, d.clientId || null, d.name, d.linkUrl]
  );
  const full = await query(`${BASE_SELECT} WHERE d.id = $1`, [result.rows[0].id]);
  res.status(201).json({ document: toDocumentDto(full.rows[0]) });
}

/** GET /api/documents/:id/download -- streams the file, ownership-checked */
async function download(req, res) {
  const result = await query(
    `SELECT * FROM documents WHERE id = $1 AND user_id = $2 AND type = 'file'`,
    [req.params.id, req.user.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'File not found.' });

  const doc = result.rows[0];
  const filePath = path.join(UPLOAD_DIR, doc.file_path);
  if (!fs.existsSync(filePath)) {
    return res.status(410).json({ error: 'File is no longer available on the server.' });
  }
  res.download(filePath, doc.name);
}

/** DELETE /api/documents/:id */
async function remove(req, res) {
  const result = await query('SELECT * FROM documents WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.user.id,
  ]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Document not found.' });

  const doc = result.rows[0];
  await query('DELETE FROM documents WHERE id = $1', [doc.id]);

  // Clean up the physical file from disk (only relevant for type='file')
  if (doc.type === 'file' && doc.file_path) {
    const filePath = path.join(UPLOAD_DIR, doc.file_path);
    fs.unlink(filePath, () => {}); // best-effort, ignore errors
  }
  res.status(204).send();
}

module.exports = { list, createFile, createLink, download, remove };
