import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { projects, scripts, scriptEpisodes, assets, episodes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createStream } from '@/lib/claude/agent';
import { saveGeneratedScript, saveGeneratedAssets, saveGeneratedEpisode } from '@/lib/claude/save';
import { serializeScript, serializeAssetList } from '@/lib/markdown/serializer';
import type { AIGenerateRequest, AITaskType } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

function validateRequest(body: AIGenerateRequest): string | null {
  if (!body.taskType) return '缺少 taskType';
  if (!body.projectId) return '缺少 projectId';

  const validTypes: AITaskType[] = ['generate_script', 'generate_assets', 'generate_episode', 'refine_prompt'];
  if (!validTypes.includes(body.taskType)) return `无效的 taskType: ${body.taskType}`;

  if (body.taskType === 'generate_script' && !body.storyText) return '生成剧本需要提供 storyText';
  if (body.taskType === 'generate_episode' && !body.episodeNumber) return '生成分镜需要提供 episodeNumber';
  if (body.taskType === 'refine_prompt' && !body.existingPrompt) return '优化 Prompt 需要提供 existingPrompt';

  return null;
}

function loadProjectContext(projectId: number) {
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) throw new Error('项目不存在');

  const script = db.select().from(scripts).where(eq(scripts.projectId, projectId)).get();
  const allAssets = db.select().from(assets).where(eq(assets.projectId, projectId)).all();
  const allEpisodes = db.select().from(episodes).where(eq(episodes.projectId, projectId)).all();

  // Build script markdown from DB if available
  let scriptMarkdown = '';
  if (script?.rawMarkdown) {
    scriptMarkdown = script.rawMarkdown;
  } else if (script) {
    const eps = db.select().from(scriptEpisodes).where(eq(scriptEpisodes.scriptId, script.id)).all();
    scriptMarkdown = serializeScript({
      title: project.name,
      params: {
        '视觉风格': project.style || '',
        '画幅比例': project.aspectRatio || '',
        '情感基调': project.emotionalTone || '',
        '每集时长': project.episodeDuration || '',
        '总集数': `${project.totalEpisodes || 0}集`,
      },
      episodes: eps.map(ep => ({
        episodeNumber: ep.episodeNumber,
        title: ep.title || '',
        emotionalTone: ep.emotionalTone || '',
        keyPlots: JSON.parse(ep.keyPlots || '[]'),
        openingFrame: ep.openingFrame || '',
        closingFrame: ep.closingFrame || '',
      })),
    });
  }

  // Build asset list markdown from DB
  let assetListMarkdown = '';
  if (allAssets.length > 0) {
    assetListMarkdown = serializeAssetList(
      project.style || '',
      allAssets.map(a => ({
        code: a.code,
        type: a.type as 'character' | 'scene' | 'prop',
        name: a.name || '',
        prompt: a.prompt || '',
        description: a.description || '',
        usedInEpisodes: a.usedInEpisodes || '[]',
      })),
    );
  }

  return {
    project,
    scriptMarkdown,
    assetListMarkdown,
    allEpisodes,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: AIGenerateRequest = await request.json();

    // Validate
    const error = validateRequest(body);
    if (error) {
      return new Response(
        `data: ${JSON.stringify({ type: 'error', data: error })}\n\n`,
        { status: 400, headers: { 'Content-Type': 'text/event-stream' } },
      );
    }

    // Check API key
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'sk-ant-your-key-here') {
      return new Response(
        `data: ${JSON.stringify({ type: 'error', data: '请先配置 ANTHROPIC_API_KEY 环境变量' })}\n\n`,
        { status: 500, headers: { 'Content-Type': 'text/event-stream' } },
      );
    }

    // Load context
    const ctx = loadProjectContext(body.projectId);

    // Find previous episode end frame for continuity
    let previousEndFrame: string | undefined;
    if (body.taskType === 'generate_episode' && body.episodeNumber && body.episodeNumber > 1) {
      const prevEp = ctx.allEpisodes.find(e => e.episodeNumber === body.episodeNumber! - 1);
      if (prevEp?.endFrameDescription) {
        previousEndFrame = prevEp.endFrameDescription;
      }
    }

    // Create stream
    const stream = createStream({
      taskType: body.taskType,
      storyText: body.storyText,
      scriptMarkdown: ctx.scriptMarkdown,
      assetListMarkdown: ctx.assetListMarkdown,
      style: ctx.project.style || '',
      projectParams: {
        '视觉风格': ctx.project.style || '',
        '画幅比例': ctx.project.aspectRatio || '',
        '情感基调': ctx.project.emotionalTone || '',
        '每集时长': ctx.project.episodeDuration || '',
      },
      episodeNumber: body.episodeNumber,
      previousEndFrame,
      existingPrompt: body.existingPrompt,
    });

    // Create SSE response
    const encoder = new TextEncoder();
    let fullText = '';

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Send status
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'status', data: '正在生成...' })}\n\n`
          ));

          for await (const event of stream) {
            if (event.type === 'content_block_delta') {
              const delta = event.delta;
              if ('text' in delta) {
                fullText += delta.text;
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ type: 'delta', data: delta.text })}\n\n`
                ));
              }
            }
          }

          // Save result (except for refine_prompt)
          if (body.taskType !== 'refine_prompt' && fullText.trim()) {
            try {
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'status', data: '正在保存...' })}\n\n`
              ));

              switch (body.taskType) {
                case 'generate_script':
                  saveGeneratedScript(body.projectId, fullText);
                  break;
                case 'generate_assets':
                  saveGeneratedAssets(body.projectId, fullText);
                  break;
                case 'generate_episode':
                  saveGeneratedEpisode(body.projectId, body.episodeNumber!, fullText);
                  break;
              }
            } catch (saveError) {
              console.error('Save error:', saveError);
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'error', data: `保存失败: ${saveError instanceof Error ? saveError.message : '未知错误'}` })}\n\n`
              ));
            }
          }

          // Send complete
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'complete', data: fullText })}\n\n`
          ));

          controller.close();
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : '生成失败';
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'error', data: errMsg })}\n\n`
          ));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : '请求处理失败';
    return new Response(
      `data: ${JSON.stringify({ type: 'error', data: errMsg })}\n\n`,
      { status: 500, headers: { 'Content-Type': 'text/event-stream' } },
    );
  }
}
