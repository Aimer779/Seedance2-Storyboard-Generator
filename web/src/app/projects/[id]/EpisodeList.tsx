'use client';

import React, { useEffect, useState } from 'react';
import { Card, List, Tag, Typography, Spin, Empty, message, Button, Space } from 'antd';
import {
  CopyOutlined, SoundOutlined,
  CameraOutlined, ClockCircleOutlined,
} from '@ant-design/icons';

const { Text, Paragraph, Title } = Typography;

interface EpisodeSummary {
  id: number;
  episodeNumber: number;
  title: string;
  styleLine: string;
  soundDesign: string;
  endFrameDescription: string;
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
  timeSlots: Array<{
    startSecond: number;
    endSecond: number;
    cameraMovement: string;
    description: string;
  }>;
  assetSlots: Array<{
    slotNumber: number;
    slotType: string;
    assetCode: string;
    description: string;
  }>;
}

const timeSlotColors = ['#e6f7ff', '#f6ffed', '#fffbe6', '#fff1f0', '#f9f0ff'];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function EpisodeList({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [episodesList, setEpisodesList] = useState<EpisodeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEp, setSelectedEp] = useState<EpisodeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/episodes`)
      .then(res => res.json())
      .then(data => setEpisodesList(Array.isArray(data) ? data : []))
      .catch(() => message.error('获取分镜列表失败'))
      .finally(() => setLoading(false));
  }, [projectId]);

  const loadEpisodeDetail = async (epNumber: number) => {
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

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>;
  if (episodesList.length === 0) return <Empty description="暂无分镜" />;

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {/* 左侧集列表 */}
      <div style={{ width: 280, flexShrink: 0 }}>
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
              <div>
                <Space>
                  <Tag color="blue">E{String(ep.episodeNumber).padStart(2, '0')}</Tag>
                  <Text strong>{ep.title}</Text>
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
              <Title level={4} style={{ margin: 0 }}>
                E{String(selectedEp.episodeNumber).padStart(2, '0')} - {selectedEp.title}
              </Title>
              <Button
                icon={<CopyOutlined />}
                onClick={() => copyPrompt(selectedEp.episodeNumber)}
              >
                复制 Prompt
              </Button>
            </div>

            {/* 素材槽位 */}
            {selectedEp.assetSlots.length > 0 && (
              <Card title="素材上传清单" size="small" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selectedEp.assetSlots.map(slot => (
                    <Tag key={slot.slotNumber} color={slot.slotType === 'video' ? 'purple' : 'blue'}>
                      @{slot.slotType === 'video' ? '视频' : '图片'}{slot.slotNumber}: {slot.assetCode} ({slot.description})
                    </Tag>
                  ))}
                </div>
              </Card>
            )}

            {/* 风格行 */}
            {selectedEp.styleLine && (
              <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>风格描述</Text>
                <Paragraph style={{ margin: '4px 0 0', fontSize: 13 }}>
                  {selectedEp.styleLine}
                </Paragraph>
              </Card>
            )}

            {/* 时间轴 */}
            <Card title="时间轴" size="small" style={{ marginBottom: 16 }}>
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
            </Card>

            {/* 声音设计 */}
            {selectedEp.soundDesign && (
              <Card
                title={<><SoundOutlined /> 声音设计</>}
                size="small"
                style={{ marginBottom: 16 }}
              >
                <Text style={{ fontSize: 13 }}>{selectedEp.soundDesign}</Text>
              </Card>
            )}

            {/* 参考列表 */}
            {selectedEp.referenceList && (
              <Card title="参考列表" size="small" style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 13 }}>{selectedEp.referenceList}</Text>
              </Card>
            )}

            {/* 尾帧描述 */}
            {selectedEp.endFrameDescription && (
              <Card title="尾帧描述" size="small" style={{ marginBottom: 16 }}>
                <Paragraph style={{ fontSize: 13, whiteSpace: 'pre-wrap', margin: 0 }}>
                  {selectedEp.endFrameDescription}
                </Paragraph>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
