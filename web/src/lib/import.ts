import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { projects, scripts, scriptEpisodes, assets, episodes, timeSlots, assetSlots, pipelineStages } from '@/lib/db/schema';
import { parseScript, parseAssetList, parseEpisode } from '@/lib/markdown/parser';
import { eq } from 'drizzle-orm';
import type { MarkdownFormat } from '@/types';

/** 项目根目录（web/ 的上级） */
export function getProjectRoot(): string {
  return path.resolve(process.cwd(), '..');
}

/** 扫描所有 *项目/ 文件夹 */
export function scanProjectFolders(): string[] {
  const root = getProjectRoot();
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory() && e.name.endsWith('项目'))
    .map(e => e.name);
}

/** 导入单个项目 */
export async function importProject(folderName: string): Promise<number> {
  const root = getProjectRoot();
  const projectDir = path.join(root, folderName);

  if (!fs.existsSync(projectDir)) {
    throw new Error(`项目文件夹不存在: ${folderName}`);
  }

  const files = fs.readdirSync(projectDir);

  // 查找关键文件
  const scriptFile = files.find(f => f.endsWith('_剧本.md') || f.endsWith('剧本.md'));
  const assetFile = files.find(f => f.endsWith('_素材清单.md') || f.endsWith('素材清单.md'));
  const episodeFiles = files
    .filter(f => /_E\d{2}_分镜\.md$/.test(f) || /分镜脚本\.md$/.test(f) || /分镜全集\.md$/.test(f))
    .sort();

  // 解析剧本获取项目参数
  let projectName = folderName.replace('项目', '');
  let style = '';
  let aspectRatio = '9:16';
  let emotionalTone = '';
  let episodeDuration = '15秒';
  let totalEpisodes = episodeFiles.length;

  let parsedScript = null;
  let scriptMarkdown = '';
  let scriptFilePath = '';

  if (scriptFile) {
    scriptFilePath = path.join(projectDir, scriptFile);
    scriptMarkdown = fs.readFileSync(scriptFilePath, 'utf-8');
    parsedScript = parseScript(scriptMarkdown);
    projectName = parsedScript.title || projectName;
    style = parsedScript.params['视觉风格'] || '';
    aspectRatio = parsedScript.params['画幅比例'] || '9:16';
    emotionalTone = parsedScript.params['情感基调'] || '';
    episodeDuration = parsedScript.params['每集时长'] || '15秒';
    const epCountStr = parsedScript.params['总集数'] || '';
    const epCount = parseInt(epCountStr);
    if (!isNaN(epCount)) totalEpisodes = epCount;
  }

  // 解析素材清单获取风格
  let parsedAssets = null;
  let markdownFormat: MarkdownFormat = 'linchong';
  if (assetFile) {
    const assetMarkdown = fs.readFileSync(path.join(projectDir, assetFile), 'utf-8');
    parsedAssets = parseAssetList(assetMarkdown);
    if (!style && parsedAssets.stylePrefix) {
      style = parsedAssets.stylePrefix;
    }
    // 检测格式：崖山格式使用 > **画面描述** 引用块 + 代码块
    if (assetMarkdown.includes('> **画面描述**') || assetMarkdown.includes('> **生成提示词**')) {
      markdownFormat = 'yashan';
    }
  }

  // 插入项目
  const project = db.insert(projects).values({
    name: projectName,
    folderName,
    style,
    aspectRatio,
    emotionalTone,
    episodeDuration,
    totalEpisodes,
    status: 'completed',
    markdownFormat,
  }).returning().get();

  const projectId = project.id;

  // 插入剧本
  if (parsedScript && scriptFile) {
    const script = db.insert(scripts).values({
      projectId,
      rawMarkdown: scriptMarkdown,
      filePath: scriptFilePath,
    }).returning().get();

    // 插入各集摘要
    for (const ep of parsedScript.episodes) {
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
  }

  // 插入素材
  if (parsedAssets) {
    for (const asset of parsedAssets.assets) {
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
  }

  // 插入分镜
  for (const epFile of episodeFiles) {
    const epPath = path.join(projectDir, epFile);
    const epMarkdown = fs.readFileSync(epPath, 'utf-8');

    // 对于 "分镜全集" 或 "分镜脚本"，可能包含多集
    if (epFile.includes('全集') || epFile.includes('分镜脚本')) {
      // 按 # E0X 或 ## E0X 分割
      const epSections = epMarkdown.split(/(?=^#\s+E\d{2})/m);
      for (const section of epSections) {
        if (!section.trim()) continue;
        importSingleEpisode(projectId, section, epPath);
      }
    } else {
      importSingleEpisode(projectId, epMarkdown, epPath);
    }
  }

  // 初始化流程阶段
  const stages: Array<'script' | 'assets' | 'images' | 'storyboard' | 'video'> = [
    'script', 'assets', 'images', 'storyboard', 'video',
  ];
  for (const stage of stages) {
    let status: 'pending' | 'completed' = 'pending';
    if (stage === 'script' && scriptFile) status = 'completed';
    if (stage === 'assets' && assetFile) status = 'completed';
    if (stage === 'storyboard' && episodeFiles.length > 0) status = 'completed';

    db.insert(pipelineStages).values({
      projectId,
      stage,
      status,
    }).run();
  }

  return projectId;
}

function importSingleEpisode(projectId: number, markdown: string, filePath: string) {
  const parsed = parseEpisode(markdown);
  if (parsed.episodeNumber === 0 && !parsed.title) return;

  const episode = db.insert(episodes).values({
    projectId,
    episodeNumber: parsed.episodeNumber,
    title: parsed.title,
    rawMarkdown: markdown,
    filePath,
    styleLine: parsed.styleLine,
    soundDesign: parsed.soundDesign,
    referenceList: parsed.referenceList,
    endFrameDescription: parsed.endFrameDescription,
    rawPrompt: parsed.rawPrompt,
  }).returning().get();

  // 插入时段
  for (const slot of parsed.timeSlots) {
    db.insert(timeSlots).values({
      episodeId: episode.id,
      startSecond: slot.startSecond,
      endSecond: slot.endSecond,
      cameraMovement: slot.cameraMovement,
      description: slot.description,
    }).run();
  }

  // 插入素材槽位
  for (const slot of parsed.assetSlots) {
    db.insert(assetSlots).values({
      episodeId: episode.id,
      slotNumber: slot.slotNumber,
      slotType: slot.slotType,
      assetCode: slot.assetCode,
      description: slot.description,
    }).run();
  }
}

/** 导入所有项目 */
export async function importAllProjects(): Promise<{ imported: string[]; skipped: string[] }> {
  const folders = scanProjectFolders();
  const imported: string[] = [];
  const skipped: string[] = [];

  for (const folder of folders) {
    // 检查是否已导入
    const existing = db.select().from(projects).where(eq(projects.folderName, folder)).all();
    if (existing.length > 0) {
      skipped.push(folder);
      continue;
    }
    try {
      await importProject(folder);
      imported.push(folder);
    } catch (e) {
      console.error(`导入失败: ${folder}`, e);
      skipped.push(folder);
    }
  }

  return { imported, skipped };
}
