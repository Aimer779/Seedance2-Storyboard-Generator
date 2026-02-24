'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Tag, Segmented, Empty, Spin, Typography, Space, Tooltip, message,
  Button, Modal, Form, Input, Select, Upload,
} from 'antd';
import {
  CopyOutlined, UserOutlined, EnvironmentOutlined, ToolOutlined,
  EditOutlined, DeleteOutlined, PlusOutlined, UploadOutlined,
} from '@ant-design/icons';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

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

const typeCodePrefix: Record<string, string> = {
  character: 'C', scene: 'S', prop: 'P',
};

export default function AssetList({ projectId }: { projectId: string }) {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetItem | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/assets`);
      const data = await res.json();
      setAssets(Array.isArray(data) ? data : []);
    } catch {
      message.error('获取素材失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

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

  const openCreateModal = () => {
    setEditingAsset(null);
    // Generate next code
    const type = filter !== 'all' ? filter : 'character';
    const prefix = typeCodePrefix[type] || 'C';
    const existing = assets.filter(a => a.code.startsWith(prefix));
    const maxNum = existing.reduce((max, a) => {
      const num = parseInt(a.code.substring(1));
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    const nextCode = `${prefix}${String(maxNum + 1).padStart(2, '0')}`;

    form.setFieldsValue({
      code: nextCode,
      type,
      name: '',
      prompt: '',
      description: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (asset: AssetItem) => {
    setEditingAsset(asset);
    form.setFieldsValue({
      code: asset.code,
      type: asset.type,
      name: asset.name,
      prompt: asset.prompt,
      description: asset.description,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      if (editingAsset) {
        // Update
        const res = await fetch(`/api/projects/${projectId}/assets/${editingAsset.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
        const data = await res.json();
        if (data.error) { message.error(data.error); return; }
        message.success('素材更新成功');
      } else {
        // Create
        const res = await fetch(`/api/projects/${projectId}/assets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
        const data = await res.json();
        if (data.error) { message.error(data.error); return; }
        message.success('素材创建成功');
      }

      setModalOpen(false);
      fetchAssets();
    } catch {
      // validation error
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (asset: AssetItem) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/assets/${asset.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.error) { message.error(data.error); return; }
      message.success('素材已删除');
      fetchAssets();
    } catch {
      message.error('删除失败');
    }
  };

  const handleUploadImage = async (asset: AssetItem, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`/api/projects/${projectId}/assets/${asset.id}/image`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.error) { message.error(data.error); return; }
      message.success('图片上传成功');
      fetchAssets();
    } catch {
      message.error('上传失败');
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>;

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
          新增素材
        </Button>
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
                  <Space size={4}>
                    <Tooltip title="编辑">
                      <EditOutlined
                        style={{ cursor: 'pointer', color: '#1677ff' }}
                        onClick={(e) => { e.stopPropagation(); openEditModal(asset); }}
                      />
                    </Tooltip>
                    <Tooltip title="复制 Prompt">
                      <CopyOutlined
                        style={{ cursor: 'pointer', color: '#1677ff' }}
                        onClick={(e) => { e.stopPropagation(); copyPrompt(asset.prompt); }}
                      />
                    </Tooltip>
                    <Tooltip title="删除">
                      <DeleteOutlined
                        style={{ cursor: 'pointer', color: '#ff4d4f' }}
                        onClick={(e) => { e.stopPropagation(); handleDelete(asset); }}
                      />
                    </Tooltip>
                  </Space>
                }
              >
                {/* Image thumbnail */}
                {asset.imagePath && (
                  <div style={{ marginBottom: 8, textAlign: 'center' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/projects/${projectId}/assets/${asset.id}/image`}
                      alt={asset.name}
                      style={{ maxWidth: '100%', maxHeight: 150, objectFit: 'contain', borderRadius: 4 }}
                    />
                  </div>
                )}

                {/* Upload button */}
                <div style={{ marginBottom: 8 }}>
                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    beforeUpload={(file) => {
                      handleUploadImage(asset, file);
                      return false;
                    }}
                  >
                    <Button size="small" icon={<UploadOutlined />}>
                      {asset.imagePath ? '更换图片' : '上传图片'}
                    </Button>
                  </Upload>
                </div>

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

      {/* Create/Edit Modal */}
      <Modal
        title={editingAsset ? `编辑素材 ${editingAsset.code}` : '新增素材'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        width={600}
      >
        <Form form={form} layout="vertical">
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="code" label="编号" rules={[{ required: true }]} style={{ width: 120 }}>
              <Input placeholder="C01" />
            </Form.Item>
            <Form.Item name="type" label="类型" rules={[{ required: true }]} style={{ width: 150 }}>
              <Select options={[
                { label: '角色 (Character)', value: 'character' },
                { label: '场景 (Scene)', value: 'scene' },
                { label: '道具 (Prop)', value: 'prop' },
              ]} />
            </Form.Item>
            <Form.Item name="name" label="名称" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input placeholder="素材名称" />
            </Form.Item>
          </div>
          <Form.Item name="description" label="画面描述（中文）">
            <TextArea rows={2} placeholder="画面描述（崖山格式使用）" />
          </Form.Item>
          <Form.Item name="prompt" label="生成 Prompt（英文）" rules={[{ required: true }]}>
            <TextArea rows={6} placeholder="英文生成提示词" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
