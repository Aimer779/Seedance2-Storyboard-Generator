'use client';

import { useState, useRef, useCallback } from 'react';
import type { AIGenerateRequest, AIStreamEvent } from '@/types';

interface UseClaudeStreamReturn {
  streamedText: string;
  isGenerating: boolean;
  error: string | null;
  status: string | null;
  generate: (request: AIGenerateRequest) => Promise<string | null>;
  abort: () => void;
  reset: () => void;
}

export function useClaudeStream(): UseClaudeStreamReturn {
  const [streamedText, setStreamedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setStreamedText('');
    setIsGenerating(false);
    setError(null);
    setStatus(null);
  }, []);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setStatus(null);
  }, []);

  const generate = useCallback(async (request: AIGenerateRequest): Promise<string | null> => {
    // 重置状态
    setStreamedText('');
    setError(null);
    setStatus('正在连接...');
    setIsGenerating(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/claude/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: '请求失败' }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      if (!res.body) {
        throw new Error('No response body');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 解析 SSE 行
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留不完整的行

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event: AIStreamEvent = JSON.parse(jsonStr);

            switch (event.type) {
              case 'delta':
                fullText += event.data;
                setStreamedText(fullText);
                break;
              case 'status':
                setStatus(event.data);
                break;
              case 'complete':
                fullText = event.data || fullText;
                setStreamedText(fullText);
                setIsGenerating(false);
                setStatus(null);
                return fullText;
              case 'error':
                setError(event.data);
                setIsGenerating(false);
                setStatus(null);
                return null;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }

      // 流结束但没有收到 complete 事件
      setIsGenerating(false);
      setStatus(null);
      return fullText || null;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setStatus('已取消');
        setIsGenerating(false);
        return null;
      }
      const msg = err instanceof Error ? err.message : '生成失败';
      setError(msg);
      setIsGenerating(false);
      setStatus(null);
      return null;
    }
  }, []);

  return {
    streamedText,
    isGenerating,
    error,
    status,
    generate,
    abort,
    reset,
  };
}
