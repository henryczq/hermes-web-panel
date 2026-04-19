import { Alert, Button, Card, Empty, Space, Table, Tabs, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useMemo, useState } from 'react'
import { useHermesClient } from 'hermes_web_panel_client'
import { useAsyncData } from '../hooks/useAsyncData'
import type { ChannelOverviewItem } from 'hermes_web_panel_contract'

const { Title, Text } = Typography

const CHANNEL_TABS = [
  'feishu',
  'dingtalk',
  'qq',
  'weixin',
  'weixin_mp',
  'wecom_bot',
  'wecom_app',
  'wecom_kf',
  'telegram',
] as const

function channelLabel(channelId: string): string {
  const labels: Record<string, string> = {
    feishu: '飞书',
    dingtalk: '钉钉',
    qq: 'QQ',
    weixin: '微信',
    weixin_mp: '微信公众号',
    wecom_bot: '企微机器人',
    wecom_app: '企微应用',
    wecom_kf: '企微客服',
    telegram: 'Telegram',
  }
  return labels[channelId] || channelId
}

export default function ChannelsPage() {
  const client = useHermesClient()
  const [activeTab, setActiveTab] = useState<string>('feishu')

  const { data, loading, reload } = useAsyncData<ChannelOverviewItem[]>(
    () => client.getChannelsOverview(),
    [],
  )

  const filtered = useMemo(() => {
    return (data || []).filter((item) => item.channel_id === activeTab)
  }, [data, activeTab])

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

  const tabItems = CHANNEL_TABS.map((channelId) => ({
    key: channelId,
    label: channelLabel(channelId),
    children: (
      <div>
        <Card style={{ marginBottom: 16 }}>
          <Text type="secondary">
            当前渠道：{channelLabel(channelId)}。这里展示已经配置这个渠道的相关档案，以及它们是独立配置还是继承某个共享配置源。
          </Text>
          {channelId === 'feishu' && (
            <Alert
              style={{ marginTop: 12 }}
              type="info"
              showIcon
              message="飞书扫码登录 / 测试绑定能力需保留，后续会继续在这个 Tab 内整合回原有入口。"
            />
          )}
        </Card>

        <Card>
          <Table
            rowKey={(row) => `${row.profile_name}:${row.channel_id}`}
            dataSource={filtered}
            columns={columns}
            loading={loading}
            pagination={false}
            locale={{ emptyText: <Empty description={`暂无 ${channelLabel(channelId)} 相关档案`} /> }}
          />
        </Card>
      </div>
    ),
  }))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>渠道管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={reload} loading={loading} />
        </Space>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
    </div>
  )
}
