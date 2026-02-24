import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { projects, scripts, scriptEpisodes, assets, episodes, timeSlots, assetSlots } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { serializeScript, serializeAssetList, serializeEpisode } from '@/lib/markdown/serializer';
import { getProjectRoot } from '@/lib/import';
import type { MarkdownFormat, ParsedScript, ParsedEpisode } from '@/types';

/**
 * 获取项目文件夹路径
 */
function getProjectDir(folderName: string): string {
  return path.join(getProjectRoot(), folderName);
}

/**
 * 创建项目文件夹结构
 */
export function createProjectFolder(project: { name: string; folderName: string }): string {
  const projectDir = getProjectDir(project.folderName);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }
  const assetsDir = path.join(projectDir, '素材');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  return projectDir;
}

/**
 * 同步剧本文件：DB → Markdown
 */
export function syncScriptFile(projectId: number): void {
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) return;

  const script = db.select().from(scripts).where(eq(scripts.projectId, projectId)).get();
  if (!script) return;

  const eps = db.select().from(scriptEpisodes).where(eq(scriptEpisodes.scriptId, script.id)).all();

  const parsed: ParsedScript = {
    title: project.name,
    params: {},
    episodes: eps.map(ep => ({
      episodeNumber: ep.episodeNumber,
      title: ep.title || '',
      emotionalTone: ep.emotionalTone || '',
      keyPlots: JSON.parse(ep.keyPlots || '[]'),
      openingFrame: ep.openingFrame || '',
      closingFrame: ep.closingFrame || '',
    })),
  };

  // Reconstruct params from project fields
  if (project.style) parsed.params['视觉风格'] = project.style;
  if (project.aspectRatio) parsed.params['画幅比例'] = project.aspectRatio;
  if (project.emotionalTone) parsed.params['情感基调'] = project.emotionalTone;
  if (project.episodeDuration) parsed.params['每集时长'] = project.episodeDuration;
  if (project.totalEpisodes) parsed.params['总集数'] = `${project.totalEpisodes}集`;

  const markdown = serializeScript(parsed);

  const projectDir = getProjectDir(project.folderName);
  if (!fs.existsSync(projectDir)) {
    createProjectFolder(project);
  }

  // Find existing script file or create new one
  const scriptFileName = `${project.name}_剧本.md`;
  const filePath = path.join(projectDir, scriptFileName);
  fs.writeFileSync(filePath, markdown, 'utf-8');

  // Update DB file path and raw markdown
  db.update(scripts)
    .set({ filePath, rawMarkdown: markdown })
    .where(eq(scripts.id, script.id))
    .run();
}

/**
 * 同步素材清单文件：DB → Markdown
 */
export function syncAssetListFile(projectId: number): void {
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) return;

  const allAssets = db.select().from(assets).where(eq(assets.projectId, projectId)).all();
  if (allAssets.length === 0) return;

  const format = (project.markdownFormat || 'linchong') as MarkdownFormat;

  const markdown = serializeAssetList(
    project.style || '',
    allAssets.map(a => ({
      code: a.code,
      type: a.type as 'character' | 'scene' | 'prop',
      name: a.name || '',
      prompt: a.prompt || '',
      description: a.description || '',
      usedInEpisodes: a.usedInEpisodes || '[]',
    })),
    format
  );

  const projectDir = getProjectDir(project.folderName);
  if (!fs.existsSync(projectDir)) {
    createProjectFolder(project);
  }

  const fileName = `${project.name}_素材清单.md`;
  const filePath = path.join(projectDir, fileName);
  fs.writeFileSync(filePath, markdown, 'utf-8');
}

/**
 * 同步单集分镜文件：DB → Markdown
 */
export function syncEpisodeFile(projectId: number, episodeNumber: number): void {
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) return;

  const episode = db.select().from(episodes)
    .where(eq(episodes.projectId, projectId))
    .all()
    .find(e => e.episodeNumber === episodeNumber);
  if (!episode) return;

  const slots = db.select().from(timeSlots).where(eq(timeSlots.episodeId, episode.id)).all();
  const aSlots = db.select().from(assetSlots).where(eq(assetSlots.episodeId, episode.id)).all();

  const format = (project.markdownFormat || 'linchong') as MarkdownFormat;

  const parsed: ParsedEpisode = {
    title: episode.title || '',
    episodeNumber: episode.episodeNumber,
    assetSlots: aSlots.map(s => ({
      slotNumber: s.slotNumber,
      slotType: (s.slotType || 'image') as 'image' | 'video',
      assetCode: s.assetCode || '',
      description: s.description || '',
    })),
    styleLine: episode.styleLine || '',
    timeSlots: slots.map(s => ({
      startSecond: s.startSecond,
      endSecond: s.endSecond,
      cameraMovement: s.cameraMovement || '',
      description: s.description || '',
    })),
    soundDesign: episode.soundDesign || '',
    referenceList: episode.referenceList || '',
    endFrameDescription: episode.endFrameDescription || '',
    rawPrompt: episode.rawPrompt || '',
  };

  const markdown = serializeEpisode(parsed, format);

  const projectDir = getProjectDir(project.folderName);
  if (!fs.existsSync(projectDir)) {
    createProjectFolder(project);
  }

  const epNum = String(episodeNumber).padStart(2, '0');
  const fileName = `${project.name}_E${epNum}_分镜.md`;
  const filePath = path.join(projectDir, fileName);
  fs.writeFileSync(filePath, markdown, 'utf-8');

  // Update DB
  db.update(episodes)
    .set({ filePath, rawMarkdown: markdown, rawPrompt: parsed.rawPrompt })
    .where(eq(episodes.id, episode.id))
    .run();
}
