import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useHermesClient } from 'hermes_web_panel_client'
import { useAsyncData } from '../hooks/useAsyncData'
import { ChannelOnboardModal, ChannelQuickAccessDrawer } from '../components/channels'

const { Title, Text } = Typography

const CHANNELS = [
  { id: 'feishu', label: '飞书', scan: true, fields: [] },
  {
    id: 'dingtalk',
    label: '钉钉',
    scan: false,
    fields: [
      { name: 'client_id', label: 'Client ID', required: true },
      { name: 'client_secret', label: 'Client Secret', type: 'password' as const, required: true },
    ],
  },
  {
    id: 'qq',
    label: 'QQ',
    scan: false,
    fields: [
      { name: 'app_id', label: 'App ID', required: true },
      { name: 'token', label: 'Token', type: 'password' as const, required: true },
    ],
  },
  { id: 'weixin', label: '微信', scan: true, fields: [] },
  {
    id: 'weixin_mp',
    label: '微信公众号',
    scan: false,
    fields: [
      { name: 'app_id', label: 'App ID', required: true },
      { name: 'app_secret', label: 'App Secret', type: 'password' as const, required: true },
      { name: 'token', label: 'Token', type: 'password' as const },
    ],
  },
  { id: 'wecom_bot', label: '企微机器人', scan: true, fields: [] },
  {
    id: 'wecom_app',
    label: '企微应用',
    scan: false,
    fields: [
      { name: 'corp_id', label: 'Corp ID', required: true },
      { name: 'agent_id', label: 'Agent ID', required: true },
      { name: 'secret', label: 'Secret', type: 'password' as const, required: true },
    ],
  },
  {
    id: 'wecom_kf',
    label: '企微客服',
    scan: false,
    fields: [
      { name: 'corp_id', label: 'Corp ID', required: true },
      { name: 'secret', label: 'Secret', type: 'password' as const, required: true },
      { name: 'account_id', label: '客服账号 ID', required: true },
    ],
  },
  {
    id: 'telegram',
    label: 'Telegram',
    scan: false,
    fields: [
      { name: 'token', label: 'Bot Token', type: 'password' as const, required: true },
    ],
  },
] as const

function channelHelpText(channelId: string): string {
  const mapping: Record<string, string> = {
    feishu: '飞书支持扫码接入。新增时先选择要绑定的档案，再进行扫码授权。',
    dingtalk: '钉钉按渠道维度管理，新增时先选档案，再保存到该档案。',
    qq: 'QQ 按渠道维度管理，新增时先选档案，再保存到该档案。',
    weixin: '微信支持扫码接入。新增时先选择要绑定的档案，再进行扫码授权。',
    weixin_mp: '微信公众号按渠道维度管理，新增时先选档案，再保存到该档案。',
    wecom_bot: '企微机器人支持扫码接入。新增时先选择要绑定的档案，再进行扫码授权。',
    wecom_app: '企微应用按渠道维度管理，新增时先选档案，再保存到该档案。',
    wecom_kf: '企微客服按渠道维度管理，新增时先选档案，再保存到该档案。',
    telegram: 'Telegram 按渠道维度管理，新增时先选档案，再保存到该档案。',
  }
  return mapping[channelId] || '请按渠道维度管理该渠道下的档案配置。'
}

function channelLabel(channelId: string): string {
  return CHANNELS.find((item) => item.id === channelId)?.label || channelId
}

export default function ChannelsPage() {
  const client = useHermesClient()
  const [activeTab, setActiveTab] = useState<string>('feishu')
  const [targetProfile, setTargetProfile] = useState<string | null>(null)
  const [drawerChannelId, setDrawerChannelId] = useState<string | null>(null)
  const [scanChannelId, setScanChannelId] = useState<string | null>(null)
  const [selectProfileModalOpen, setSelectProfileModalOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<'drawer' | 'scan' | null>(null)
  const [profileForm] = Form.useForm()

  const { data: profiles } = useAsyncData(
    () => client.listProfiles(),
    [],
  )

  const { data: overview, loading: overviewLoading, reload: reloadOverview } = useAsyncData(
    () => client.getChannelsOverview(),
    [],
  )

  const { data: bindings } = useAsyncData(
    () => client.listProfileBindings(),
    [],
  )

  const activeChannel = CHANNELS.find((item) => item.id === activeTab) || CHANNELS[0]
  const channelRows = useMemo(() => {
    const rows = (overview || []).filter((item) => item.channel_id === activeTab)
    return rows.sort((a, b) => a.profile_name.localeCompare(b.profile_name))
  }, [overview, activeTab])

  const openCreateFlow = (mode: 'drawer' | 'scan') => {
    setPendingAction(mode)
    setTargetProfile(null)
    profileForm.resetFields()
    setSelectProfileModalOpen(true)
  }

  const confirmProfileSelection = async () => {
    const values = await profileForm.validateFields()
    const selected = values.profile_name as string
    setTargetProfile(selected)
    setSelectProfileModalOpen(false)
    if (pendingAction === 'scan') {
      setScanChannelId(activeChannel.id)
    } else if (pendingAction === 'drawer') {
      setDrawerChannelId(activeChannel.id)
    }
  }

  const columns = [
    {
      title: '档案',
      dataIndex: 'profile_name',
      key: 'profile_name',
    },
    {
      title: '共享配置',
      key: 'source_name',
      render: (_: unknown, record: { source_name?: string | null; source_id?: string | null; mode: string }) => (
        record.mode === 'inherit'
          ? <Tag color="purple">{record.source_name || record.source_id || '未命名配置源'}</Tag>
          : <Tag>独立</Tag>
      ),
    },
    {
      title: '模式',
      dataIndex: 'mode',
      key: 'mode',
      render: (value: string) => value === 'inherit' ? '继承' : '独立',
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
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: { profile_name: string }) => (
        <Space>
          <Button
            size="small"
            onClick={() => {
              setTargetProfile(record.profile_name)
              setDrawerChannelId(activeChannel.id)
            }}
          >
            编辑
          </Button>
          {activeChannel.scan && (
            <Button
              size="small"
              onClick={() => {
                setTargetProfile(record.profile_name)
                setScanChannelId(activeChannel.id)
              }}
            >
              重新扫码
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>渠道管理</Title>
        <Button icon={<ReloadOutlined />} onClick={reloadOverview} loading={overviewLoading}>
          刷新
        </Button>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={CHANNELS.map((channel) => ({
          key: channel.id,
          label: channel.label,
          children: (
            <div>
              <Card
                style={{ marginBottom: 16 }}
                extra={
                  <Space>
                    <Button icon={<PlusOutlined />} onClick={() => openCreateFlow(channel.scan ? 'scan' : 'drawer')}>
                      新增档案到此渠道
                    </Button>
                    {channel.scan && (
                      <Button type="primary" onClick={() => openCreateFlow('scan')}>
                        扫码添加
                      </Button>
                    )}
                  </Space>
                }
              >
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message={`${channel.label} 以渠道维度管理`}
                  description={channelHelpText(channel.id)}
                />
                <Text type="secondary">
                  当前渠道下已关联档案数：{channelRows.length}
                </Text>
              </Card>

              <Card>
                <Table
                  rowKey={(row) => `${row.profile_name}:${row.channel_id}`}
                  columns={columns}
                  dataSource={channelRows}
                  loading={overviewLoading}
                  pagination={false}
                  locale={{ emptyText: <Empty description={`暂无 ${channel.label} 关联档案`} /> }}
                />
              </Card>
            </div>
          ),
        }))}
      />

      <Modal
        title={`选择要绑定到 ${channelLabel(activeChannel.id)} 的档案`}
        open={selectProfileModalOpen}
        onCancel={() => {
          setSelectProfileModalOpen(false)
          setPendingAction(null)
        }}
        onOk={confirmProfileSelection}
      >
        <Form form={profileForm} layout="vertical">
          <Form.Item
            name="profile_name"
            label="档案"
            rules={[{ required: true, message: '请选择档案' }]}
          >
            <Select
              placeholder="选择档案"
              options={(profiles || []).map((item) => {
                const binding = (bindings || []).find((x) => x.profile_name === item.name)
                const tags = [
                  item.display_name || item.name,
                  binding?.mode === 'inherit' ? `继承 ${binding.source_name || binding.source_id || ''}` : '独立',
                ].filter(Boolean)
                return {
                  value: item.name,
                  label: tags.join(' / '),
                }
              })}
            />
          </Form.Item>
        </Form>
      </Modal>

      {drawerChannelId && targetProfile && (
        <ChannelQuickAccessDrawer
          open={!!drawerChannelId}
          profileName={targetProfile}
          channelId={drawerChannelId}
          channelLabel={channelLabel(drawerChannelId)}
          fields={[...(CHANNELS.find((item) => item.id === drawerChannelId)?.fields || [])]}
          onClose={() => {
            setDrawerChannelId(null)
            setTargetProfile(null)
          }}
          onComplete={() => {
            setDrawerChannelId(null)
            setTargetProfile(null)
            reloadOverview()
          }}
        />
      )}

      {scanChannelId && targetProfile && (
        <ChannelOnboardModal
          open={!!scanChannelId}
          profileName={targetProfile}
          channelId={scanChannelId}
          channelLabel={channelLabel(scanChannelId)}
          onClose={() => {
            setScanChannelId(null)
            setTargetProfile(null)
          }}
          onComplete={() => {
            setScanChannelId(null)
            setTargetProfile(null)
            reloadOverview()
          }}
        />
      )}
    </div>
  )
}
