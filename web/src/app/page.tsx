'use client';

import React, { useEffect, useState } from 'react';
import {
  Card, Row, Col, Button, Typography, Tag, Space, Empty, message, Spin, Popconfirm,
} from 'antd';
import {
  ImportOutlined, PlusOutlined, VideoCameraOutlined,
  PlayCircleOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';

const { Title, Text, Paragraph } = Typography;

interface ProjectItem {
  id: number;
  name: string;
  folderName: string;
  style: string;
  aspectRatio: string;
  totalEpisodes: number;
  status: string;
  createdAt: string;
}

export default function HomePage() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const router = useRouter();

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      message.error('获取项目列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await fetch('/api/projects/import', { method: 'POST' });
      const data = await res.json();
      if (data.imported?.length > 0) {
        message.success(`成功导入 ${data.imported.length} 个项目`);
      }
      if (data.skipped?.length > 0) {
        message.info(`跳过 ${data.skipped.length} 个已导入的项目`);
      }
      if (data.imported?.length === 0 && data.skipped?.length === 0) {
        message.info('未发现可导入的项目');
      }
      fetchProjects();
    } catch {
      message.error('导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) {
        message.error(data.error);
        return;
      }
      message.success('项目已删除');
      fetchProjects();
    } catch {
      message.error('删除失败');
    }
  };

  const statusMap: Record<string, { color: string; text: string }> = {
    draft: { color: 'default', text: '草稿' },
    in_progress: { color: 'processing', text: '制作中' },
    completed: { color: 'success', text: '已完成' },
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <VideoCameraOutlined style={{ marginRight: 12 }} />
            Seedance 分镜工作台
          </Title>
          <Text type="secondary">Seedance 2.0 AI 视频制作管理系统</Text>
        </div>
        <Space>
          <Button
            icon={<ImportOutlined />}
            onClick={handleImport}
            loading={importing}
          >
            导入现有项目
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => router.push('/projects/new')}
          >
            新建项目
          </Button>
        </Space>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 100 }}>
          <Spin size="large" />
        </div>
      ) : projects.length === 0 ? (
        <Empty
          description="暂无项目，请点击「导入现有项目」或「新建项目」开始"
          style={{ padding: 100 }}
        >
          <Space>
            <Button type="primary" icon={<ImportOutlined />} onClick={handleImport} loading={importing}>
              导入现有项目
            </Button>
            <Button icon={<PlusOutlined />} onClick={() => router.push('/projects/new')}>
              新建项目
            </Button>
          </Space>
        </Empty>
      ) : (
        <Row gutter={[16, 16]}>
          {projects.map(project => (
            <Col xs={24} sm={12} lg={8} xl={6} key={project.id}>
              <Card
                hoverable
                onClick={() => router.push(`/projects/${project.id}`)}
                styles={{ body: { padding: 20 } }}
              >
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Title level={4} style={{ margin: 0, flex: 1 }} ellipsis>
                      {project.name}
                    </Title>
                    <Space size={4}>
                      <Tag color={statusMap[project.status]?.color || 'default'}>
                        {statusMap[project.status]?.text || project.status}
                      </Tag>
                      <Popconfirm
                        title="确认删除此项目？"
                        description="删除后数据库记录将被清除"
                        onConfirm={(e) => handleDelete(project.id, e as unknown as React.MouseEvent)}
                        onCancel={(e) => e?.stopPropagation()}
                        okText="删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                      >
                        <Button
                          type="text"
                          size="small"
                          icon={<DeleteOutlined />}
                          danger
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Popconfirm>
                    </Space>
                  </div>
                </div>

                {project.style && (
                  <Paragraph
                    type="secondary"
                    ellipsis={{ rows: 2 }}
                    style={{ fontSize: 12, marginBottom: 12 }}
                  >
                    {project.style}
                  </Paragraph>
                )}

                <Space size="middle">
                  <span>
                    <PlayCircleOutlined style={{ marginRight: 4 }} />
                    {project.totalEpisodes} 集
                  </span>
                  <span>
                    <Text type="secondary">{project.aspectRatio}</Text>
                  </span>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
