import { db } from '@/lib/db';
import {
  projects, scripts, scriptEpisodes, assets, episodes,
  timeSlots, assetSlots, pipelineStages,
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { parseScript, parseAssetList, parseEpisode } from '@/lib/markdown/parser';
import { syncScriptFile, syncAssetListFile, syncEpisodeFile } from '@/lib/fileSync';

/**
 * 保存 AI 生成的剧本 Markdown
 */
export function saveGeneratedScript(projectId: number, markdown: string): void {
  const parsed = parseScript(markdown);

  // 查找或创建 script 记录
  let script = db.select().from(scripts).where(eq(scripts.projectId, projectId)).get();
  if (!script) {
    script = db.insert(scripts).values({
      projectId,
      rawMarkdown: markdown,
      filePath: '',
    }).returning().get();
  } else {
    db.update(scripts)
      .set({ rawMarkdown: markdown })
      .where(eq(scripts.id, script.id))
      .run();
  }

  // 清除旧的集摘要
  db.delete(scriptEpisodes).where(eq(scriptEpisodes.scriptId, script.id)).run();

  // 插入新的集摘要
  for (const ep of parsed.episodes) {
    db.insert(scriptEpisodes).values({
      scriptId: script.id,
      episodeNumber: ep.episodeNumber,
      title: ep.title,
      emotionalTone: ep.emotionalTone,
      keyPlots: JSON.stringify(ep.keyPlots),
      openingFrame: ep.openingFrame,
      closingFrame: ep.closingFrame,
    }).run();
  }

  // 更新项目参数
  const updates: Record<string, string | number> = {};
  if (parsed.params['视觉风格']) updates.style = parsed.params['视觉风格'];
  if (parsed.params['画幅比例']) updates.aspectRatio = parsed.params['画幅比例'];
  if (parsed.params['情感基调']) updates.emotionalTone = parsed.params['情感基调'];
  if (parsed.params['每集时长']) updates.episodeDuration = parsed.params['每集时长'];
  const epCountStr = parsed.params['总集数'] || '';
  const epCount = parseInt(epCountStr);
  if (!isNaN(epCount)) updates.totalEpisodes = epCount;

  if (Object.keys(updates).length > 0) {
    db.update(projects).set(updates).where(eq(projects.id, projectId)).run();
  }

  // 同步文件
  syncScriptFile(projectId);

  // 更新 pipeline stage
  updatePipelineStage(projectId, 'script', 'completed');
}

/**
 * 保存 AI 生成的素材清单 Markdown
 */
export function saveGeneratedAssets(projectId: number, markdown: string): void {
  const parsed = parseAssetList(markdown);

  // 清除旧素材
  db.delete(assets).where(eq(assets.projectId, projectId)).run();

  // 插入新素材
  for (const asset of parsed.assets) {
    db.insert(assets).values({
      projectId,
      code: asset.code,
      type: asset.type,
      name: asset.name,
      prompt: asset.prompt,
      description: asset.description || '',
      usedInEpisodes: asset.usedInEpisodes,
    }).run();
  }

  // 更新项目风格（如果素材清单有风格前缀）
  if (parsed.stylePrefix) {
    db.update(projects)
      .set({ style: parsed.stylePrefix })
      .where(eq(projects.id, projectId))
      .run();
  }

  // 同步文件
  syncAssetListFile(projectId);

  // 更新 pipeline stage
  updatePipelineStage(projectId, 'assets', 'completed');
}

/**
 * 保存 AI 生成的分镜 Markdown
 */
export function saveGeneratedEpisode(projectId: number, epNumber: number, markdown: string): void {
  const parsed = parseEpisode(markdown);

  // 查找或创建 episode 记录
  let episode = db.select().from(episodes)
    .where(eq(episodes.projectId, projectId))
    .all()
    .find(e => e.episodeNumber === epNumber);

  if (!episode) {
    episode = db.insert(episodes).values({
      projectId,
      episodeNumber: epNumber,
      title: parsed.title,
      rawMarkdown: markdown,
      filePath: '',
      styleLine: parsed.styleLine,
      soundDesign: parsed.soundDesign,
      referenceList: parsed.referenceList,
      endFrameDescription: parsed.endFrameDescription,
      rawPrompt: parsed.rawPrompt,
    }).returning().get();
  } else {
    db.update(episodes)
      .set({
        title: parsed.title,
        rawMarkdown: markdown,
        styleLine: parsed.styleLine,
        soundDesign: parsed.soundDesign,
        referenceList: parsed.referenceList,
        endFrameDescription: parsed.endFrameDescription,
        rawPrompt: parsed.rawPrompt,
      })
      .where(eq(episodes.id, episode.id))
      .run();
  }

  // 清除旧的时段和素材槽位
  db.delete(timeSlots).where(eq(timeSlots.episodeId, episode.id)).run();
  db.delete(assetSlots).where(eq(assetSlots.episodeId, episode.id)).run();

  // 插入新的时段
  for (const slot of parsed.timeSlots) {
    db.insert(timeSlots).values({
      episodeId: episode.id,
      startSecond: slot.startSecond,
      endSecond: slot.endSecond,
      cameraMovement: slot.cameraMovement,
      description: slot.description,
    }).run();
  }

  // 插入新的素材槽位
  for (const slot of parsed.assetSlots) {
    db.insert(assetSlots).values({
      episodeId: episode.id,
      slotNumber: slot.slotNumber,
      slotType: slot.slotType,
      assetCode: slot.assetCode,
      description: slot.description,
    }).run();
  }

  // 同步文件
  syncEpisodeFile(projectId, epNumber);

  // 更新 pipeline stage
  updatePipelineStage(projectId, 'storyboard', 'in_progress');
}

/**
 * 更新 pipeline stage 状态
 */
function updatePipelineStage(
  projectId: number,
  stage: 'script' | 'assets' | 'images' | 'storyboard' | 'video',
  status: 'pending' | 'in_progress' | 'completed' | 'needs_revision'
): void {
  const existing = db.select().from(pipelineStages)
    .where(and(
      eq(pipelineStages.projectId, projectId),
      eq(pipelineStages.stage, stage),
    ))
    .get();

  if (existing) {
    db.update(pipelineStages)
      .set({ status, updatedAt: sql`datetime('now')` })
      .where(eq(pipelineStages.id, existing.id))
      .run();
  } else {
    db.insert(pipelineStages).values({
      projectId,
      stage,
      status,
    }).run();
  }
}
