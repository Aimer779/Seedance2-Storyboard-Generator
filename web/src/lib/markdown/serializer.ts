import type {
  ParsedScript,
  ParsedEpisode,
  MarkdownFormat,
  Asset,
} from '@/types';

/**
 * 中文数字映射
 */
function numberToChinese(num: number): string {
  const map: Record<number, string> = {
    1: '一', 2: '二', 3: '三', 4: '四', 5: '五',
    6: '六', 7: '七', 8: '八', 9: '九', 10: '十',
  };
  if (num <= 10) return map[num] || String(num);
  if (num < 20) return '十' + (map[num - 10] || '');
  const tens = Math.floor(num / 10);
  const ones = num % 10;
  return map[tens] + '十' + (ones ? map[ones] : '');
}

/**
 * 序列化剧本为 Markdown
 */
export function serializeScript(parsed: ParsedScript): string {
  const lines: string[] = [];

  lines.push(`# ${parsed.title} - 剧本`);
  lines.push('');
  lines.push('## 制作参数');
  lines.push('');
  lines.push('| 参数 | 值 |');
  lines.push('|------|-----|');
  for (const [key, value] of Object.entries(parsed.params)) {
    lines.push(`| ${key} | ${value} |`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 剧本结构');
  lines.push('');

  for (const ep of parsed.episodes) {
    const cnNum = numberToChinese(ep.episodeNumber);
    lines.push(`### 第${cnNum}集：${ep.title}`);
    lines.push('');
    if (ep.emotionalTone) {
      lines.push(`**情感基调：** ${ep.emotionalTone}`);
      lines.push('');
    }
    lines.push('**关键情节：**');
    for (const plot of ep.keyPlots) {
      lines.push(`- ${plot}`);
    }
    lines.push('');
    if (ep.openingFrame) {
      lines.push(`**首帧画面：** ${ep.openingFrame}`);
      lines.push('');
    }
    if (ep.closingFrame) {
      lines.push(`**尾帧画面：** ${ep.closingFrame}`);
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  // 情感弧线
  if (parsed.emotionalArc) {
    lines.push('## 情感弧线');
    lines.push('');
    lines.push('```');
    lines.push(parsed.emotionalArc);
    lines.push('```');
    lines.push('');
  }

  // 色彩规划
  if (parsed.colorPlan && parsed.colorPlan.length > 0) {
    lines.push('## 色彩规划');
    lines.push('');
    lines.push('| 集数 | 主色调 | 情绪 |');
    lines.push('|------|--------|------|');
    for (const c of parsed.colorPlan) {
      lines.push(`| ${c.episode} | ${c.colors} | ${c.mood} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 获取素材类型的中文分类标题
 */
function getAssetCategoryTitle(type: string): string {
  switch (type) {
    case 'character': return '角色类素材 (Characters)';
    case 'scene': return '场景类素材 (Scenes)';
    case 'prop': return '道具类素材 (Props)';
    default: return '其他素材';
  }
}

/**
 * 序列化素材清单为 Markdown
 */
export function serializeAssetList(
  stylePrefix: string,
  assetList: Array<Omit<Asset, 'id' | 'projectId'>>,
  format: MarkdownFormat = 'linchong'
): string {
  const lines: string[] = [];
  const title = '素材清单';

  lines.push(`# ${title}`);
  lines.push('');
  lines.push(format === 'yashan' ? '## 统一风格前缀' : '## 风格前缀（适用于所有素材）');
  lines.push('');
  lines.push('```');
  lines.push(stylePrefix);
  lines.push('```');
  lines.push('');
  lines.push('---');
  lines.push('');

  // Group assets by type
  const groups: Record<string, typeof assetList> = {
    character: [],
    scene: [],
    prop: [],
  };
  for (const asset of assetList) {
    const type = asset.type || 'character';
    if (!groups[type]) groups[type] = [];
    groups[type].push(asset);
  }

  for (const type of ['character', 'scene', 'prop']) {
    const group = groups[type];
    if (!group || group.length === 0) continue;

    lines.push(`## ${getAssetCategoryTitle(type)}`);
    lines.push('');

    for (const asset of group) {
      const separator = format === 'yashan' ? '-' : '—';
      lines.push(`### ${asset.code} ${separator} ${asset.name}`);
      lines.push('');

      if (format === 'yashan') {
        // 崖山格式：引用块 + 代码块
        if (asset.description) {
          lines.push(`> **画面描述**：${asset.description}`);
          lines.push('>');
        }
        lines.push('> **生成提示词**：');
        lines.push('> ```');
        lines.push(`> ${asset.prompt}`);
        lines.push('> ```');
      } else {
        // 林冲格式：直接纯英文段落
        lines.push(asset.prompt);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  // 素材编号总览表
  lines.push('## 素材编号总览');
  lines.push('');
  lines.push('| 编号 | 类型 | 名称 | 用于集数 |');
  lines.push('|------|------|------|----------|');
  const typeLabels: Record<string, string> = {
    character: '角色', scene: '场景', prop: '道具',
  };
  for (const asset of assetList) {
    const eps = (() => {
      try {
        const arr = typeof asset.usedInEpisodes === 'string'
          ? JSON.parse(asset.usedInEpisodes)
          : asset.usedInEpisodes;
        return Array.isArray(arr) ? arr.join(', ') : '';
      } catch {
        return '';
      }
    })();
    lines.push(`| ${asset.code} | ${typeLabels[asset.type] || asset.type} | ${asset.name} | ${eps} |`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * 序列化分镜为 Markdown
 */
export function serializeEpisode(
  episode: ParsedEpisode,
  format: MarkdownFormat = 'linchong'
): string {
  const lines: string[] = [];
  const epNum = String(episode.episodeNumber).padStart(2, '0');

  lines.push(`# E${epNum} - ${episode.title}`);
  lines.push('');
  lines.push('## 素材上传清单');
  lines.push('');

  if (format === 'yashan') {
    lines.push('| 上传位置 | 素材ID | 素材描述 |');
    lines.push('|----------|--------|----------|');
    for (const slot of episode.assetSlots) {
      const typeLabel = slot.slotType === 'video' ? '视频' : '图片';
      lines.push(`| @${typeLabel}${slot.slotNumber} | ${slot.assetCode} | ${slot.description} |`);
    }
  } else {
    lines.push('| 素材槽 | 文件 | 说明 |');
    lines.push('|--------|------|------|');
    for (const slot of episode.assetSlots) {
      const typeLabel = slot.slotType === 'video' ? '视频' : '图片';
      lines.push(`| ${typeLabel}${slot.slotNumber} | ${slot.assetCode} | ${slot.description} |`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Seedance Prompt');
  lines.push('');

  if (format === 'yashan') {
    // 崖山格式：code block 内
    lines.push('```');
    lines.push(episode.styleLine);
    lines.push('');
    for (const slot of episode.timeSlots) {
      lines.push(`${slot.startSecond}-${slot.endSecond}s: ${slot.description}`);
      lines.push('');
    }
    if (episode.soundDesign) {
      lines.push('音效设计：');
      // 还原多行音效
      const soundParts = episode.soundDesign.split(' | ');
      for (const part of soundParts) {
        lines.push(`- ${part}`);
      }
    }
    lines.push('```');
  } else {
    // 林冲格式：非代码块
    lines.push(episode.styleLine);
    lines.push('');
    for (const slot of episode.timeSlots) {
      lines.push(`**${slot.startSecond}-${slot.endSecond}秒画面：**`);
      lines.push(slot.description);
      lines.push('');
    }
    if (episode.soundDesign) {
      lines.push(`【声音】${episode.soundDesign}`);
    }
    if (episode.referenceList) {
      lines.push(`【参考】${episode.referenceList}`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 尾帧描述');
  lines.push('');
  lines.push(episode.endFrameDescription);
  lines.push('');

  return lines.join('\n');
}
