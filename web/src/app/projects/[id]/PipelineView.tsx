'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, Spin, Empty, Typography, message, Select } from 'antd';
import {
  FileTextOutlined, PictureOutlined, CameraOutlined,
  VideoCameraOutlined, PlayCircleOutlined,
  CheckCircleOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined, MinusCircleOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface PipelineStageData {
  id: number;
  stage: string;
  status: string;
  updatedAt: string;
}

const stageConfig: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  script: { label: '剧本开发', icon: <FileTextOutlined />, description: '将故事/小说转化为四幕剧本' },
  assets: { label: '素材规划', icon: <PictureOutlined />, description: '创建角色/场景/道具生成 Prompt' },
  images: { label: '图片生成', icon: <CameraOutlined />, description: '使用 Nana Banana Pro 生成素材图片' },
  storyboard: { label: '分镜脚本', icon: <VideoCameraOutlined />, description: '创建 Seedance 2.0 时间轴 Prompt' },
  video: { label: '视频生成', icon: <PlayCircleOutlined />, description: '使用 Seedance 2.0 生成视频' },
};

const statusMap: Record<string, { icon: React.ReactNode; color: string; text: string }> = {
  pending: { icon: <MinusCircleOutlined />, color: '#d9d9d9', text: '未开始' },
  in_progress: { icon: <ClockCircleOutlined />, color: '#1677ff', text: '进行中' },
  completed: { icon: <CheckCircleOutlined />, color: '#52c41a', text: '已完成' },
  needs_revision: { icon: <ExclamationCircleOutlined />, color: '#faad14', text: '需修改' },
};

const statusOptions = [
  { label: '未开始', value: 'pending' },
  { label: '进行中', value: 'in_progress' },
  { label: '已完成', value: 'completed' },
  { label: '需修改', value: 'needs_revision' },
];

export default function PipelineView({ projectId }: { projectId: string }) {
  const [stages, setStages] = useState<PipelineStageData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStages = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/pipeline`);
      const data = await res.json();
      setStages(Array.isArray(data) ? data : []);
    } catch {
      message.error('获取流程状态失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchStages(); }, [fetchStages]);

  const updateStatus = async (stageName: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/pipeline/${stageName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.error) {
        message.error(data.error);
        return;
      }
      message.success('状态已更新');
      fetchStages();
    } catch {
      message.error('更新失败');
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>;
  if (stages.length === 0) return <Empty description="暂无流程数据" />;

  const stageOrder = ['script', 'assets', 'images', 'storyboard', 'video'];
  const orderedStages = stageOrder
    .map(s => stages.find(st => st.stage === s))
    .filter(Boolean) as PipelineStageData[];

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '8px 0' }}>
        {orderedStages.map((stage, i) => {
          const config = stageConfig[stage.stage];
          const status = statusMap[stage.status] || statusMap.pending;
          return (
            <React.Fragment key={stage.stage}>
              <Card
                style={{
                  minWidth: 200,
                  flex: 1,
                  borderTop: `3px solid ${status.color}`,
                }}
                styles={{ body: { padding: 16 } }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, color: status.color, marginBottom: 8 }}>
                    {config?.icon}
                  </div>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    {config?.label || stage.stage}
                  </Text>
                  <Select
                    value={stage.status}
                    onChange={(val) => updateStatus(stage.stage, val)}
                    options={statusOptions}
                    style={{ width: '100%', marginBottom: 8 }}
                    size="small"
                  />
                  <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
                    {config?.description}
                  </Text>
                </div>
              </Card>
              {i < orderedStages.length - 1 && (
                <div style={{ display: 'flex', alignItems: 'center', fontSize: 20, color: '#d9d9d9' }}>
                  →
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
