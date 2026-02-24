// Markdown 格式类型
export type MarkdownFormat = 'linchong' | 'yashan';

// 项目
export interface Project {
  id: number;
  name: string;
  folderName: string;
  style: string;
  aspectRatio: string;
  emotionalTone: string;
  episodeDuration: string;
  totalEpisodes: number;
  status: 'draft' | 'in_progress' | 'completed';
  markdownFormat: MarkdownFormat;
  createdAt: string;
  updatedAt: string;
}

// 剧本
export interface Script {
  id: number;
  projectId: number;
  rawMarkdown: string;
  filePath: string;
}

// 剧本中的集摘要
export interface ScriptEpisode {
  id: number;
  scriptId: number;
  episodeNumber: number;
  title: string;
  emotionalTone: string;
  keyPlots: string[];
  openingFrame: string;
  closingFrame: string;
}

// 素材类型
export type AssetType = 'character' | 'scene' | 'prop';

// 素材
export interface Asset {
  id: number;
  projectId: number;
  code: string;       // C01, S01, P01 etc.
  type: AssetType;
  name: string;        // 中文名
  prompt: string;      // 英文生成 prompt
  description?: string; // 中文画面描述（崖山格式）
  imagePath?: string;
  usedInEpisodes: string; // JSON array: ["E1","E2"]
}

// 分镜集
export interface Episode {
  id: number;
  projectId: number;
  episodeNumber: number;
  title: string;
  rawMarkdown: string;
  filePath: string;
  styleLine: string;
  soundDesign: string;
  referenceList: string;
  endFrameDescription: string;
}

// 时段
export interface TimeSlot {
  id: number;
  episodeId: number;
  startSecond: number;  // 0, 3, 6, 9, 12
  endSecond: number;    // 3, 6, 9, 12, 15
  cameraMovement: string;
  description: string;
}

// 素材槽位
export interface AssetSlot {
  id: number;
  episodeId: number;
  slotNumber: number;  // 1-9 for images, 1-3 for videos
  slotType: 'image' | 'video';
  assetCode: string;   // C01, S01 etc.
  description: string;
}

// 流程阶段
export type PipelineStageType = 'script' | 'assets' | 'images' | 'storyboard' | 'video';
export type PipelineStatus = 'pending' | 'in_progress' | 'completed' | 'needs_revision';

export interface PipelineStage {
  id: number;
  projectId: number;
  stage: PipelineStageType;
  status: PipelineStatus;
  updatedAt: string;
}

// Markdown 解析结果
export interface ParsedScript {
  title: string;
  params: Record<string, string>;
  episodes: Omit<ScriptEpisode, 'id' | 'scriptId'>[];
  emotionalArc?: string;
  colorPlan?: Array<{ episode: string; colors: string; mood: string }>;
}

export interface ParsedAssetList {
  stylePrefix: string;
  assets: Omit<Asset, 'id' | 'projectId'>[];
  summary?: Array<{ category: string; count: string; usage: string }>;
}

export interface ParsedEpisode {
  title: string;
  episodeNumber: number;
  assetSlots: Omit<AssetSlot, 'id' | 'episodeId'>[];
  styleLine: string;
  timeSlots: Omit<TimeSlot, 'id' | 'episodeId'>[];
  soundDesign: string;
  referenceList: string;
  endFrameDescription: string;
  rawPrompt: string;
}
