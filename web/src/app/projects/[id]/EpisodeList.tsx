'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, List, Tag, Typography, Spin, Empty, message, Button, Space,
  Input, Select, Popconfirm, Drawer, Tooltip,
} from 'antd';
import {
  CopyOutlined, SoundOutlined,
  CameraOutlined, ClockCircleOutlined,
  EditOutlined, SaveOutlined, CloseOutlined,
  PlusOutlined, DeleteOutlined, RobotOutlined,
} from '@ant-design/icons';
import { useClaudeStream } from '@/hooks/useClaudeStream';
import GenerationPanel from '@/components/claude/GenerationPanel';

const { Text, Paragraph, Title } = Typography;
const { TextArea } = Input;

interface EpisodeSummary {
  id: number;
  episodeNumber: number;
  title: string;
  styleLine: string;
  soundDesign: string;
  endFrameDescription: string;
}

interface TimeSlotData {
  startSecond: number;
  endSecond: number;
  cameraMovement: string;
  description: string;
}

interface AssetSlotData {
  slotNumber: number;
  slotType: string;
  assetCode: string;
  description: string;
}

interface EpisodeDetail {
  id: number;
  episodeNumber: number;
  title: string;
  rawPrompt: string;
  styleLine: string;
  soundDesign: string;
  referenceList: string;
  endFrameDescription: string;
  timeSlots: TimeSlotData[];
  assetSlots: AssetSlotData[];
}

const timeSlotColors = ['#e6f7ff', '#f6ffed', '#fffbe6', '#fff1f0', '#f9f0ff'];

const cameraOptions = [
  '推镜头', '拉镜头', '摇镜头', '移镜头', '跟镜头',
  '环绕镜头', '360度旋转', '升降镜头', '希区柯克变焦',
  '一镜到底', '手持晃动', '高空俯拍', '低角度仰拍',
  '面部特写', '中景推近', '镜头环绕', '镜头拉远',
  '俯拍', '仰拍',
];

const defaultTimeSlots: TimeSlotData[] = [
  { startSecond: 0, endSecond: 3, cameraMovement: '', description: '' },
  { startSecond: 3, endSecond: 6, cameraMovement: '', description: '' },
  { startSecond: 6, endSecond: 9, cameraMovement: '', description: '' },
  { startSecond: 9, endSecond: 12, cameraMovement: '', description: '' },
  { startSecond: 12, endSecond: 15, cameraMovement: '', description: '' },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function EpisodeList({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [episodesList, setEpisodesList] = useState<EpisodeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEp, setSelectedEp] = useState<EpisodeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editTitle, setEditTitle] = useState('');
  const [editStyleLine, setEditStyleLine] = useState('');
  const [editTimeSlots, setEditTimeSlots] = useState<TimeSlotData[]>([]);
  const [editAssetSlots, setEditAssetSlots] = useState<AssetSlotData[]>([]);
  const [editSoundDesign, setEditSoundDesign] = useState('');
  const [editReferenceList, setEditReferenceList] = useState('');
  const [editEndFrame, setEditEndFrame] = useState('');

  // AI Generation state
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiTargetEp, setAiTargetEp] = useState<number | null>(null);
  const claude = useClaudeStream();

  // AI Refine state
  const [refineDrawerOpen, setRefineDrawerOpen] = useState(false);
  const [refineSlotIndex, setRefineSlotIndex] = useState<number | null>(null);
  const refine = useClaudeStream();

  const fetchEpisodes = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/episodes`);
      const data = await res.json();
      setEpisodesList(Array.isArray(data) ? data : []);
    } catch {
      message.error('获取分镜列表失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchEpisodes(); }, [fetchEpisodes]);

  const loadEpisodeDetail = async (epNumber: number) => {
    setEditing(false);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/episodes/${epNumber}`);
      const data = await res.json();
      if (!data.error) setSelectedEp(data);
    } catch {
      message.error('加载分镜详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const copyPrompt = async (epNumber: number) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/episodes/${epNumber}/prompt`);
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      message.success('Prompt 已复制到剪贴板');
    } catch {
      message.error('复制失败');
    }
  };

  const startEditing = () => {
    if (!selectedEp) return;
    setEditTitle(selectedEp.title);
    setEditStyleLine(selectedEp.styleLine);
    setEditTimeSlots(selectedEp.timeSlots.length > 0
      ? JSON.parse(JSON.stringify(selectedEp.timeSlots))
      : JSON.parse(JSON.stringify(defaultTimeSlots)));
    setEditAssetSlots(JSON.parse(JSON.stringify(selectedEp.assetSlots)));
    setEditSoundDesign(selectedEp.soundDesign);
    setEditReferenceList(selectedEp.referenceList);
    setEditEndFrame(selectedEp.endFrameDescription);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const saveChanges = async () => {
    if (!selectedEp) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/episodes/${selectedEp.episodeNumber}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          styleLine: editStyleLine,
          timeSlots: editTimeSlots,
          assetSlots: editAssetSlots,
          soundDesign: editSoundDesign,
          referenceList: editReferenceList,
          endFrameDescription: editEndFrame,
        }),
      });
      const data = await res.json();
      if (data.error) {
        message.error(data.error);
        return;
      }
      message.success('分镜保存成功');
      setEditing(false);
      fetchEpisodes();
      loadEpisodeDetail(selectedEp.episodeNumber);
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const addEpisode = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/episodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error) { message.error(data.error); return; }
      message.success('新增分镜成功');
      fetchEpisodes();
    } catch {
      message.error('新增失败');
    }
  };

  const deleteEpisode = async (epNumber: number) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/episodes/${epNumber}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.error) { message.error(data.error); return; }
      message.success('分镜已删除');
      if (selectedEp?.episodeNumber === epNumber) {
        setSelectedEp(null);
        setEditing(false);
      }
      fetchEpisodes();
    } catch {
      message.error('删除失败');
    }
  };

  // AI Generation handlers
  const handleAiGenerateEpisode = async (epNumber: number) => {
    setAiTargetEp(epNumber);
    setAiDrawerOpen(true);
    claude.reset();
    await claude.generate({
      taskType: 'generate_episode',
      projectId: parseInt(projectId),
      episodeNumber: epNumber,
    });
  };

  const handleAiApply = () => {
    setAiDrawerOpen(false);
    claude.reset();
    message.success('分镜已应用到项目');
    fetchEpisodes();
    if (aiTargetEp) loadEpisodeDetail(aiTargetEp);
  };

  // AI Refine handlers
  const handleRefinePrompt = async (slotIndex: number) => {
    if (!editing) return;
    const slot = editTimeSlots[slotIndex];
    if (!slot?.description) {
      message.warning('该时段没有描述内容可以优化');
      return;
    }
    setRefineSlotIndex(slotIndex);
    setRefineDrawerOpen(true);
    refine.reset();
    await refine.generate({
      taskType: 'refine_prompt',
      projectId: parseInt(projectId),
      existingPrompt: slot.description,
    });
  };

  const handleRefineApply = () => {
    if (refineSlotIndex !== null && refine.streamedText) {
      const updated = [...editTimeSlots];
      updated[refineSlotIndex] = { ...updated[refineSlotIndex], description: refine.streamedText.trim() };
      setEditTimeSlots(updated);
      message.success('优化文本已应用');
    }
    setRefineDrawerOpen(false);
    refine.reset();
  };

  // Asset slot helpers
  const addAssetSlot = () => {
    const maxSlot = editAssetSlots.reduce((max, s) => Math.max(max, s.slotNumber), 0);
    setEditAssetSlots([...editAssetSlots, {
      slotNumber: maxSlot + 1,
      slotType: 'image',
      assetCode: '',
      description: '',
    }]);
  };

  const removeAssetSlot = (index: number) => {
    const updated = [...editAssetSlots];
    updated.splice(index, 1);
    setEditAssetSlots(updated);
  };

  const updateAssetSlot = (index: number, field: keyof AssetSlotData, value: string | number) => {
    const updated = [...editAssetSlots];
    updated[index] = { ...updated[index], [field]: value };
    setEditAssetSlots(updated);
  };

  const updateTimeSlot = (index: number, field: keyof TimeSlotData, value: string | number) => {
    const updated = [...editTimeSlots];
    updated[index] = { ...updated[index], [field]: value };
    setEditTimeSlots(updated);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>;
  if (episodesList.length === 0 && !loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Empty description="暂无分镜" />
        <Button type="primary" icon={<PlusOutlined />} onClick={addEpisode} style={{ marginTop: 16 }}>
          新增分镜
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {/* 左侧集列表 */}
      <div style={{ width: 280, flexShrink: 0 }}>
        <Button
          type="dashed"
          block
          icon={<PlusOutlined />}
          onClick={addEpisode}
          style={{ marginBottom: 8 }}
        >
          新增分镜
        </Button>
        <List
          dataSource={episodesList}
          renderItem={ep => (
            <List.Item
              style={{
                cursor: 'pointer',
                padding: '12px 16px',
                background: selectedEp?.episodeNumber === ep.episodeNumber ? '#e6f7ff' : 'white',
                borderRadius: 8,
                marginBottom: 8,
                border: '1px solid #f0f0f0',
              }}
              onClick={() => loadEpisodeDetail(ep.episodeNumber)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <Space>
                  <Tag color="blue">E{String(ep.episodeNumber).padStart(2, '0')}</Tag>
                  <Text strong>{ep.title}</Text>
                </Space>
                <Space size={4}>
                  <Tooltip title="AI 生成分镜">
                    <Button
                      type="text" size="small"
                      icon={<RobotOutlined />}
                      onClick={e => { e.stopPropagation(); handleAiGenerateEpisode(ep.episodeNumber); }}
                    />
                  </Tooltip>
                  <Popconfirm
                    title="确认删除此分镜？"
                    onConfirm={(e) => { e?.stopPropagation(); deleteEpisode(ep.episodeNumber); }}
                    onCancel={(e) => e?.stopPropagation()}
                    okText="删除" cancelText="取消" okButtonProps={{ danger: true }}
                  >
                    <Button
                      type="text" size="small" danger
                      icon={<DeleteOutlined />}
                      onClick={e => e.stopPropagation()}
                    />
                  </Popconfirm>
                </Space>
              </div>
            </List.Item>
          )}
        />
      </div>

      {/* 右侧详情 */}
      <div style={{ flex: 1 }}>
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
        ) : !selectedEp ? (
          <Empty description="请选择一集查看详情" />
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              {editing ? (
                <Input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  style={{ width: 300, fontSize: 16, fontWeight: 'bold' }}
                  prefix={<Tag color="blue">E{String(selectedEp.episodeNumber).padStart(2, '0')}</Tag>}
                />
              ) : (
                <Title level={4} style={{ margin: 0 }}>
                  E{String(selectedEp.episodeNumber).padStart(2, '0')} - {selectedEp.title}
                </Title>
              )}
              <Space>
                {editing ? (
                  <>
                    <Button icon={<CloseOutlined />} onClick={cancelEditing}>取消</Button>
                    <Button type="primary" icon={<SaveOutlined />} onClick={saveChanges} loading={saving}>
                      保存
                    </Button>
                  </>
                ) : (
                  <>
                    <Button icon={<RobotOutlined />} onClick={() => handleAiGenerateEpisode(selectedEp.episodeNumber)}>
                      AI 生成
                    </Button>
                    <Button icon={<EditOutlined />} onClick={startEditing}>编辑</Button>
                    <Button icon={<CopyOutlined />} onClick={() => copyPrompt(selectedEp.episodeNumber)}>
                      复制 Prompt
                    </Button>
                  </>
                )}
              </Space>
            </div>

            {/* 素材槽位 */}
            <Card title="素材上传清单" size="small" style={{ marginBottom: 16 }}
              extra={editing && <Button size="small" icon={<PlusOutlined />} onClick={addAssetSlot}>添加</Button>}
            >
              {editing ? (
                <div>
                  {editAssetSlots.map((slot, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <Select
                        value={slot.slotType}
                        onChange={v => updateAssetSlot(i, 'slotType', v)}
                        style={{ width: 90 }}
                        options={[
                          { label: '图片', value: 'image' },
                          { label: '视频', value: 'video' },
                        ]}
                      />
                      <Input
                        value={slot.assetCode}
                        onChange={e => updateAssetSlot(i, 'assetCode', e.target.value)}
                        placeholder="素材编号 (如 C01)"
                        style={{ width: 120 }}
                      />
                      <Input
                        value={slot.description}
                        onChange={e => updateAssetSlot(i, 'description', e.target.value)}
                        placeholder="描述"
                        style={{ flex: 1 }}
                      />
                      <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeAssetSlot(i)} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selectedEp.assetSlots.map(slot => (
                    <Tag key={slot.slotNumber} color={slot.slotType === 'video' ? 'purple' : 'blue'}>
                      @{slot.slotType === 'video' ? '视频' : '图片'}{slot.slotNumber}: {slot.assetCode} ({slot.description})
                    </Tag>
                  ))}
                  {selectedEp.assetSlots.length === 0 && <Text type="secondary">暂无素材槽位</Text>}
                </div>
              )}
            </Card>

            {/* 风格行 */}
            <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>风格描述</Text>
              {editing ? (
                <TextArea
                  value={editStyleLine}
                  onChange={e => setEditStyleLine(e.target.value)}
                  rows={2}
                  style={{ marginTop: 4 }}
                />
              ) : (
                <Paragraph style={{ margin: '4px 0 0', fontSize: 13 }}>
                  {selectedEp.styleLine || '-'}
                </Paragraph>
              )}
            </Card>

            {/* 时间轴 */}
            <Card title="时间轴" size="small" style={{ marginBottom: 16 }}>
              {editing ? (
                <div>
                  {editTimeSlots.map((slot, i) => (
                    <div key={i} style={{
                      padding: 12,
                      background: timeSlotColors[i % timeSlotColors.length],
                      borderRadius: 8,
                      marginBottom: 8,
                    }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                        <Tag color="blue" style={{ fontSize: 11 }}>
                          <ClockCircleOutlined /> {slot.startSecond}-{slot.endSecond}s
                        </Tag>
                        <Select
                          value={slot.cameraMovement || undefined}
                          onChange={v => updateTimeSlot(i, 'cameraMovement', v)}
                          placeholder="镜头运动"
                          style={{ width: 150 }}
                          allowClear
                          options={cameraOptions.map(opt => ({ label: opt, value: opt }))}
                        />
                        <Tooltip title="AI 优化此时段">
                          <Button
                            type="text"
                            size="small"
                            icon={<RobotOutlined />}
                            onClick={() => handleRefinePrompt(i)}
                            disabled={!slot.description}
                          />
                        </Tooltip>
                      </div>
                      <TextArea
                        value={slot.description}
                        onChange={e => updateTimeSlot(i, 'description', e.target.value)}
                        rows={3}
                        placeholder="画面描述"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 0 }}>
                  {selectedEp.timeSlots.map((slot, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        padding: 12,
                        background: timeSlotColors[i % timeSlotColors.length],
                        borderRight: i < selectedEp.timeSlots.length - 1 ? '1px solid #e8e8e8' : 'none',
                        borderRadius: i === 0 ? '8px 0 0 8px' : i === selectedEp.timeSlots.length - 1 ? '0 8px 8px 0' : 0,
                      }}
                    >
                      <div style={{ marginBottom: 8 }}>
                        <Tag color="blue" style={{ fontSize: 11 }}>
                          <ClockCircleOutlined /> {slot.startSecond}-{slot.endSecond}s
                        </Tag>
                      </div>
                      {slot.cameraMovement && (
                        <div style={{ marginBottom: 4 }}>
                          <Tag color="orange" style={{ fontSize: 10 }}>
                            <CameraOutlined /> {slot.cameraMovement}
                          </Tag>
                        </div>
                      )}
                      <Text style={{ fontSize: 12 }}>{slot.description}</Text>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* 声音设计 */}
            <Card
              title={<><SoundOutlined /> 声音设计</>}
              size="small"
              style={{ marginBottom: 16 }}
            >
              {editing ? (
                <TextArea
                  value={editSoundDesign}
                  onChange={e => setEditSoundDesign(e.target.value)}
                  rows={3}
                  placeholder="声音设计描述"
                />
              ) : (
                <Text style={{ fontSize: 13 }}>{selectedEp.soundDesign || '-'}</Text>
              )}
            </Card>

            {/* 参考列表 */}
            <Card title="参考列表" size="small" style={{ marginBottom: 16 }}>
              {editing ? (
                <TextArea
                  value={editReferenceList}
                  onChange={e => setEditReferenceList(e.target.value)}
                  rows={2}
                  placeholder="参考列表"
                />
              ) : (
                <Text style={{ fontSize: 13 }}>{selectedEp.referenceList || '-'}</Text>
              )}
            </Card>

            {/* 尾帧描述 */}
            <Card title="尾帧描述" size="small" style={{ marginBottom: 16 }}>
              {editing ? (
                <TextArea
                  value={editEndFrame}
                  onChange={e => setEditEndFrame(e.target.value)}
                  rows={4}
                  placeholder="尾帧描述"
                />
              ) : (
                <Paragraph style={{ fontSize: 13, whiteSpace: 'pre-wrap', margin: 0 }}>
                  {selectedEp.endFrameDescription || '-'}
                </Paragraph>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* AI 生成分镜 Drawer */}
      <Drawer
        title={`AI 生成分镜 E${aiTargetEp ? String(aiTargetEp).padStart(2, '0') : '--'}`}
        open={aiDrawerOpen}
        onClose={() => { setAiDrawerOpen(false); claude.abort(); }}
        width={640}
        destroyOnClose
      >
        <GenerationPanel
          streamedText={claude.streamedText}
          isGenerating={claude.isGenerating}
          error={claude.error}
          status={claude.status}
          onAbort={claude.abort}
          onApply={handleAiApply}
          title="分镜脚本生成"
        />
      </Drawer>

      {/* AI 优化 Prompt Drawer */}
      <Drawer
        title={`AI 优化时段描述 (${refineSlotIndex !== null ? `${refineSlotIndex * 3}-${refineSlotIndex * 3 + 3}s` : ''})`}
        open={refineDrawerOpen}
        onClose={() => { setRefineDrawerOpen(false); refine.abort(); }}
        width={640}
        destroyOnClose
      >
        <GenerationPanel
          streamedText={refine.streamedText}
          isGenerating={refine.isGenerating}
          error={refine.error}
          status={refine.status}
          onAbort={refine.abort}
          onApply={handleRefineApply}
          title="Prompt 优化"
        />
      </Drawer>
    </div>
  );
}
