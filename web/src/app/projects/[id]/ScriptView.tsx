'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, Spin, Empty, Typography, Tag, Button, Input, Space, message } from 'antd';
import { EditOutlined, SaveOutlined, CloseOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dynamic from 'next/dynamic';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });
const MDPreview = dynamic(() => import('@uiw/react-md-editor').then(mod => mod.default.Markdown), { ssr: false });

const { Text } = Typography;
const { TextArea } = Input;

interface ScriptEpisode {
  episodeNumber: number;
  title: string;
  emotionalTone: string;
  keyPlots: string[];
  openingFrame: string;
  closingFrame: string;
}

interface ScriptData {
  id: number;
  rawMarkdown: string;
  filePath: string;
  episodes: ScriptEpisode[];
}

export default function ScriptView({ projectId }: { projectId: string }) {
  const [script, setScript] = useState<ScriptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'structured' | 'raw'>('structured');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Structured editing state
  const [editEpisodes, setEditEpisodes] = useState<ScriptEpisode[]>([]);

  // Raw markdown editing state
  const [editMarkdown, setEditMarkdown] = useState('');

  const fetchScript = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/script`);
      if (res.status === 404) {
        setScript(null);
        return;
      }
      const data = await res.json();
      if (data && !data.error) setScript(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchScript(); }, [fetchScript]);

  const startEditing = () => {
    if (viewMode === 'structured' && script) {
      setEditEpisodes(JSON.parse(JSON.stringify(script.episodes)));
    } else if (viewMode === 'raw' && script) {
      setEditMarkdown(script.rawMarkdown);
    }
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const body = viewMode === 'raw'
        ? { rawMarkdown: editMarkdown }
        : { episodes: editEpisodes };

      const res = await fetch(`/api/projects/${projectId}/script`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) {
        message.error(data.error);
        return;
      }
      message.success('剧本保存成功');
      setEditing(false);
      fetchScript();
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // Episode editing helpers
  const updateEpisode = (index: number, field: keyof ScriptEpisode, value: unknown) => {
    const updated = [...editEpisodes];
    updated[index] = { ...updated[index], [field]: value };
    setEditEpisodes(updated);
  };

  const addPlot = (epIndex: number) => {
    const updated = [...editEpisodes];
    updated[epIndex].keyPlots.push('');
    setEditEpisodes(updated);
  };

  const updatePlot = (epIndex: number, plotIndex: number, value: string) => {
    const updated = [...editEpisodes];
    updated[epIndex].keyPlots[plotIndex] = value;
    setEditEpisodes(updated);
  };

  const removePlot = (epIndex: number, plotIndex: number) => {
    const updated = [...editEpisodes];
    updated[epIndex].keyPlots.splice(plotIndex, 1);
    setEditEpisodes(updated);
  };

  const addEpisode = () => {
    const maxEp = editEpisodes.reduce((max, ep) => Math.max(max, ep.episodeNumber), 0);
    setEditEpisodes([...editEpisodes, {
      episodeNumber: maxEp + 1,
      title: '',
      emotionalTone: '',
      keyPlots: [''],
      openingFrame: '',
      closingFrame: '',
    }]);
  };

  const removeEpisode = (index: number) => {
    const updated = [...editEpisodes];
    updated.splice(index, 1);
    setEditEpisodes(updated);
  };

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
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Tag
            color={viewMode === 'structured' ? 'blue' : 'default'}
            style={{ cursor: 'pointer', padding: '4px 12px' }}
            onClick={() => { if (!editing) setViewMode('structured'); }}
          >
            结构化视图
          </Tag>
          <Tag
            color={viewMode === 'raw' ? 'blue' : 'default'}
            style={{ cursor: 'pointer', padding: '4px 12px' }}
            onClick={() => { if (!editing) setViewMode('raw'); }}
          >
            原始 Markdown
          </Tag>
        </div>
        <Space>
          {editing ? (
            <>
              <Button icon={<CloseOutlined />} onClick={cancelEditing}>取消</Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={saveChanges} loading={saving}>
                保存
              </Button>
            </>
          ) : (
            <Button icon={<EditOutlined />} onClick={startEditing}>编辑</Button>
          )}
        </Space>
      </div>

      {viewMode === 'raw' ? (
        editing ? (
          <div data-color-mode="light">
            <MDEditor
              value={editMarkdown}
              onChange={(val) => setEditMarkdown(val || '')}
              height={600}
            />
          </div>
        ) : (
          <Card>
            <div data-color-mode="light">
              <MDPreview source={script.rawMarkdown} />
            </div>
          </Card>
        )
      ) : (
        <div>
          {(editing ? editEpisodes : script.episodes).map((ep, i) => (
            <Card
              key={ep.episodeNumber}
              style={{ marginBottom: 12 }}
              title={
                editing ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag color="blue">E{String(ep.episodeNumber).padStart(2, '0')}</Tag>
                    <Input
                      value={ep.title}
                      onChange={e => updateEpisode(i, 'title', e.target.value)}
                      style={{ width: 200 }}
                      placeholder="集标题"
                    />
                    <Input
                      value={ep.emotionalTone}
                      onChange={e => updateEpisode(i, 'emotionalTone', e.target.value)}
                      style={{ width: 120 }}
                      placeholder="情感基调"
                    />
                    <Button
                      type="text" danger size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => removeEpisode(i)}
                    />
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag color="blue">E{String(ep.episodeNumber).padStart(2, '0')}</Tag>
                    <Text strong>{ep.title}</Text>
                    {ep.emotionalTone && (
                      <Tag color={toneColors[ep.emotionalTone] || 'default'}>
                        {ep.emotionalTone}
                      </Tag>
                    )}
                  </div>
                )
              }
              size="small"
            >
              <div style={{ marginBottom: 8 }}>
                <Text strong style={{ fontSize: 12 }}>关键情节：</Text>
                {editing ? (
                  <div style={{ marginTop: 4 }}>
                    {ep.keyPlots.map((plot, pi) => (
                      <div key={pi} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                        <Input
                          value={plot}
                          onChange={e => updatePlot(i, pi, e.target.value)}
                          placeholder="情节描述"
                        />
                        <Button
                          type="text" danger size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => removePlot(i, pi)}
                        />
                      </div>
                    ))}
                    <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => addPlot(i)}>
                      添加情节
                    </Button>
                  </div>
                ) : (
                  <div style={{ marginTop: 4 }}>
                    {ep.keyPlots.map((item, pi) => (
                      <div key={pi} style={{ padding: '2px 0', fontSize: 13 }}>- {item}</div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: '#f6ffed', padding: 8, borderRadius: 6, fontSize: 12 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>首帧画面</Text>
                  {editing ? (
                    <TextArea
                      value={ep.openingFrame}
                      onChange={e => updateEpisode(i, 'openingFrame', e.target.value)}
                      rows={2}
                      style={{ marginTop: 4, fontSize: 12 }}
                    />
                  ) : (
                    <div>{ep.openingFrame || '-'}</div>
                  )}
                </div>
                <div style={{ background: '#fff7e6', padding: 8, borderRadius: 6, fontSize: 12 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>尾帧画面</Text>
                  {editing ? (
                    <TextArea
                      value={ep.closingFrame}
                      onChange={e => updateEpisode(i, 'closingFrame', e.target.value)}
                      rows={2}
                      style={{ marginTop: 4, fontSize: 12 }}
                    />
                  ) : (
                    <div>{ep.closingFrame || '-'}</div>
                  )}
                </div>
              </div>
            </Card>
          ))}
          {editing && (
            <Button type="dashed" block icon={<PlusOutlined />} onClick={addEpisode} style={{ marginTop: 8 }}>
              添加新集
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
