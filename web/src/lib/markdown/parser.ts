import type {
  ParsedScript,
  ParsedAssetList,
  ParsedEpisode,
  AssetType,
} from '@/types';

/**
 * 解析剧本 Markdown 文件
 * 格式：制作参数表格 + 各集结构（情感基调、关键情节、首尾帧）
 */
export function parseScript(markdown: string): ParsedScript {
  const result: ParsedScript = {
    title: '',
    params: {},
    episodes: [],
    colorPlan: [],
  };

  // 提取标题
  const titleMatch = markdown.match(/^#\s+(.+?)(?:\s*-\s*剧本)?$/m);
  if (titleMatch) {
    result.title = titleMatch[1].replace(/\s*-\s*剧本$/, '').trim();
  }

  // 提取制作参数表格
  const paramTableRegex = /\|\s*参数\s*\|\s*值\s*\|[\s\S]*?(?=\n---|\n##|\n$)/;
  const paramTableMatch = markdown.match(paramTableRegex);
  if (paramTableMatch) {
    const paramLines = paramTableMatch[0].split('\n');
    for (const line of paramLines) {
      const cellMatch = line.match(/\|\s*(.+?)\s*\|\s*(.+?)\s*\|/);
      if (cellMatch && cellMatch[1] !== '参数' && !cellMatch[1].includes('---')) {
        result.params[cellMatch[1].trim()] = cellMatch[2].trim();
      }
    }
  }

  // 提取各集结构
  const episodeRegex = /###\s*第([一二三四五六七八九十\d]+)集[：:]\s*(.+)/g;
  let episodeMatch;
  const episodeStarts: Array<{ number: number; title: string; index: number }> = [];

  while ((episodeMatch = episodeRegex.exec(markdown)) !== null) {
    const numStr = episodeMatch[1];
    const num = chineseToNumber(numStr);
    episodeStarts.push({
      number: num,
      title: episodeMatch[2].trim(),
      index: episodeMatch.index,
    });
  }

  for (let i = 0; i < episodeStarts.length; i++) {
    const start = episodeStarts[i].index;
    const end = i + 1 < episodeStarts.length
      ? episodeStarts[i + 1].index
      : markdown.indexOf('## 情感弧线', start) !== -1
        ? markdown.indexOf('## 情感弧线', start)
        : markdown.length;

    const section = markdown.substring(start, end);

    const emotionalToneMatch = section.match(/\*\*情感基调[：:]\*\*\s*(.+)/);
    const keyPlotsMatches = section.match(/\*\*关键情节[：:]\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/);
    const openingMatch = section.match(/\*\*首帧画面[：:]\*\*\s*(.+)/);
    const closingMatch = section.match(/\*\*尾帧画面[：:]\*\*\s*(.+)/);

    const keyPlots: string[] = [];
    if (keyPlotsMatches) {
      const plotLines = keyPlotsMatches[1].split('\n');
      for (const line of plotLines) {
        const plotMatch = line.match(/^-\s+(.+)/);
        if (plotMatch) {
          keyPlots.push(plotMatch[1].trim());
        }
      }
    }

    result.episodes.push({
      episodeNumber: episodeStarts[i].number,
      title: episodeStarts[i].title,
      emotionalTone: emotionalToneMatch ? emotionalToneMatch[1].trim() : '',
      keyPlots,
      openingFrame: openingMatch ? openingMatch[1].trim() : '',
      closingFrame: closingMatch ? closingMatch[1].trim() : '',
    });
  }

  // 提取色彩规划
  const colorRegex = /\|\s*E(\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/g;
  let colorMatch;
  while ((colorMatch = colorRegex.exec(markdown)) !== null) {
    result.colorPlan!.push({
      episode: `E${colorMatch[1]}`,
      colors: colorMatch[2].trim(),
      mood: colorMatch[3].trim(),
    });
  }

  // 提取情感弧线
  const arcMatch = markdown.match(/```\s*\n(.+?→.+?)\n/);
  if (arcMatch) {
    result.emotionalArc = arcMatch[1].trim();
  }

  return result;
}

/**
 * 解析素材清单 Markdown
 * 兼容两种格式：
 * - 林冲格式：### CXX — 名称 + 纯英文 prompt
 * - 崖山格式：### CXX - 名称 + > 画面描述 + > 生成提示词 (code block)
 */
export function parseAssetList(markdown: string): ParsedAssetList {
  const result: ParsedAssetList = {
    stylePrefix: '',
    assets: [],
    summary: [],
  };

  // 提取风格前缀
  const stylePrefixMatch = markdown.match(
    /(?:风格前缀|统一风格前缀)[^]*?```\s*\n([\s\S]*?)```/
  );
  if (stylePrefixMatch) {
    result.stylePrefix = stylePrefixMatch[1].trim();
  }

  // 确定格式类型
  const isQuotedFormat = markdown.includes('> **画面描述**') || markdown.includes('> **生成提示词**');

  // 解析素材条目
  const assetRegex = /###\s+([CSP]\d{2})\s*[—-]\s*(.+)/g;
  let match;
  const assetStarts: Array<{ code: string; name: string; index: number }> = [];

  while ((match = assetRegex.exec(markdown)) !== null) {
    assetStarts.push({
      code: match[1],
      name: match[2].trim(),
      index: match.index,
    });
  }

  for (let i = 0; i < assetStarts.length; i++) {
    const start = assetStarts[i].index;
    const end = i + 1 < assetStarts.length
      ? assetStarts[i + 1].index
      : markdown.length;
    const section = markdown.substring(start, end);

    const code = assetStarts[i].code;
    const type = getAssetType(code);
    let prompt = '';
    let description = '';

    if (isQuotedFormat) {
      // 崖山格式：提取 > 块中的画面描述和 code block 中的 prompt
      const descMatch = section.match(/>\s*\*\*画面描述\*\*[：:]\s*([\s\S]*?)(?=>\s*\*\*生成提示词|$)/);
      if (descMatch) {
        description = descMatch[1]
          .split('\n')
          .map(l => l.replace(/^>\s*/, '').trim())
          .filter(Boolean)
          .join(' ');
      }

      const promptMatch = section.match(/```\s*\n([\s\S]*?)```/);
      if (promptMatch) {
        prompt = promptMatch[1].trim();
      }
    } else {
      // 林冲格式：### 标题后直接是英文 prompt
      const contentStart = section.indexOf('\n');
      if (contentStart !== -1) {
        const content = section.substring(contentStart).trim();
        // 跳过空行，取到下一个 ### 或 --- 或 ## 之前的内容
        const promptLines: string[] = [];
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed.startsWith('###') || trimmed.startsWith('##') || trimmed === '---') break;
          if (trimmed) promptLines.push(trimmed);
        }
        prompt = promptLines.join(' ');
      }
    }

    // 查找素材总览表中的引用集数
    const usageMatch = markdown.match(
      new RegExp(`\\|\\s*${code}\\s*\\|[^|]*\\|[^|]*\\|\\s*([^|]+)\\|`)
    );
    const usedInEpisodes = usageMatch
      ? usageMatch[1].trim().split(/[,，、]\s*/).map(e => e.trim())
      : [];

    result.assets.push({
      code,
      type,
      name: assetStarts[i].name,
      prompt,
      description,
      usedInEpisodes: JSON.stringify(usedInEpisodes),
    });
  }

  // 解析素材使用总结表
  const summaryRegex = /\|\s*(角色素材|场景素材|道具素材|角色|场景|道具)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/g;
  let summaryMatch;
  while ((summaryMatch = summaryRegex.exec(markdown)) !== null) {
    result.summary!.push({
      category: summaryMatch[1],
      count: summaryMatch[2].trim(),
      usage: summaryMatch[3].trim(),
    });
  }

  return result;
}

/**
 * 解析分镜 Markdown
 * 兼容两种格式：
 * - 林冲格式：非 code block，使用 **X-Xs画面：** 标记
 * - 崖山格式：code block 内，使用 X-Xs: 标记
 */
export function parseEpisode(markdown: string): ParsedEpisode {
  const result: ParsedEpisode = {
    title: '',
    episodeNumber: 0,
    assetSlots: [],
    styleLine: '',
    timeSlots: [],
    soundDesign: '',
    referenceList: '',
    endFrameDescription: '',
    rawPrompt: '',
  };

  // 提取标题和集数
  const titleMatch = markdown.match(/^#\s+(?:E(\d+)\s*-\s*)?(.+)/m);
  if (titleMatch) {
    result.episodeNumber = titleMatch[1] ? parseInt(titleMatch[1]) : 0;
    result.title = titleMatch[2].trim();
  }

  // 从文件名模式提取集数（备选）
  const fileEpMatch = markdown.match(/E(\d{2})/);
  if (result.episodeNumber === 0 && fileEpMatch) {
    result.episodeNumber = parseInt(fileEpMatch[1]);
  }

  // 解析素材上传清单表格
  const tableRegex = /\|\s*(?:素材槽|上传位置)\s*\|[\s\S]*?(?=\n---|\n##)/;
  const tableMatch = markdown.match(tableRegex);
  if (tableMatch) {
    const rows = tableMatch[0].split('\n');
    for (const row of rows) {
      // 匹配 | 图片1 | C01 | 说明 | 或 | @图片1 | C01 | 说明 |
      const cellMatch = row.match(
        /\|\s*@?(?:图片|视频)(\d+)\s*\|\s*([CSP]\d{2})\s*\|\s*(.+?)\s*\|/
      );
      if (cellMatch) {
        const slotType = row.includes('视频') ? 'video' as const : 'image' as const;
        result.assetSlots.push({
          slotNumber: parseInt(cellMatch[1]),
          slotType,
          assetCode: cellMatch[2],
          description: cellMatch[3].trim(),
        });
      }
    }
  }

  // 提取 Seedance Prompt 部分
  const promptSectionMatch = markdown.match(
    /##\s*Seedance\s*Prompt\s*\n([\s\S]*?)(?=\n---|\n##\s*尾帧)/
  );

  if (promptSectionMatch) {
    let promptContent = promptSectionMatch[1].trim();

    // 判断是否在 code block 内
    const codeBlockMatch = promptContent.match(/```[\s\S]*?\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      promptContent = codeBlockMatch[1].trim();
    }

    result.rawPrompt = promptContent;

    // 提取风格行（第一行或第一段非时间轴内容）
    const promptLines = promptContent.split('\n');
    const styleLines: string[] = [];
    for (const line of promptLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/(\d+-\d+s|0-3秒|\*\*0-3)/.test(trimmed)) break;
      styleLines.push(trimmed);
    }
    result.styleLine = styleLines.join(' ');

    // 解析 5 个时段
    const timeSlotPatterns = [
      { start: 0, end: 3 },
      { start: 3, end: 6 },
      { start: 6, end: 9 },
      { start: 9, end: 12 },
      { start: 12, end: 15 },
    ];

    for (const slot of timeSlotPatterns) {
      const slotContent = extractTimeSlot(promptContent, slot.start, slot.end);
      if (slotContent) {
        const cameraMovement = extractCameraMovement(slotContent);
        result.timeSlots.push({
          startSecond: slot.start,
          endSecond: slot.end,
          cameraMovement,
          description: slotContent,
        });
      }
    }

    // 提取声音设计
    const soundMatch = promptContent.match(
      /(?:【声音】|音效设计[：:]?)\s*([\s\S]*?)(?=【参考】|$)/
    );
    if (soundMatch) {
      result.soundDesign = soundMatch[1].trim();
      // 如果崖山格式，音效设计是多行
      if (result.soundDesign.includes('\n')) {
        const soundLines = result.soundDesign.split('\n')
          .map(l => l.replace(/^-\s*/, '').trim())
          .filter(Boolean);
        result.soundDesign = soundLines.join(' | ');
      }
    }

    // 提取参考列表
    const refMatch = promptContent.match(/【参考】\s*(.+)/);
    if (refMatch) {
      result.referenceList = refMatch[1].trim();
    }
  }

  // 提取尾帧描述
  const endFrameMatch = markdown.match(
    /##\s*尾帧描述\s*\n([\s\S]*?)(?=\n---|\n\*分镜|$)/
  );
  if (endFrameMatch) {
    result.endFrameDescription = endFrameMatch[1].trim();
  }

  return result;
}

/**
 * 提取指定时段的内容
 */
function extractTimeSlot(content: string, start: number, end: number): string {
  // 匹配多种格式：
  // **0-3秒画面：** / 0-3s: / **0-3s：**
  const patterns = [
    // **X-Xs画面：** 或 **X-Xs秒画面：**
    new RegExp(
      `\\*\\*${start}-${end}(?:s|秒)(?:画面)?[：:]\\*\\*\\s*\\n?([\\s\\S]*?)(?=\\*\\*\\d+-\\d+|【声音】|音效设计|$)`
    ),
    // X-Xs: 标记（code block 内格式）
    new RegExp(
      `${start}-${end}s:\\s*([^\\n]*(?:\\n(?!\\d+-\\d+s:|音效设计|【).*)*)`
    ),
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  return '';
}

/**
 * 从描述中提取镜头运动关键词
 */
function extractCameraMovement(description: string): string {
  const keywords = [
    '推镜头', '拉镜头', '摇镜头', '移镜头', '跟镜头',
    '环绕镜头', '360度旋转', '升降镜头', '希区柯克变焦',
    '一镜到底', '手持晃动', '高空俯拍', '低角度仰拍',
    '面部特写', '中景推近', '镜头环绕', '镜头拉远',
    '俯拍', '仰拍', '环绕', '推近', '拉远',
  ];

  const found: string[] = [];
  for (const kw of keywords) {
    if (description.includes(kw)) {
      found.push(kw);
    }
  }
  return found.join(', ') || '';
}

/**
 * 根据素材编号判断类型
 */
function getAssetType(code: string): AssetType {
  const prefix = code.charAt(0).toUpperCase();
  switch (prefix) {
    case 'C': return 'character';
    case 'S': return 'scene';
    case 'P': return 'prop';
    default: return 'character';
  }
}

/**
 * 中文数字转阿拉伯数字
 */
function chineseToNumber(str: string): number {
  const num = parseInt(str);
  if (!isNaN(num)) return num;

  const map: Record<string, number> = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  };

  if (str.length === 1) return map[str] || 0;
  if (str.startsWith('十')) return 10 + (map[str[1]] || 0);
  if (str.endsWith('十')) return (map[str[0]] || 0) * 10;
  if (str.includes('十')) {
    const parts = str.split('十');
    return (map[parts[0]] || 0) * 10 + (map[parts[1]] || 0);
  }
  return 0;
}
