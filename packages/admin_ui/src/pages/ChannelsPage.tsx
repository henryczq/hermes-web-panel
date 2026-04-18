import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Divider,
  Form,
  Input,
  Modal,
  Space,
  Switch,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import { EditOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useHermesClient } from 'hermes_web_panel_client'
import { useAsyncData } from '../hooks/useAsyncData'
import { useProfile } from '../context/ProfileContext'
import type {
  ChannelListResponse,
  ChannelSnapshot,
  ChinaChannelMetaItem,
  ChinaChannelsBundle,
} from 'hermes_web_panel_contract'
import { ChannelOnboardModal, ChannelQuickAccessDrawer } from '../components/channels'

const { Title, Paragraph, Text, Link } = Typography

interface ChannelFieldDef {
  name: string
  label: string
  type?: 'text' | 'password' | 'switch' | 'number'
  required?: boolean
}

interface ChannelRegistryEntry {
  label?: string
  supportsScan: boolean
  quickFields: ChannelFieldDef[]
  editFields: ChannelFieldDef[]
  saveMapping?: (values: Record<string, unknown>) => Record<string, unknown>
}

const CHINA_CHANNEL_META_MAP: Record<string, string> = {
  feishu: 'feishu',
  wecom_bot: 'wecom',
  wecom_app: 'wecom-app',
  wecom_kf: 'wecom-kf',
  weixin_mp: 'wechat-mp',
  weixin: 'openclaw-weixin',
  qq: 'qqbot',
  dingtalk: 'dingtalk',
}

const PRIMARY_CHANNEL_ORDER = [
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

const CHANNEL_REGISTRY: Record<string, ChannelRegistryEntry> = {
  feishu: {
    supportsScan: true,
    quickFields: [],
    editFields: [
      { name: 'enabled', label: '启用', type: 'switch' },
      { name: 'app_id', label: 'App ID', required: true },
      { name: 'app_secret', label: 'App Secret', type: 'password' },
    ],
  },
  telegram: {
    label: 'Telegram',
    supportsScan: false,
    quickFields: [{ name: 'token', label: 'Bot Token', type: 'password', required: true }],
    editFields: [
      { name: 'enabled', label: '启用', type: 'switch' },
      { name: 'token', label: 'Bot Token', type: 'password', required: true },
    ],
  },
  wecom_bot: {
    supportsScan: true,
    quickFields: [],
    editFields: [
      { name: 'enabled', label: '启用', type: 'switch' },
      { name: 'bot_id', label: 'Bot ID', required: true },
      { name: 'secret', label: 'Secret', type: 'password' },
      { name: 'websocket_url', label: 'WebSocket URL' },
    ],
  },
  wecom_app: {
    supportsScan: false,
    quickFields: [
      { name: 'corpid', label: 'Corp ID', required: true },
      { name: 'agentid', label: 'Agent ID', required: true },
      { name: 'corpsecret', label: 'Corp Secret', type: 'password', required: true },
    ],
    editFields: [
      { name: 'enabled', label: '启用', type: 'switch' },
      { name: 'corpid', label: 'Corp ID', required: true },
      { name: 'agentid', label: 'Agent ID', required: true },
      { name: 'corpsecret', label: 'Corp Secret', type: 'password' },
    ],
  },
  wecom_kf: {
    supportsScan: false,
    quickFields: [
      { name: 'corpid', label: 'Corp ID', required: true },
      { name: 'secret', label: 'Secret', type: 'password', required: true },
    ],
    editFields: [
      { name: 'enabled', label: '启用', type: 'switch' },
      { name: 'corpid', label: 'Corp ID', required: true },
      { name: 'secret', label: 'Secret', type: 'password' },
    ],
  },
  weixin_mp: {
    supportsScan: false,
    quickFields: [
      { name: 'app_id', label: 'App ID', required: true },
      { name: 'app_secret', label: 'App Secret', type: 'password', required: true },
      { name: 'token', label: 'Token', required: true },
    ],
    editFields: [
      { name: 'enabled', label: '启用', type: 'switch' },
      { name: 'app_id', label: 'App ID', required: true },
      { name: 'app_secret', label: 'App Secret', type: 'password' },
      { name: 'token', label: 'Token' },
    ],
  },
  weixin: {
    supportsScan: true,
    quickFields: [
      { name: 'token', label: 'Token', required: true },
      { name: 'account_id', label: 'Account ID', required: true },
    ],
    editFields: [
      { name: 'enabled', label: '启用', type: 'switch' },
      { name: 'account_id', label: 'Account ID', required: true },
      { name: 'token', label: 'Token' },
      { name: 'base_url', label: 'Base URL' },
      { name: 'cdn_base_url', label: 'CDN Base URL' },
    ],
  },
  qq: {
    supportsScan: false,
    quickFields: [
      { name: 'app_id', label: 'App ID', required: true },
      { name: 'token', label: 'Token', type: 'password', required: true },
    ],
    editFields: [
      { name: 'enabled', label: '启用', type: 'switch' },
      { name: 'app_id', label: 'App ID', required: true },
      { name: 'token', label: 'Token', type: 'password' },
    ],
  },
  dingtalk: {
    supportsScan: false,
    quickFields: [
      { name: 'app_key', label: 'App Key', required: true },
      { name: 'app_secret', label: 'App Secret', type: 'password', required: true },
    ],
    editFields: [
      { name: 'enabled', label: '启用', type: 'switch' },
      { name: 'app_key', label: 'App Key', required: true },
      { name: 'app_secret', label: 'App Secret', type: 'password' },
    ],
    saveMapping: (values) => {
      const { app_key, app_secret, ...rest } = values
      return {
        ...rest,
        client_id: app_key,
        client_secret: app_secret,
      }
    },
  },
  api_server: {
    label: 'API Server',
    supportsScan: false,
    quickFields: [],
    editFields: [
      { name: 'enabled', label: '启用', type: 'switch' },
      { name: 'port', label: '端口', type: 'number' },
    ],
  },
  slack: {
    label: 'Slack',
    supportsScan: false,
    quickFields: [],
    editFields: [
      { name: 'enabled', label: '启用', type: 'switch' },
      { name: 'token', label: 'Bot Token', type: 'password' },
    ],
  },
  discord: {
    label: 'Discord',
    supportsScan: false,
    quickFields: [],
    editFields: [
      { name: 'enabled', label: '启用', type: 'switch' },
      { name: 'token', label: 'Bot Token', type: 'password' },
    ],
  },
  whatsapp: {
    label: 'WhatsApp',
    supportsScan: false,
    quickFields: [],
    editFields: [
      { name: 'enabled', label: '启用', type: 'switch' },
      { name: 'token', label: 'Token', type: 'password' },
    ],
  },
  signal: {
    label: 'Signal',
    supportsScan: false,
    quickFields: [],
    editFields: [
      { name: 'enabled', label: '启用', type: 'switch' },
      { name: 'url', label: 'HTTP URL' },
    ],
  },
  matrix: {
    label: 'Matrix',
    supportsScan: false,
    quickFields: [],
    editFields: [
      { name: 'enabled', label: '启用', type: 'switch' },
      { name: 'token', label: 'Access Token', type: 'password' },
    ],
  },
  webhook: {
    label: 'Webhook',
    supportsScan: false,
    quickFields: [],
    editFields: [
      { name: 'enabled', label: '启用', type: 'switch' },
      { name: 'url', label: 'URL' },
    ],
  },
}

const ENABLED_SCAN_CHANNELS: string[] = ['feishu', 'wecom_bot', 'weixin']

function renderFormField(field: ChannelFieldDef) {
  if (field.type === 'password') {
    return <Input.Password />
  }
  if (field.type === 'switch') {
    return <Switch />
  }
  if (field.type === 'number') {
    return <Input type="number" />
  }
  return <Input />
}

function getSharedMetaForChannel(
  channelId: string,
  items: ChinaChannelMetaItem[],
): ChinaChannelMetaItem | undefined {
  const metaId = CHINA_CHANNEL_META_MAP[channelId]
  if (!metaId) return undefined
  return items.find((item) => item.id === metaId)
}

function normalizeSharedText(text?: string | null): string {
  if (!text) return ''

  return text
    .replace(/openclaw\.json/gi, '当前配置档案对应的配置文件')
    .replace(/OpenClaw Panel/gi, 'Hermes 管理台')
    .replace(/OpenClaw/gi, 'Hermes')
}

export default function ChannelsPage() {
  const client = useHermesClient()
  const { selectedProfile } = useProfile()
  const [editingChannel, setEditingChannel] = useState<ChannelSnapshot | null>(null)
  const [activeChannelId, setActiveChannelId] = useState<string>('feishu')
  const [form] = Form.useForm()
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [onboardChannel, setOnboardChannel] = useState('')
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickChannel, setQuickChannel] = useState('')

  const { data, loading, reload } = useAsyncData<ChannelListResponse>(
    () => {
      if (!selectedProfile) {
        return Promise.resolve({ profile_name: '', channels: {} })
      }
      return client.getChannels(selectedProfile)
    },
    [selectedProfile],
  )

  const {
    data: chinaMeta,
    error: chinaMetaError,
  } = useAsyncData<ChinaChannelsBundle>(() => client.getChinaChannelsMeta(), [])

  const handleUpdate = async (values: Record<string, unknown>) => {
    if (!selectedProfile || !editingChannel) return
    const entry = CHANNEL_REGISTRY[editingChannel.channel_id]
    const payload = entry?.saveMapping ? entry.saveMapping(values) : values
    try {
      await client.updateChannel(selectedProfile, editingChannel.channel_id, payload)
      message.success('渠道配置已更新')
      setEditingChannel(null)
      reload()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '更新渠道配置失败')
    }
  }

  const handleQuickAccess = (channelId: string) => {
    const entry = CHANNEL_REGISTRY[channelId]
    if (!entry) return
    if (entry.supportsScan) {
      setOnboardChannel(channelId)
      setOnboardOpen(true)
      return
    }
    if (entry.quickFields.length > 0) {
      setQuickChannel(channelId)
      setQuickOpen(true)
    }
  }

  const handleOnboardComplete = () => {
    setOnboardOpen(false)
    reload()
  }

  const handleQuickComplete = () => {
    setQuickOpen(false)
    reload()
  }

  const editFields = useMemo(() => {
    if (!editingChannel) return []
    return CHANNEL_REGISTRY[editingChannel.channel_id]?.editFields || []
  }, [editingChannel])

  if (!selectedProfile) {
    return <Alert message="请先选择一个配置档案" type="info" />
  }

  const channels = data?.channels || {}
  const chinaMetaItems = chinaMeta?.items || []
  const visibleChannelIds = useMemo(() => {
    const ids = new Set<string>(PRIMARY_CHANNEL_ORDER)

    Object.keys(CHANNEL_REGISTRY).forEach((id) => ids.add(id))
    Object.keys(channels).forEach((id) => ids.add(id))

    return Array.from(ids).sort((a, b) => {
      const aPrimary = PRIMARY_CHANNEL_ORDER.indexOf(a as (typeof PRIMARY_CHANNEL_ORDER)[number])
      const bPrimary = PRIMARY_CHANNEL_ORDER.indexOf(b as (typeof PRIMARY_CHANNEL_ORDER)[number])

      if (aPrimary !== -1 || bPrimary !== -1) {
        if (aPrimary === -1) return 1
        if (bPrimary === -1) return -1
        return aPrimary - bPrimary
      }

      return a.localeCompare(b)
    })
  }, [channels])

  useEffect(() => {
    if (!visibleChannelIds.length) return
    if (!visibleChannelIds.includes(activeChannelId)) {
      setActiveChannelId(visibleChannelIds[0])
    }
  }, [activeChannelId, visibleChannelIds])

  const currentSnapshot: ChannelSnapshot = channels[activeChannelId] || {
    channel_id: activeChannelId,
    enabled: false,
    configured: false,
    config: {},
  }

  const currentEntry = CHANNEL_REGISTRY[activeChannelId]
  const currentMeta = getSharedMetaForChannel(activeChannelId, chinaMetaItems)
  const currentLabel = currentMeta?.name || currentEntry?.label || activeChannelId
  const currentScanSupported = ENABLED_SCAN_CHANNELS.includes(activeChannelId)
  const currentHasQuickAccess =
    !!currentEntry &&
    ((currentEntry.supportsScan && currentScanSupported) || currentEntry.quickFields.length > 0)

  const tabs = visibleChannelIds.map((id) => {
    const snapshot = channels[id]
    const meta = getSharedMetaForChannel(id, chinaMetaItems)
    const label = meta?.name || CHANNEL_REGISTRY[id]?.label || id
    return {
      key: id,
      label: (
        <Space size={8}>
          <span>{label}</span>
          {snapshot?.configured && <Tag color="blue">已配置</Tag>}
        </Space>
      ),
    }
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>渠道设置</Title>
        <Button icon={<ReloadOutlined />} onClick={reload} loading={loading} />
      </div>

      <Alert
        message="中国渠道优先"
        description="当前页面按飞书、钉钉、QQ、个人微信、微信公众号、企业微信机器人、企业微信应用、企业微信客服、Telegram 的顺序展示，方便按渠道逐个配置。"
        type="success"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {chinaMetaError && (
        <Alert
          message="中国渠道共享元数据加载失败"
          description={chinaMetaError}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card
        styles={{
          body: {
            padding: 0,
            overflow: 'hidden',
          },
        }}
      >
        <Tabs
          activeKey={activeChannelId}
          items={tabs}
          onChange={setActiveChannelId}
          tabBarStyle={{
            margin: 0,
            padding: '0 24px',
            background: 'linear-gradient(180deg, #fcfcfc 0%, #f6f8f7 100%)',
          }}
        />

        <div style={{ padding: 24 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 16,
              flexWrap: 'wrap',
              marginBottom: 20,
            }}
          >
            <div style={{ maxWidth: 760 }}>
              <Title level={2} style={{ marginTop: 0, marginBottom: 8 }}>
                {currentLabel}
              </Title>
              <Paragraph style={{ fontSize: 16, color: '#666', marginBottom: 0 }}>
                {normalizeSharedText(currentMeta?.detail?.intro || currentMeta?.summary) || '当前渠道尚未配置，先从编辑或快速接入开始。'}
              </Paragraph>
            </div>

            <Space wrap>
              {currentHasQuickAccess && (
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  onClick={() => handleQuickAccess(activeChannelId)}
                >
                  快速接入
                </Button>
              )}
              {currentEntry?.supportsScan && !currentScanSupported && (
                <Tooltip title="扫码接入能力暂未就绪，请先使用手动编辑方式配置">
                  <Button icon={<ThunderboltOutlined />} disabled>
                    即将支持扫码
                  </Button>
                </Tooltip>
              )}
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  setEditingChannel(currentSnapshot)
                  form.setFieldsValue({
                    enabled: currentSnapshot.enabled,
                    ...(currentSnapshot.config || {}),
                  })
                }}
              >
                编辑配置
              </Button>
            </Space>
          </div>

          <Descriptions
            bordered
            column={2}
            size="middle"
            style={{ marginBottom: 20 }}
            styles={{ label: { width: 120 } }}
          >
            <Descriptions.Item label="状态">
              <Space>
                <Tag color={currentSnapshot.enabled ? 'green' : 'default'}>
                  {currentSnapshot.enabled ? '已启用' : '未启用'}
                </Tag>
                <Tag color={currentSnapshot.configured ? 'blue' : 'default'}>
                  {currentSnapshot.configured ? '已配置' : '未配置'}
                </Tag>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="接入方式">
              {currentEntry?.supportsScan
                ? currentScanSupported
                  ? '扫码授权'
                  : '暂不支持扫码'
                : currentEntry?.quickFields.length
                  ? '快速填写凭证'
                  : '手动编辑'}
            </Descriptions.Item>
            <Descriptions.Item label="官方后台">
              {currentMeta?.adminUrl ? (
                <Link href={currentMeta.adminUrl} target="_blank">
                  打开后台
                </Link>
              ) : (
                <Text type="secondary">暂无</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="安装文档">
              {currentMeta?.installUrl ? (
                <Link href={currentMeta.installUrl} target="_blank">
                  查看文档
                </Link>
              ) : (
                <Text type="secondary">暂无</Text>
              )}
            </Descriptions.Item>
          </Descriptions>

          {!!currentSnapshot.config && Object.keys(currentSnapshot.config).length > 0 && (
            <Card
              size="small"
              title="当前配置摘要"
              style={{ marginBottom: 20, background: '#fafcfb' }}
            >
              <Space wrap size={[8, 8]}>
                {Object.entries(currentSnapshot.config)
                  .filter(([key]) => key !== 'enabled')
                  .map(([key, value]) => (
                    <Tag key={key}>
                      {key}: {value !== null && value !== undefined && value !== '' ? String(value) : '(empty)'}
                    </Tag>
                  ))}
              </Space>
            </Card>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 0.9fr)',
              gap: 20,
            }}
          >
            <Card title="配置提示">
              {!!currentMeta?.detail?.fields?.length ? (
                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                  {currentMeta.detail.fields.map((field) => (
                    <div key={field.key}>
                      <Text strong>{field.label}</Text>
                      <div style={{ color: '#666', marginTop: 4 }}>
                        {normalizeSharedText(field.description) || '暂无补充说明'}
                      </div>
                    </div>
                  ))}
                </Space>
              ) : (
                <Text type="secondary">当前渠道暂无共享字段说明。</Text>
              )}
            </Card>

            <Card title="使用说明">
              {!!currentMeta?.detail?.usageNotes?.length ? (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {currentMeta.detail.usageNotes.map((note) => (
                    <Alert key={note} type="info" showIcon message={normalizeSharedText(note)} />
                  ))}
                </Space>
              ) : (
                <Text type="secondary">当前渠道暂无共享使用说明。</Text>
              )}
            </Card>
          </div>

          {!!currentMeta?.tags?.length && (
            <>
              <Divider />
              <Space wrap>
                {currentMeta.tags.map((tag) => (
                  <Tag key={tag} color="green">
                    {tag}
                  </Tag>
                ))}
              </Space>
            </>
          )}
        </div>
      </Card>

      <Modal
        title={`编辑渠道：${
          getSharedMetaForChannel(editingChannel?.channel_id || '', chinaMetaItems)?.name ||
          CHANNEL_REGISTRY[editingChannel?.channel_id || '']?.label ||
          editingChannel?.channel_id
        }`}
        open={!!editingChannel}
        onCancel={() => setEditingChannel(null)}
        onOk={() => form.submit()}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleUpdate}>
          {editFields.map((field) => (
            <Form.Item
              key={field.name}
              name={field.name}
              label={field.label}
              valuePropName={field.type === 'switch' ? 'checked' : undefined}
              rules={field.required ? [{ required: true, message: `请输入${field.label}` }] : []}
            >
              {renderFormField(field)}
            </Form.Item>
          ))}
        </Form>
      </Modal>

      {onboardOpen && onboardChannel && (
        <ChannelOnboardModal
          open={onboardOpen}
          profileName={selectedProfile}
          channelId={onboardChannel}
          channelLabel={
            getSharedMetaForChannel(onboardChannel, chinaMetaItems)?.name ||
            CHANNEL_REGISTRY[onboardChannel]?.label ||
            onboardChannel
          }
          onClose={() => setOnboardOpen(false)}
          onComplete={handleOnboardComplete}
        />
      )}

      {quickOpen && quickChannel && CHANNEL_REGISTRY[quickChannel] && (
        <ChannelQuickAccessDrawer
          open={quickOpen}
          profileName={selectedProfile}
          channelId={quickChannel}
          channelLabel={
            getSharedMetaForChannel(quickChannel, chinaMetaItems)?.name ||
            CHANNEL_REGISTRY[quickChannel]?.label ||
            quickChannel
          }
          fields={CHANNEL_REGISTRY[quickChannel].quickFields}
          onClose={() => setQuickOpen(false)}
          onComplete={handleQuickComplete}
        />
      )}
    </div>
  )
}
