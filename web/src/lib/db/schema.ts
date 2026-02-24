import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  folderName: text('folder_name').notNull(),
  style: text('style').default(''),
  aspectRatio: text('aspect_ratio').default('9:16'),
  emotionalTone: text('emotional_tone').default(''),
  episodeDuration: text('episode_duration').default('15秒'),
  totalEpisodes: integer('total_episodes').default(0),
  status: text('status', { enum: ['draft', 'in_progress', 'completed'] }).default('draft'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export const scripts = sqliteTable('scripts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  rawMarkdown: text('raw_markdown').default(''),
  filePath: text('file_path').default(''),
});

export const scriptEpisodes = sqliteTable('script_episodes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scriptId: integer('script_id').notNull().references(() => scripts.id, { onDelete: 'cascade' }),
  episodeNumber: integer('episode_number').notNull(),
  title: text('title').default(''),
  emotionalTone: text('emotional_tone').default(''),
  keyPlots: text('key_plots').default('[]'), // JSON array
  openingFrame: text('opening_frame').default(''),
  closingFrame: text('closing_frame').default(''),
});

export const assets = sqliteTable('assets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  code: text('code').notNull(), // C01, S01, P01
  type: text('type', { enum: ['character', 'scene', 'prop'] }).notNull(),
  name: text('name').default(''),
  prompt: text('prompt').default(''),
  description: text('description').default(''),
  imagePath: text('image_path'),
  usedInEpisodes: text('used_in_episodes').default('[]'), // JSON array
});

export const episodes = sqliteTable('episodes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  episodeNumber: integer('episode_number').notNull(),
  title: text('title').default(''),
  rawMarkdown: text('raw_markdown').default(''),
  filePath: text('file_path').default(''),
  styleLine: text('style_line').default(''),
  soundDesign: text('sound_design').default(''),
  referenceList: text('reference_list').default(''),
  endFrameDescription: text('end_frame_description').default(''),
  rawPrompt: text('raw_prompt').default(''),
});

export const timeSlots = sqliteTable('time_slots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  episodeId: integer('episode_id').notNull().references(() => episodes.id, { onDelete: 'cascade' }),
  startSecond: integer('start_second').notNull(),
  endSecond: integer('end_second').notNull(),
  cameraMovement: text('camera_movement').default(''),
  description: text('description').default(''),
});

export const assetSlots = sqliteTable('asset_slots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  episodeId: integer('episode_id').notNull().references(() => episodes.id, { onDelete: 'cascade' }),
  slotNumber: integer('slot_number').notNull(),
  slotType: text('slot_type', { enum: ['image', 'video'] }).default('image'),
  assetCode: text('asset_code').default(''),
  description: text('description').default(''),
});

export const pipelineStages = sqliteTable('pipeline_stages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  stage: text('stage', { enum: ['script', 'assets', 'images', 'storyboard', 'video'] }).notNull(),
  status: text('status', { enum: ['pending', 'in_progress', 'completed', 'needs_revision'] }).default('pending'),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});
