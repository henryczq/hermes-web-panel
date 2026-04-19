import { Button, Card, Empty, Space, Table, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useHermesClient } from 'hermes_web_panel_client'
import { useAsyncData } from '../hooks/useAsyncData.js'
import type { AiOverviewItem } from 'hermes_web_panel_contract'

const { Title, Text } = Typography

export default function AIPage() {
  const client = useHermesClient()

  const { data, loading, reload } = useAsyncData<AiOverviewItem[]>(
    () => client.getAiOverview(),
    [],
  )

  const columns = [
    {
      title: '档案',
      dataIndex: 'profile_name',
      key: 'profile_name',
    },
    {
      title: '配置源',
      key: 'source_name',
      render: (_: unknown, record: AiOverviewItem) => (
        record.mode === 'inherit'
          ? <Tag color="purple">{record.source_name || record.source_id || '未命名配置源'}</Tag>
          : <Tag>独立</Tag>
      ),
    },
    {
      title: '模式',
      dataIndex: 'mode',
      key: 'mode',
      render: (mode: string) => mode === 'inherit' ? '继承' : '独立',
    },
    {
      title: '默认模型',
      dataIndex: 'default_model',
      key: 'default_model',
      render: (value?: string | null) => value || '-',
    },
    {
      title: 'Provider',
      dataIndex: 'provider',
      key: 'provider',
      render: (value?: string | null) => value || '-',
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>AI 总览</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={reload} loading={loading} />
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Text type="secondary">
          这里展示每个档案当前的 AI 配置摘要，以及它是否继承某个共享配置源。
        </Text>
      </Card>

      <Card>
        <Table
          rowKey={(row) => row.profile_name}
          dataSource={data || []}
          columns={columns}
          loading={loading}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无 AI 概览数据" /> }}
        />
      </Card>
    </div>
  )
}
