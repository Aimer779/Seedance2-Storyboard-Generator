'use client';

import React, { useEffect, useState } from 'react';
import {
  Tabs, Typography, Spin, Button, Descriptions, Tag, Space, Card, message,
} from 'antd';
import {
  ArrowLeftOutlined, FileTextOutlined, PictureOutlined,
  VideoCameraOutlined, NodeIndexOutlined,
} from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import AssetList from './AssetList';
import EpisodeList from './EpisodeList';
import ScriptView from './ScriptView';
import PipelineView from './PipelineView';

const { Title, Text } = Typography;

interface ProjectDetail {
  id: number;
  name: string;
  folderName: string;
  style: string;
  aspectRatio: string;
  emotionalTone: string;
  episodeDuration: string;
  totalEpisodes: number;
  status: string;
  assetCount: number;
  episodeCount: number;
  episodes: Array<{ id: number; episodeNumber: number; title: string }>;
  pipeline: Array<{ stage: string; status: string }>;
}

export default function ProjectDetailPage() {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          message.error(data.error);
          return;
        }
        setProject(data);
      })
      .catch(() => message.error('获取项目详情失败'))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  }

  if (!project) {
    return <div style={{ textAlign: 'center', padding: 100 }}>项目不存在</div>;
  }

  const stageLabels: Record<string, string> = {
    script: '剧本开发',
    assets: '素材规划',
    images: '图片生成',
    storyboard: '分镜脚本',
    video: '视频生成',
  };

  const statusColors: Record<string, string> = {
    pending: 'default',
    in_progress: 'processing',
    completed: 'success',
    needs_revision: 'warning',
  };

  const tabItems = [
    {
      key: 'overview',
      label: <span><FileTextOutlined /> 概览</span>,
      children: (
        <div>
          <Card title="制作参数" style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2, md: 3 }} bordered size="small">
              <Descriptions.Item label="项目名称">{project.name}</Descriptions.Item>
              <Descriptions.Item label="画幅比例">{project.aspectRatio}</Descriptions.Item>
              <Descriptions.Item label="情感基调">{project.emotionalTone || '-'}</Descriptions.Item>
              <Descriptions.Item label="每集时长">{project.episodeDuration}</Descriptions.Item>
              <Descriptions.Item label="总集数">{project.totalEpisodes} 集</Descriptions.Item>
              <Descriptions.Item label="素材数量">{project.assetCount} 个</Descriptions.Item>
              <Descriptions.Item label="视觉风格" span={3}>
                <Text style={{ fontSize: 12 }}>{project.style || '-'}</Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="流程状态">
            <Space size="large" wrap>
              {project.pipeline.map(p => (
                <Tag
                  key={p.stage}
                  color={statusColors[p.status] || 'default'}
                  style={{ padding: '4px 12px', fontSize: 13 }}
                >
                  {stageLabels[p.stage] || p.stage}
                </Tag>
              ))}
            </Space>
          </Card>
        </div>
      ),
    },
    {
      key: 'script',
      label: <span><FileTextOutlined /> 剧本</span>,
      children: <ScriptView projectId={projectId} />,
    },
    {
      key: 'assets',
      label: <span><PictureOutlined /> 素材 ({project.assetCount})</span>,
      children: <AssetList projectId={projectId} />,
    },
    {
      key: 'storyboard',
      label: <span><VideoCameraOutlined /> 分镜 ({project.episodeCount})</span>,
      children: <EpisodeList projectId={projectId} projectName={project.name} />,
    },
    {
      key: 'pipeline',
      label: <span><NodeIndexOutlined /> 流程</span>,
      children: <PipelineView projectId={projectId} />,
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px' }}>
      <div style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          type="text"
          onClick={() => router.push('/')}
        >
          返回项目列表
        </Button>
      </div>
      <Title level={3} style={{ marginBottom: 24 }}>{project.name}</Title>
      <Tabs items={tabItems} defaultActiveKey="overview" size="large" />
    </div>
  );
}
