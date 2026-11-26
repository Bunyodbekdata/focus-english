import crypto from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client, type InValue } from "@libsql/client";
import { SEED_READING_LIBRARY } from "./seed-reading";
import { deleteSafeUploadByRelativePath, getDataDir } from "./storage";
import type {
  CefrLevel,
  DashboardPayload,
  LearningMaterial,
  MaterialType,
  NoteItem,
  ReadingCategory,
  ReadingPassage,
  SpeakingAssessment,
  SpeakingSession,
  ThemeId,
  UserProfile,
  VocabularyEntry,
  WritingAssessment,
  WritingSession,
} from "./types";

const DEFAULT_USER_ID = "local-learner-1";

declare global {
  var __focusLibsqlClient: Client | undefined;
  var __focusDbInitPromise: Promise<void> | undefined;
}

function createLibsqlClient(): Client {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (tursoUrl) {
    return createClient({
      url: tursoUrl,
      authToken: tursoAuthToken || undefined,
    });
  }

  if (process.env.VERCEL) {
    throw new Error(
      "Turso database is not configured on Vercel. Add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Vercel Environment Variables."
    );
  }

  const dbPath = path.join(getDataDir(), "focus-english.db");
  return createClient({
    url: pathToFileURL(dbPath).href,
  });
}

function getClient(): Client {
  if (!globalThis.__focusLibsqlClient) {
    globalThis.__focusLibsqlClient = createLibsqlClient();
  }
  return globalThis.__focusLibsqlClient;
}

async function ensureInitialized(): Promise<Client> {
  const client = getClient();
  if (!globalThis.__focusDbInitPromise) {
    globalThis.__focusDbInitPromise = (async () => {
      await initSchema(client);
      await seedDefaults(client);
    })().catch((err) => {
      // Allow retry if initial connection failed transiently
      globalThis.__focusDbInitPromise = undefined;
      throw err;
    });
  }
  await globalThis.__focusDbInitPromise;
  return client;
}

async function initSchema(client: Client): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      target_level TEXT NOT NULL DEFAULT 'B2',
      native_language TEXT NOT NULL DEFAULT 'Uzbek',
      reading_width TEXT NOT NULL DEFAULT 'medium',
      reading_font_size TEXT NOT NULL DEFAULT 'md',
      theme TEXT NOT NULL DEFAULT 'sage',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS learning_materials (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      source_url TEXT,
      video_id TEXT,
      thumbnail_url TEXT,
      file_path TEXT,
      progress_percent INTEGER NOT NULL DEFAULT 0,
      last_position_seconds INTEGER NOT NULL DEFAULT 0,
      last_opened_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      material_id TEXT,
      material_type TEXT NOT NULL DEFAULT 'general',
      material_title TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS vocabulary (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      word TEXT NOT NULL,
      meaning_uz TEXT NOT NULL,
      example TEXT NOT NULL DEFAULT '',
      personal_note TEXT NOT NULL DEFAULT '',
      source_material_id TEXT,
      source_title TEXT NOT NULL DEFAULT '',
      source_type TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS reading_library (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      cefr_level TEXT NOT NULL,
      category TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      word_count INTEGER NOT NULL,
      estimated_minutes INTEGER NOT NULL,
      pdf_path TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS speaking_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      exam_type TEXT NOT NULL,
      level_or_part TEXT NOT NULL,
      prompt_question TEXT NOT NULL,
      audio_path TEXT,
      audio_mime_type TEXT,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      transcript TEXT,
      assessment_json TEXT,
      status TEXT NOT NULL DEFAULT 'recorded',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS writing_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      exam_type TEXT NOT NULL,
      level_or_task TEXT NOT NULL,
      prompt_title TEXT NOT NULL,
      prompt_text TEXT NOT NULL,
      answer_text TEXT NOT NULL,
      word_count INTEGER NOT NULL DEFAULT 0,
      assessment_json TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_materials_user_opened ON learning_materials(user_id, last_opened_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_notes_user_updated ON notes(user_id, updated_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_notes_material ON notes(material_id)`,
    `CREATE INDEX IF NOT EXISTS idx_vocab_user_created ON vocabulary(user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_reading_level_cat ON reading_library(cefr_level, category)`,
    `CREATE INDEX IF NOT EXISTS idx_speaking_user ON speaking_sessions(user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_writing_user ON writing_sessions(user_id, updated_at DESC)`,
  ];

  await client.batch(statements, "write");

  // Safe migration for pre-existing local SQLite databases missing the theme column
  try {
    await client.execute(
      "ALTER TABLE users ADD COLUMN theme TEXT NOT NULL DEFAULT 'sage'"
    );
  } catch {
    // column already exists
  }
}

async function seedDefaults(client: Client): Promise<void> {
  const now = new Date().toISOString();

  await client.execute({
    sql: `INSERT OR IGNORE INTO users
      (id, name, email, target_level, native_language, reading_width, reading_font_size, theme, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      DEFAULT_USER_ID,
      "Learner",
      "",
      "B2",
      "Uzbek",
      "medium",
      "md",
      "sage",
      now,
      now,
    ],
  });

  const readingBatch = SEED_READING_LIBRARY.map((article) => {
    const words = article.content.trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.round(words / 180));
    return {
      sql: `INSERT OR IGNORE INTO reading_library
        (id, title, cefr_level, category, summary, content, word_count, estimated_minutes, pdf_path, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      args: [
        article.id,
        article.title,
        article.cefrLevel,
        article.category,
        article.summary,
        article.content,
        words,
        minutes,
        now,
      ] as InValue[],
    };
  });

  await client.batch(readingBatch, "write");
}

// --- Row Mappers ---

type DbRow = Record<string, unknown>;

function mapUser(row: DbRow): UserProfile {
  const rawTheme = String(row.theme ?? "sage");
  const validTheme: ThemeId =
    rawTheme === "ocean" ||
    rawTheme === "warm" ||
    rawTheme === "lavender" ||
    rawTheme === "forest"
      ? rawTheme
      : "sage";

  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email ?? ""),
    targetLevel: String(row.target_level) as CefrLevel,
    nativeLanguage: String(row.native_language ?? "Uzbek"),
    readingWidth: String(
      row.reading_width ?? "medium"
    ) as UserProfile["readingWidth"],
    readingFontSize: String(
      row.reading_font_size ?? "md"
    ) as UserProfile["readingFontSize"],
    theme: validTheme,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapMaterial(row: DbRow): LearningMaterial {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    type: String(row.type) as MaterialType,
    title: String(row.title),
    sourceUrl: row.source_url ? String(row.source_url) : null,
    videoId: row.video_id ? String(row.video_id) : null,
    thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
    filePath: row.file_path ? String(row.file_path) : null,
    progressPercent: Number(row.progress_percent ?? 0),
    lastPositionSeconds: Number(row.last_position_seconds ?? 0),
    lastOpenedAt: String(row.last_opened_at),
    createdAt: String(row.created_at),
  };
}

function mapNote(row: DbRow): NoteItem {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    materialId: row.material_id ? String(row.material_id) : null,
    materialType: String(row.material_type ?? "general") as NoteItem["materialType"],
    materialTitle: String(row.material_title ?? ""),
    title: String(row.title),
    content: String(row.content ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapVocabulary(row: DbRow): VocabularyEntry {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    word: String(row.word),
    meaningUz: String(row.meaning_uz),
    example: String(row.example ?? ""),
    personalNote: String(row.personal_note ?? ""),
    sourceMaterialId: row.source_material_id
      ? String(row.source_material_id)
      : null,
    sourceTitle: String(row.source_title ?? ""),
    sourceType: String(row.source_type ?? "manual") as VocabularyEntry["sourceType"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapReading(row: DbRow): ReadingPassage {
  return {
    id: String(row.id),
    title: String(row.title),
    cefrLevel: String(row.cefr_level) as CefrLevel,
    category: String(row.category) as ReadingCategory,
    summary: String(row.summary),
    content: String(row.content),
    wordCount: Number(row.word_count),
    estimatedMinutes: Number(row.estimated_minutes),
    pdfPath: row.pdf_path ? String(row.pdf_path) : null,
    createdAt: String(row.created_at),
  };
}

function safeParseJson<T>(raw: unknown): T | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function mapSpeaking(row: DbRow): SpeakingSession {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    examType: String(row.exam_type) as SpeakingSession["examType"],
    levelOrPart: String(row.level_or_part),
    promptQuestion: String(row.prompt_question),
    audioPath: row.audio_path ? String(row.audio_path) : null,
    audioMimeType: row.audio_mime_type ? String(row.audio_mime_type) : null,
    durationSeconds: Number(row.duration_seconds ?? 0),
    transcript: row.transcript ? String(row.transcript) : null,
    assessment: safeParseJson<SpeakingAssessment>(row.assessment_json),
    status: String(row.status) as SpeakingSession["status"],
    createdAt: String(row.created_at),
  };
}

function mapWriting(row: DbRow): WritingSession {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    examType: String(row.exam_type) as WritingSession["examType"],
    levelOrTask: String(row.level_or_task),
    promptTitle: String(row.prompt_title),
    promptText: String(row.prompt_text),
    answerText: String(row.answer_text),
    wordCount: Number(row.word_count ?? 0),
    assessment: safeParseJson<WritingAssessment>(row.assessment_json),
    status: String(row.status) as WritingSession["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

// --- User / Settings ---

export async function getUserProfile(): Promise<UserProfile> {
  const db = await ensureInitialized();
  const res = await db.execute({
    sql: "SELECT * FROM users WHERE id = ?",
    args: [DEFAULT_USER_ID],
  });
  return mapUser(res.rows[0] as unknown as DbRow);
}

export async function updateUserProfile(input: {
  name?: string;
  email?: string;
  targetLevel?: CefrLevel;
  nativeLanguage?: string;
  readingWidth?: UserProfile["readingWidth"];
  readingFontSize?: UserProfile["readingFontSize"];
  theme?: ThemeId;
}): Promise<UserProfile> {
  const db = await ensureInitialized();
  const current = await getUserProfile();
  const now = new Date().toISOString();

  await db.execute({
    sql: `UPDATE users
     SET name = ?, email = ?, target_level = ?, native_language = ?,
         reading_width = ?, reading_font_size = ?, theme = ?, updated_at = ?
     WHERE id = ?`,
    args: [
      input.name?.trim() || current.name,
      input.email !== undefined ? input.email.trim() : current.email,
      input.targetLevel ?? current.targetLevel,
      input.nativeLanguage?.trim() || current.nativeLanguage,
      input.readingWidth ?? current.readingWidth,
      input.readingFontSize ?? current.readingFontSize,
      input.theme ?? current.theme,
      now,
      DEFAULT_USER_ID,
    ],
  });

  return getUserProfile();
}

// --- Learning Materials ---

export async function listLearningMaterials(
  type?: MaterialType
): Promise<LearningMaterial[]> {
  const db = await ensureInitialized();
  const res = type
    ? await db.execute({
        sql: "SELECT * FROM learning_materials WHERE user_id = ? AND type = ? ORDER BY last_opened_at DESC",
        args: [DEFAULT_USER_ID, type],
      })
    : await db.execute({
        sql: "SELECT * FROM learning_materials WHERE user_id = ? ORDER BY last_opened_at DESC",
        args: [DEFAULT_USER_ID],
      });
  return res.rows.map((r) => mapMaterial(r as unknown as DbRow));
}

export async function getLearningMaterialById(
  id: string
): Promise<LearningMaterial | null> {
  const db = await ensureInitialized();
  const res = await db.execute({
    sql: "SELECT * FROM learning_materials WHERE id = ? AND user_id = ?",
    args: [id, DEFAULT_USER_ID],
  });
  const row = res.rows[0];
  return row ? mapMaterial(row as unknown as DbRow) : null;
}

export async function upsertYouTubeMaterial(input: {
  videoId: string;
  sourceUrl: string;
  title: string;
  thumbnailUrl: string;
}): Promise<LearningMaterial> {
  const db = await ensureInitialized();
  const now = new Date().toISOString();

  const existing = await db.execute({
    sql: "SELECT id FROM learning_materials WHERE user_id = ? AND type = 'youtube' AND video_id = ?",
    args: [DEFAULT_USER_ID, input.videoId],
  });

  if (existing.rows[0]) {
    const existingId = String(existing.rows[0].id);
    await db.execute({
      sql: `UPDATE learning_materials
       SET title = ?, source_url = ?, thumbnail_url = ?, last_opened_at = ?
       WHERE id = ?`,
      args: [input.title, input.sourceUrl, input.thumbnailUrl, now, existingId],
    });
    return (await getLearningMaterialById(existingId))!;
  }

  const id = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO learning_materials
      (id, user_id, type, title, source_url, video_id, thumbnail_url, file_path, progress_percent, last_position_seconds, last_opened_at, created_at)
     VALUES (?, ?, 'youtube', ?, ?, ?, ?, NULL, 0, 0, ?, ?)`,
    args: [
      id,
      DEFAULT_USER_ID,
      input.title,
      input.sourceUrl,
      input.videoId,
      input.thumbnailUrl,
      now,
      now,
    ],
  });

  return (await getLearningMaterialById(id))!;
}

export async function createPdfMaterial(input: {
  title: string;
  filePath: string;
}): Promise<LearningMaterial> {
  const db = await ensureInitialized();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO learning_materials
      (id, user_id, type, title, source_url, video_id, thumbnail_url, file_path, progress_percent, last_position_seconds, last_opened_at, created_at)
     VALUES (?, ?, 'pdf', ?, NULL, NULL, NULL, ?, 0, 0, ?, ?)`,
    args: [id, DEFAULT_USER_ID, input.title, input.filePath, now, now],
  });

  return (await getLearningMaterialById(id))!;
}

export async function upsertReadingMaterialHistory(input: {
  readingId: string;
  title: string;
  progressPercent?: number;
}): Promise<LearningMaterial> {
  const db = await ensureInitialized();
  const now = new Date().toISOString();

  const existing = await db.execute({
    sql: "SELECT id, progress_percent FROM learning_materials WHERE user_id = ? AND type = 'reading' AND source_url = ?",
    args: [DEFAULT_USER_ID, input.readingId],
  });

  if (existing.rows[0]) {
    const existingId = String(existing.rows[0].id);
    const progress =
      input.progressPercent !== undefined
        ? Math.max(0, Math.min(100, Math.round(input.progressPercent)))
        : Number(existing.rows[0].progress_percent ?? 0);
    await db.execute({
      sql: "UPDATE learning_materials SET title = ?, progress_percent = ?, last_opened_at = ? WHERE id = ?",
      args: [input.title, progress, now, existingId],
    });
    return (await getLearningMaterialById(existingId))!;
  }

  const id = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO learning_materials
      (id, user_id, type, title, source_url, video_id, thumbnail_url, file_path, progress_percent, last_position_seconds, last_opened_at, created_at)
     VALUES (?, ?, 'reading', ?, ?, NULL, NULL, NULL, ?, 0, ?, ?)`,
    args: [
      id,
      DEFAULT_USER_ID,
      input.title,
      input.readingId,
      input.progressPercent ?? 10,
      now,
      now,
    ],
  });

  return (await getLearningMaterialById(id))!;
}

export async function updateMaterialProgress(
  id: string,
  input: {
    progressPercent?: number;
    lastPositionSeconds?: number;
    title?: string;
  }
): Promise<LearningMaterial | null> {
  const db = await ensureInitialized();
  const existing = await getLearningMaterialById(id);
  if (!existing) return null;
  const now = new Date().toISOString();

  const progress =
    input.progressPercent !== undefined
      ? Math.max(0, Math.min(100, Math.round(input.progressPercent)))
      : existing.progressPercent;
  const pos =
    input.lastPositionSeconds !== undefined
      ? Math.max(0, Math.round(input.lastPositionSeconds))
      : existing.lastPositionSeconds;

  await db.execute({
    sql: `UPDATE learning_materials
     SET title = ?, progress_percent = ?, last_position_seconds = ?, last_opened_at = ?
     WHERE id = ? AND user_id = ?`,
    args: [
      input.title?.trim() || existing.title,
      progress,
      pos,
      now,
      id,
      DEFAULT_USER_ID,
    ],
  });

  return getLearningMaterialById(id);
}

export async function deleteLearningMaterial(id: string): Promise<boolean> {
  const db = await ensureInitialized();
  const existing = await getLearningMaterialById(id);
  if (!existing) return false;
  const res = await db.execute({
    sql: "DELETE FROM learning_materials WHERE id = ? AND user_id = ?",
    args: [id, DEFAULT_USER_ID],
  });
  if (res.rowsAffected > 0) {
    if (existing.filePath) {
      await deleteSafeUploadByRelativePath(existing.filePath);
    }
    return true;
  }
  return false;
}

// --- Notes ---

export async function listNotes(filters?: {
  materialId?: string;
  materialType?: string;
  limit?: number;
}): Promise<NoteItem[]> {
  const db = await ensureInitialized();
  const clauses = ["user_id = ?"];
  const args: InValue[] = [DEFAULT_USER_ID];

  if (filters?.materialId) {
    clauses.push("material_id = ?");
    args.push(filters.materialId);
  }
  if (filters?.materialType) {
    clauses.push("material_type = ?");
    args.push(filters.materialType);
  }

  let sql = `SELECT * FROM notes WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC`;
  if (filters?.limit && filters.limit > 0) {
    sql += ` LIMIT ${Math.min(100, Math.floor(filters.limit))}`;
  }

  const res = await db.execute({ sql, args });
  return res.rows.map((r) => mapNote(r as unknown as DbRow));
}

export async function getNoteById(id: string): Promise<NoteItem | null> {
  const db = await ensureInitialized();
  const res = await db.execute({
    sql: "SELECT * FROM notes WHERE id = ? AND user_id = ?",
    args: [id, DEFAULT_USER_ID],
  });
  const row = res.rows[0];
  return row ? mapNote(row as unknown as DbRow) : null;
}

export async function createNote(input: {
  materialId?: string | null;
  materialType?: NoteItem["materialType"];
  materialTitle?: string;
  title: string;
  content: string;
}): Promise<NoteItem> {
  const db = await ensureInitialized();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO notes (id, user_id, material_id, material_type, material_title, title, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      DEFAULT_USER_ID,
      input.materialId ?? null,
      input.materialType ?? "general",
      input.materialTitle ?? "",
      input.title.trim() || "Untitled note",
      input.content,
      now,
      now,
    ],
  });

  return (await getNoteById(id))!;
}

export async function updateNote(
  id: string,
  input: { title?: string; content?: string }
): Promise<NoteItem | null> {
  const db = await ensureInitialized();
  const existing = await getNoteById(id);
  if (!existing) return null;
  const now = new Date().toISOString();

  await db.execute({
    sql: "UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    args: [
      input.title !== undefined
        ? input.title.trim() || "Untitled note"
        : existing.title,
      input.content !== undefined ? input.content : existing.content,
      now,
      id,
      DEFAULT_USER_ID,
    ],
  });

  return getNoteById(id);
}

export async function deleteNote(id: string): Promise<boolean> {
  const db = await ensureInitialized();
  const res = await db.execute({
    sql: "DELETE FROM notes WHERE id = ? AND user_id = ?",
    args: [id, DEFAULT_USER_ID],
  });
  return res.rowsAffected > 0;
}

// --- Vocabulary ---

export async function listVocabulary(filters?: {
  query?: string;
  sourceMaterialId?: string;
  sourceType?: string;
}): Promise<VocabularyEntry[]> {
  const db = await ensureInitialized();
  const clauses = ["user_id = ?"];
  const args: InValue[] = [DEFAULT_USER_ID];

  if (filters?.sourceMaterialId) {
    clauses.push("source_material_id = ?");
    args.push(filters.sourceMaterialId);
  }
  if (filters?.sourceType && filters.sourceType !== "all") {
    clauses.push("source_type = ?");
    args.push(filters.sourceType);
  }
  if (filters?.query?.trim()) {
    const q = `%${filters.query.trim().toLowerCase()}%`;
    clauses.push(
      "(LOWER(word) LIKE ? OR LOWER(meaning_uz) LIKE ? OR LOWER(example) LIKE ? OR LOWER(personal_note) LIKE ? OR LOWER(source_title) LIKE ?)"
    );
    args.push(q, q, q, q, q);
  }

  const res = await db.execute({
    sql: `SELECT * FROM vocabulary WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC`,
    args,
  });

  return res.rows.map((r) => mapVocabulary(r as unknown as DbRow));
}

export async function getVocabularyById(
  id: string
): Promise<VocabularyEntry | null> {
  const db = await ensureInitialized();
  const res = await db.execute({
    sql: "SELECT * FROM vocabulary WHERE id = ? AND user_id = ?",
    args: [id, DEFAULT_USER_ID],
  });
  const row = res.rows[0];
  return row ? mapVocabulary(row as unknown as DbRow) : null;
}

export async function createVocabulary(input: {
  word: string;
  meaningUz: string;
  example?: string;
  personalNote?: string;
  sourceMaterialId?: string | null;
  sourceTitle?: string;
  sourceType?: VocabularyEntry["sourceType"];
}): Promise<VocabularyEntry> {
  const db = await ensureInitialized();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO vocabulary
      (id, user_id, word, meaning_uz, example, personal_note, source_material_id, source_title, source_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      DEFAULT_USER_ID,
      input.word.trim(),
      input.meaningUz.trim(),
      input.example?.trim() ?? "",
      input.personalNote?.trim() ?? "",
      input.sourceMaterialId ?? null,
      input.sourceTitle?.trim() ?? "",
      input.sourceType ?? "manual",
      now,
      now,
    ],
  });

  return (await getVocabularyById(id))!;
}

export async function updateVocabulary(
  id: string,
  input: {
    word?: string;
    meaningUz?: string;
    example?: string;
    personalNote?: string;
  }
): Promise<VocabularyEntry | null> {
  const db = await ensureInitialized();
  const existing = await getVocabularyById(id);
  if (!existing) return null;
  const now = new Date().toISOString();

  await db.execute({
    sql: `UPDATE vocabulary
     SET word = ?, meaning_uz = ?, example = ?, personal_note = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    args: [
      input.word !== undefined ? input.word.trim() : existing.word,
      input.meaningUz !== undefined
        ? input.meaningUz.trim()
        : existing.meaningUz,
      input.example !== undefined ? input.example.trim() : existing.example,
      input.personalNote !== undefined
        ? input.personalNote.trim()
        : existing.personalNote,
      now,
      id,
      DEFAULT_USER_ID,
    ],
  });

  return getVocabularyById(id);
}

export async function deleteVocabulary(id: string): Promise<boolean> {
  const db = await ensureInitialized();
  const res = await db.execute({
    sql: "DELETE FROM vocabulary WHERE id = ? AND user_id = ?",
    args: [id, DEFAULT_USER_ID],
  });
  return res.rowsAffected > 0;
}

export async function countVocabulary(): Promise<number> {
  const db = await ensureInitialized();
  const res = await db.execute({
    sql: "SELECT COUNT(*) as total FROM vocabulary WHERE user_id = ?",
    args: [DEFAULT_USER_ID],
  });
  return Number(res.rows[0]?.total ?? 0);
}

// --- Reading Library ---

export async function listReadingLibrary(filters?: {
  cefrLevel?: string;
  category?: string;
  query?: string;
}): Promise<ReadingPassage[]> {
  const db = await ensureInitialized();
  const clauses: string[] = [];
  const args: InValue[] = [];

  if (filters?.cefrLevel && filters.cefrLevel !== "ALL") {
    clauses.push("cefr_level = ?");
    args.push(filters.cefrLevel);
  }
  if (filters?.category && filters.category !== "ALL") {
    clauses.push("category = ?");
    args.push(filters.category);
  }
  if (filters?.query?.trim()) {
    const q = `%${filters.query.trim().toLowerCase()}%`;
    clauses.push("(LOWER(title) LIKE ? OR LOWER(summary) LIKE ?)");
    args.push(q, q);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const res = await db.execute({
    sql: `SELECT * FROM reading_library ${where}
       ORDER BY CASE cefr_level
         WHEN 'A1' THEN 1 WHEN 'A2' THEN 2 WHEN 'B1' THEN 3
         WHEN 'B2' THEN 4 WHEN 'C1' THEN 5 WHEN 'C2' THEN 6 ELSE 7 END,
         title ASC`,
    args,
  });

  return res.rows.map((r) => mapReading(r as unknown as DbRow));
}

export async function getReadingById(
  id: string
): Promise<ReadingPassage | null> {
  const db = await ensureInitialized();
  const res = await db.execute({
    sql: "SELECT * FROM reading_library WHERE id = ?",
    args: [id],
  });
  const row = res.rows[0];
  return row ? mapReading(row as unknown as DbRow) : null;
}

export async function addReadingPassage(input: {
  title: string;
  cefrLevel: CefrLevel;
  category: ReadingCategory;
  summary: string;
  content: string;
  pdfPath?: string | null;
}): Promise<ReadingPassage> {
  const db = await ensureInitialized();
  const id = `reading-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const words = input.content.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 180));

  await db.execute({
    sql: `INSERT INTO reading_library
      (id, title, cefr_level, category, summary, content, word_count, estimated_minutes, pdf_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.title.trim(),
      input.cefrLevel,
      input.category,
      input.summary.trim(),
      input.content.trim(),
      words,
      minutes,
      input.pdfPath ?? null,
      now,
    ],
  });

  return (await getReadingById(id))!;
}

// --- Speaking Sessions ---

export async function listSpeakingSessions(
  limit = 20
): Promise<SpeakingSession[]> {
  const db = await ensureInitialized();
  const res = await db.execute({
    sql: "SELECT * FROM speaking_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    args: [DEFAULT_USER_ID, Math.min(50, limit)],
  });
  return res.rows.map((r) => mapSpeaking(r as unknown as DbRow));
}

export async function createSpeakingSession(input: {
  examType: "ielts" | "cefr";
  levelOrPart: string;
  promptQuestion: string;
  audioPath: string | null;
  audioMimeType: string | null;
  durationSeconds: number;
  transcript: string | null;
  assessment: SpeakingAssessment | null;
  status: SpeakingSession["status"];
}): Promise<SpeakingSession> {
  const db = await ensureInitialized();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO speaking_sessions
      (id, user_id, exam_type, level_or_part, prompt_question, audio_path, audio_mime_type, duration_seconds, transcript, assessment_json, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      DEFAULT_USER_ID,
      input.examType,
      input.levelOrPart,
      input.promptQuestion,
      input.audioPath,
      input.audioMimeType,
      Math.max(0, Math.round(input.durationSeconds)),
      input.transcript,
      input.assessment ? JSON.stringify(input.assessment) : null,
      input.status,
      now,
    ],
  });

  const res = await db.execute({
    sql: "SELECT * FROM speaking_sessions WHERE id = ?",
    args: [id],
  });
  return mapSpeaking(res.rows[0] as unknown as DbRow);
}

export async function deleteSpeakingSession(id: string): Promise<boolean> {
  const db = await ensureInitialized();
  const existing = await db.execute({
    sql: "SELECT audio_path FROM speaking_sessions WHERE id = ? AND user_id = ?",
    args: [id, DEFAULT_USER_ID],
  });
  if (!existing.rows[0]) return false;

  const audioPath = existing.rows[0].audio_path
    ? String(existing.rows[0].audio_path)
    : null;
  const res = await db.execute({
    sql: "DELETE FROM speaking_sessions WHERE id = ? AND user_id = ?",
    args: [id, DEFAULT_USER_ID],
  });
  if (res.rowsAffected > 0) {
    if (audioPath) {
      await deleteSafeUploadByRelativePath(audioPath);
    }
    return true;
  }
  return false;
}

// --- Writing Sessions ---

export async function listWritingSessions(
  limit = 20
): Promise<WritingSession[]> {
  const db = await ensureInitialized();
  const res = await db.execute({
    sql: "SELECT * FROM writing_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?",
    args: [DEFAULT_USER_ID, Math.min(50, limit)],
  });
  return res.rows.map((r) => mapWriting(r as unknown as DbRow));
}

export async function createWritingSession(input: {
  examType: WritingSession["examType"];
  levelOrTask: string;
  promptTitle: string;
  promptText: string;
  answerText: string;
  wordCount: number;
  assessment: WritingAssessment | null;
  status: WritingSession["status"];
}): Promise<WritingSession> {
  const db = await ensureInitialized();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO writing_sessions
      (id, user_id, exam_type, level_or_task, prompt_title, prompt_text, answer_text, word_count, assessment_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      DEFAULT_USER_ID,
      input.examType,
      input.levelOrTask,
      input.promptTitle,
      input.promptText,
      input.answerText,
      input.wordCount,
      input.assessment ? JSON.stringify(input.assessment) : null,
      input.status,
      now,
      now,
    ],
  });

  const res = await db.execute({
    sql: "SELECT * FROM writing_sessions WHERE id = ?",
    args: [id],
  });
  return mapWriting(res.rows[0] as unknown as DbRow);
}

export async function deleteWritingSession(id: string): Promise<boolean> {
  const db = await ensureInitialized();
  const res = await db.execute({
    sql: "DELETE FROM writing_sessions WHERE id = ? AND user_id = ?",
    args: [id, DEFAULT_USER_ID],
  });
  return res.rowsAffected > 0;
}

// --- Dashboard ---

export async function getDashboardData(): Promise<DashboardPayload> {
  const [user, allMaterials, recentNotes, vocabularyCount] = await Promise.all([
    getUserProfile(),
    listLearningMaterials(),
    listNotes({ limit: 5 }),
    countVocabulary(),
  ]);
  const recentMaterials = allMaterials.slice(0, 6);
  const continueLearning = recentMaterials[0] ?? null;

  return {
    user,
    continueLearning,
    recentNotes,
    vocabularyCount,
    recentMaterials,
  };
}
