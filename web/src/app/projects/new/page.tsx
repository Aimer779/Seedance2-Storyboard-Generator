'use client';

import React, { useState } from 'react';
import {
  Steps, Button, Form, Input, Select, InputNumber,
  Card, Typography, Space, message, Result,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function NewProjectPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const handleNext = async () => {
    try {
      if (currentStep === 0) {
        await form.validateFields(['name', 'aspectRatio', 'emotionalTone', 'totalEpisodes']);
      }
      if (currentStep === 1) {
        await form.validateFields(['style']);
      }
      setCurrentStep(currentStep + 1);
    } catch {
      // validation failed
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const values = form.getFieldsValue(true);
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          style: values.style || '',
          aspectRatio: values.aspectRatio || '9:16',
          emotionalTone: values.emotionalTone || '',
          episodeDuration: values.episodeDuration || '15秒',
          totalEpisodes: values.totalEpisodes || 0,
          markdownFormat: values.markdownFormat || 'linchong',
        }),
      });
      const data = await res.json();
      if (data.error) {
        message.error(data.error);
        return;
      }
      message.success('项目创建成功');
      router.push(`/projects/${data.id}`);
    } catch {
      message.error('创建项目失败');
    } finally {
      setCreating(false);
    }
  };

  const steps = [
    {
      title: '基本信息',
      content: (
        <div style={{ maxWidth: 500 }}>
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="如：林教头风雪山神庙" />
          </Form.Item>
          <Form.Item name="aspectRatio" label="画幅比例" initialValue="9:16">
            <Select options={[
              { label: '9:16 竖屏', value: '9:16' },
              { label: '16:9 横屏', value: '16:9' },
              { label: '1:1 方形', value: '1:1' },
            ]} />
          </Form.Item>
          <Form.Item name="emotionalTone" label="情感基调">
            <Input placeholder="如：悬疑紧张、悲壮史诗" />
          </Form.Item>
          <Form.Item name="totalEpisodes" label="预计集数" initialValue={5}>
            <InputNumber min={1} max={99} />
          </Form.Item>
          <Form.Item name="episodeDuration" label="每集时长" initialValue="15秒">
            <Select options={[
              { label: '15秒', value: '15秒' },
              { label: '30秒', value: '30秒' },
              { label: '60秒', value: '60秒' },
            ]} />
          </Form.Item>
          <Form.Item name="markdownFormat" label="Markdown 格式" initialValue="linchong">
            <Select options={[
              { label: '林冲格式（纯英文段落 + 粗体时段标记）', value: 'linchong' },
              { label: '崖山格式（引用块 + 代码块）', value: 'yashan' },
            ]} />
          </Form.Item>
        </div>
      ),
    },
    {
      title: '风格前缀',
      content: (
        <div style={{ maxWidth: 600 }}>
          <Paragraph type="secondary">
            所有素材生成 Prompt 的统一风格前缀（英文）。这将确保角色、场景、道具的视觉风格一致。
          </Paragraph>
          <Form.Item name="style" label="Style Prefix" rules={[{ required: true, message: '请输入风格前缀' }]}>
            <TextArea
              rows={4}
              placeholder="如：Chinese ink wash painting style mixed with anime cel-shading"
            />
          </Form.Item>
        </div>
      ),
    },
    {
      title: '确认创建',
      content: (
        <div style={{ maxWidth: 500 }}>
          <Result
            status="info"
            title="确认项目信息"
            subTitle="请检查以下信息是否正确"
          />
          <Card size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div><Text strong>项目名称：</Text> {form.getFieldValue('name')}</div>
              <div><Text strong>画幅比例：</Text> {form.getFieldValue('aspectRatio')}</div>
              <div><Text strong>情感基调：</Text> {form.getFieldValue('emotionalTone') || '-'}</div>
              <div><Text strong>预计集数：</Text> {form.getFieldValue('totalEpisodes')} 集</div>
              <div><Text strong>每集时长：</Text> {form.getFieldValue('episodeDuration')}</div>
              <div><Text strong>格式：</Text> {form.getFieldValue('markdownFormat') === 'yashan' ? '崖山格式' : '林冲格式'}</div>
              <div>
                <Text strong>风格前缀：</Text>
                <Paragraph style={{ fontSize: 12, fontFamily: 'monospace', margin: '4px 0 0' }}>
                  {form.getFieldValue('style')}
                </Paragraph>
              </div>
            </Space>
          </Card>
        </div>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px' }}>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => router.push('/')}>
          返回项目列表
        </Button>
      </div>
      <Title level={3} style={{ marginBottom: 24 }}>新建项目</Title>

      <Steps current={currentStep} items={steps.map(s => ({ title: s.title }))} style={{ marginBottom: 32 }} />

      <Form form={form} layout="vertical">
        <Card>
          {steps[currentStep].content}
        </Card>
      </Form>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
        <Button
          disabled={currentStep === 0}
          onClick={() => setCurrentStep(currentStep - 1)}
        >
          上一步
        </Button>
        <Space>
          {currentStep < steps.length - 1 && (
            <Button type="primary" onClick={handleNext}>
              下一步
            </Button>
          )}
          {currentStep === steps.length - 1 && (
            <Button type="primary" onClick={handleCreate} loading={creating}>
              创建项目
            </Button>
          )}
        </Space>
      </div>
    </div>
  );
}
