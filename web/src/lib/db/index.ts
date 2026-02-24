import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'seedance.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

// Initialize tables
export function initializeDb() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      folder_name TEXT NOT NULL,
      style TEXT DEFAULT '',
      aspect_ratio TEXT DEFAULT '9:16',
      emotional_tone TEXT DEFAULT '',
      episode_duration TEXT DEFAULT '15秒',
      total_episodes INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft',
      markdown_format TEXT DEFAULT 'linchong',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      raw_markdown TEXT DEFAULT '',
      file_path TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS script_episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      script_id INTEGER NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
      episode_number INTEGER NOT NULL,
      title TEXT DEFAULT '',
      emotional_tone TEXT DEFAULT '',
      key_plots TEXT DEFAULT '[]',
      opening_frame TEXT DEFAULT '',
      closing_frame TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT DEFAULT '',
      prompt TEXT DEFAULT '',
      description TEXT DEFAULT '',
      image_path TEXT,
      used_in_episodes TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      episode_number INTEGER NOT NULL,
      title TEXT DEFAULT '',
      raw_markdown TEXT DEFAULT '',
      file_path TEXT DEFAULT '',
      style_line TEXT DEFAULT '',
      sound_design TEXT DEFAULT '',
      reference_list TEXT DEFAULT '',
      end_frame_description TEXT DEFAULT '',
      raw_prompt TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS time_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
      start_second INTEGER NOT NULL,
      end_second INTEGER NOT NULL,
      camera_movement TEXT DEFAULT '',
      description TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS asset_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
      slot_number INTEGER NOT NULL,
      slot_type TEXT DEFAULT 'image',
      asset_code TEXT DEFAULT '',
      description TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS pipeline_stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migration: add markdown_format column if missing
  try {
    const columns = sqlite.pragma('table_info(projects)') as Array<{ name: string }>;
    if (!columns.find(c => c.name === 'markdown_format')) {
      sqlite.exec(`ALTER TABLE projects ADD COLUMN markdown_format TEXT DEFAULT 'linchong'`);
    }
  } catch {
    // ignore if table doesn't exist yet
  }
}

// Auto-initialize on import
initializeDb();
