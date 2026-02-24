import Anthropic from '@anthropic-ai/sdk';
import type { AITaskType } from '@/types';
import {
  buildScriptPrompt,
  buildAssetPrompt,
  buildEpisodePrompt,
  buildRefinePrompt,
} from './prompts';

const client = new Anthropic();

const MODEL = 'claude-opus-4-6';

export interface AgentContext {
  taskType: AITaskType;
  scriptMarkdown?: string;
  assetListMarkdown?: string;
  storyText?: string;
  style?: string;
  projectParams?: Record<string, string>;
  episodeNumber?: number;
  previousEndFrame?: string;
  existingPrompt?: string;
}

function buildMessages(ctx: AgentContext): {
  systemPrompt: string;
  userMessage: string;
} {
  switch (ctx.taskType) {
    case 'generate_script':
      return buildScriptPrompt(ctx.storyText || '', ctx.projectParams);

    case 'generate_assets':
      return buildAssetPrompt(ctx.scriptMarkdown || '', ctx.style || '');

    case 'generate_episode':
      return buildEpisodePrompt(
        ctx.scriptMarkdown || '',
        ctx.assetListMarkdown || '',
        ctx.episodeNumber || 1,
        ctx.previousEndFrame,
      );

    case 'refine_prompt':
      return buildRefinePrompt(ctx.existingPrompt || '');

    default:
      throw new Error(`Unknown task type: ${ctx.taskType}`);
  }
}

/**
 * 创建流式生成，返回 Anthropic stream
 */
export function createStream(ctx: AgentContext) {
  const { systemPrompt, userMessage } = buildMessages(ctx);

  return client.messages.stream({
    model: MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
}
