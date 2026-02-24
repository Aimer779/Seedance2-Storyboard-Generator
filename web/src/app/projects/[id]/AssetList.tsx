'use client';

import React, { useEffect, useState } from 'react';
import { Card, Tag, Segmented, Empty, Spin, Typography, Space, Tooltip, message } from 'antd';
import { CopyOutlined, UserOutlined, EnvironmentOutlined, ToolOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

interface AssetItem {
  id: number;
  code: string;
  type: string;
  name: string;
  prompt: string;
  description: string;
  imagePath: string | null;
  usedInEpisodes: string[];
}

const typeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  character: { label: '角色 (C)', icon: <UserOutlined />, color: '#1677ff' },
  scene: { label: '场景 (S)', icon: <EnvironmentOutlined />, color: '#52c41a' },
  prop: { label: '道具 (P)', icon: <ToolOutlined />, color: '#fa8c16' },
};

export default function AssetList({ projectId }: { projectId: string }) {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetch(`/api/projects/${projectId}/assets`)
      .then(res => res.json())
      .then(data => setAssets(Array.isArray(data) ? data : []))
      .catch(() => message.error('获取素材失败'))
      .finally(() => setLoading(false));
  }, [projectId]);

  const filtered = filter === 'all'
    ? assets
    : assets.filter(a => a.type === filter);

  const counts = {
    all: assets.length,
    character: assets.filter(a => a.type === 'character').length,
    scene: assets.filter(a => a.type === 'scene').length,
    prop: assets.filter(a => a.type === 'prop').length,
  };

  const copyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    message.success('Prompt 已复制');
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Segmented
          value={filter}
          onChange={(val) => setFilter(val as string)}
          options={[
            { label: `全部 (${counts.all})`, value: 'all' },
            { label: `角色 (${counts.character})`, value: 'character' },
            { label: `场景 (${counts.scene})`, value: 'scene' },
            { label: `道具 (${counts.prop})`, value: 'prop' },
          ]}
          size="large"
        />
      </div>

      {filtered.length === 0 ? (
        <Empty description="暂无素材" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
          {filtered.map(asset => {
            const config = typeConfig[asset.type] || typeConfig.character;
            return (
              <Card
                key={asset.id}
                size="small"
                title={
                  <Space>
                    <Tag color={config.color} style={{ marginRight: 0 }}>
                      {asset.code}
                    </Tag>
                    <Text strong>{asset.name}</Text>
                  </Space>
                }
                extra={
                  <Tooltip title="复制 Prompt">
                    <CopyOutlined
                      style={{ cursor: 'pointer', color: '#1677ff' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        copyPrompt(asset.prompt);
                      }}
                    />
                  </Tooltip>
                }
              >
                {asset.description && (
                  <Paragraph
                    type="secondary"
                    ellipsis={{ rows: 2 }}
                    style={{ fontSize: 12, marginBottom: 8 }}
                  >
                    {asset.description}
                  </Paragraph>
                )}

                <Paragraph
                  ellipsis={{ rows: 3 }}
                  style={{ fontSize: 11, color: '#666', fontFamily: 'monospace', marginBottom: 8 }}
                >
                  {asset.prompt}
                </Paragraph>

                {asset.usedInEpisodes.length > 0 && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 11 }}>引用集数：</Text>
                    {asset.usedInEpisodes.map(ep => (
                      <Tag key={ep} style={{ fontSize: 11 }}>{ep}</Tag>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
