'use client';

import React, { useEffect, useState } from 'react';
import { Card, Spin, Empty, Typography, Tag, List } from 'antd';
import ReactMarkdown from 'react-markdown';

const { Text } = Typography;

interface ScriptData {
  id: number;
  rawMarkdown: string;
  filePath: string;
  episodes: Array<{
    episodeNumber: number;
    title: string;
    emotionalTone: string;
    keyPlots: string[];
    openingFrame: string;
    closingFrame: string;
  }>;
}

export default function ScriptView({ projectId }: { projectId: string }) {
  const [script, setScript] = useState<ScriptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'structured' | 'raw'>('structured');

  useEffect(() => {
    fetch(`/api/projects/${projectId}/script`)
      .then(res => {
        if (res.status === 404) return null;
        return res.json();
      })
      .then(data => {
        if (data && !data.error) setScript(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>;
  if (!script) return <Empty description="暂无剧本" />;

  const toneColors: Record<string, string> = {
    '孤寂压抑': '#8c8c8c',
    '惊疑不定': '#597ef7',
    '暴风雨前的宁静': '#36cfc9',
    '震惊愤怒': '#ff4d4f',
    '爆发壮烈': '#ff7a45',
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Tag
          color={viewMode === 'structured' ? 'blue' : 'default'}
          style={{ cursor: 'pointer', padding: '4px 12px' }}
          onClick={() => setViewMode('structured')}
        >
          结构化视图
        </Tag>
        <Tag
          color={viewMode === 'raw' ? 'blue' : 'default'}
          style={{ cursor: 'pointer', padding: '4px 12px' }}
          onClick={() => setViewMode('raw')}
        >
          原始 Markdown
        </Tag>
      </div>

      {viewMode === 'raw' ? (
        <Card>
          <div style={{ fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
            <ReactMarkdown>{script.rawMarkdown}</ReactMarkdown>
          </div>
        </Card>
      ) : (
        <div>
          {script.episodes.map(ep => (
            <Card
              key={ep.episodeNumber}
              style={{ marginBottom: 12 }}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag color="blue">E{String(ep.episodeNumber).padStart(2, '0')}</Tag>
                  <Text strong>{ep.title}</Text>
                  {ep.emotionalTone && (
                    <Tag color={toneColors[ep.emotionalTone] || 'default'}>
                      {ep.emotionalTone}
                    </Tag>
                  )}
                </div>
              }
              size="small"
            >
              <div style={{ marginBottom: 8 }}>
                <Text strong style={{ fontSize: 12 }}>关键情节：</Text>
                <List
                  size="small"
                  dataSource={ep.keyPlots}
                  renderItem={item => (
                    <List.Item style={{ padding: '2px 0', border: 'none' }}>
                      <Text style={{ fontSize: 13 }}>- {item}</Text>
                    </List.Item>
                  )}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: '#f6ffed', padding: 8, borderRadius: 6, fontSize: 12 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>首帧画面</Text>
                  <div>{ep.openingFrame || '-'}</div>
                </div>
                <div style={{ background: '#fff7e6', padding: 8, borderRadius: 6, fontSize: 12 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>尾帧画面</Text>
                  <div>{ep.closingFrame || '-'}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
