import { Button, Card, Empty, Select, Space, Table, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useMemo, useState } from 'react'
import { useHermesClient } from 'hermes_web_panel_client'
import { useAsyncData } from '../hooks/useAsyncData'
import type { ChannelOverviewItem } from 'hermes_web_panel_contract'

const { Title, Text } = Typography

function channelLabel(channelId: string): string {
  if (channelId === '-') return '未配置渠道'
  return channelId
}

export default function ChannelsPage() {
  const client = useHermesClient()
  const [selectedChannel, setSelectedChannel] = useState<string>()

  const { data, loading, reload } = useAsyncData<ChannelOverviewItem[]>(
    () => client.getChannelsOverview(),
    [],
  )

  const channelOptions = useMemo(() => {
    const ids = Array.from(new Set((data || []).map((item) => item.channel_id)))
    return ids.map((id) => ({ value: id, label: channelLabel(id) }))
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    if (!selectedChannel) return data
    return data.filter((item) => item.channel_id === selectedChannel)
  }, [data, selectedChannel])

  const columns = [
    {
      title: '档案',
      dataIndex: 'profile_name',
      key: 'profile_name',
    },
    {
      title: '配置源',
      key: 'source_name',
      render: (_: unknown, record: ChannelOverviewItem) => (
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
      title: '已配置',
      dataIndex: 'configured',
      key: 'configured',
      render: (value: boolean) => value ? <Tag color="green">已配置</Tag> : <Tag>未配置</Tag>,
    },
    {
      title: '已启用',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (value: boolean) => value ? <Tag color="blue">启用</Tag> : <Tag>未启用</Tag>,
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>渠道总览</Title>
        <Space>
          <Select
            allowClear
            style={{ width: 220 }}
            placeholder="筛选渠道"
            value={selectedChannel}
            onChange={setSelectedChannel}
            options={channelOptions}
          />
          <Button icon={<ReloadOutlined />} onClick={reload} loading={loading} />
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Text type="secondary">
          这里展示每个渠道在各档案中的配置状态，以及该档案当前是独立模式还是继承某个共享配置源。
        </Text>
      </Card>

      <Card>
        <Table
          rowKey={(row) => `${row.profile_name}:${row.channel_id}`}
          dataSource={filtered}
          columns={columns}
          loading={loading}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无渠道概览数据" /> }}
        />
      </Card>
    </div>
  )
}
