'use client';

import React from 'react';
import { Button, Alert, Spin, Typography } from 'antd';
import { StopOutlined, CheckOutlined } from '@ant-design/icons';
import dynamic from 'next/dynamic';

const MDPreview = dynamic(() => import('@uiw/react-md-editor').then(mod => mod.default.Markdown), { ssr: false });

const { Text } = Typography;

interface GenerationPanelProps {
  streamedText: string;
  isGenerating: boolean;
  error: string | null;
  status: string | null;
  onAbort: () => void;
  onApply?: () => void;
  title?: string;
}

export default function GenerationPanel({
  streamedText,
  isGenerating,
  error,
  status,
  onAbort,
  onApply,
  title,
}: GenerationPanelProps) {
  return (
    <div>
      {title && (
        <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 14 }}>
          {title}
        </Text>
      )}

      {error && (
        <Alert
          type="error"
          message="生成失败"
          description={error}
          showIcon
          style={{ marginBottom: 12 }}
        />
      )}

      {isGenerating && (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Spin size="small" />
          <Text type="secondary">{status || '正在生成...'}</Text>
          <Button
            size="small"
            danger
            icon={<StopOutlined />}
            onClick={onAbort}
          >
            停止
          </Button>
        </div>
      )}

      {streamedText && (
        <div
          style={{
            border: '1px solid #d9d9d9',
            borderRadius: 8,
            padding: 16,
            maxHeight: 500,
            overflow: 'auto',
            background: '#fafafa',
            marginBottom: 12,
          }}
          data-color-mode="light"
        >
          <MDPreview source={streamedText} />
        </div>
      )}

      {!isGenerating && streamedText && !error && onApply && (
        <Button
          type="primary"
          icon={<CheckOutlined />}
          onClick={onApply}
        >
          应用到项目
        </Button>
      )}
    </div>
  );
}
