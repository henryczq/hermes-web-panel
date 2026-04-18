import { useState } from 'react'
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Card,
  Descriptions,
  Empty,
  Typography,
  Alert,
} from 'antd'
import {
  PlusOutlined,
  CopyOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  RedoOutlined,
} from '@ant-design/icons'
import { useHermesClient } from 'hermes_web_panel_client'
import { useAsyncData } from '../hooks/useAsyncData.js'
import { useProfile } from '../context/ProfileContext.js'
import type { HermesProfileSummary } from 'hermes_web_panel_contract'

const { Title, Text } = Typography
const PROFILE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/

function getProfileDisplayName(profileName: string): string {
  return profileName === 'default' ? '主配置' : profileName
}

function getPreferredProfileLabel(profile: HermesProfileSummary): string {
  return profile.display_name?.trim() || getProfileDisplayName(profile.name)
}

function isDefaultProfile(profileName: string): boolean {
  return profileName === 'default'
}

export default function ProfilesPage() {
  const client = useHermesClient()
  const { selectedProfile, setSelectedProfile } = useProfile()
  const [createOpen, setCreateOpen] = useState(false)
  const [cloneOpen, setCloneOpen] = useState(false)
  const [metaOpen, setMetaOpen] = useState(false)
  const [metaTarget, setMetaTarget] = useState<HermesProfileSummary | null>(null)
  const [gatewayBusyName, setGatewayBusyName] = useState<string | null>(null)
  const [gatewayBusyAction, setGatewayBusyAction] = useState<string | null>(null)
  const [form] = Form.useForm()
  const [cloneForm] = Form.useForm()
  const [metaForm] = Form.useForm()

  const { data, loading, reload } = useAsyncData<HermesProfileSummary[]>(
    () => client.listProfiles(),
    [],
  )

  const { data: summary, loading: summaryLoading, reload: reloadSummary } = useAsyncData<HermesProfileSummary | null>(
    () => {
      if (!selectedProfile) return Promise.resolve(null)
      return client.getProfileSummary(selectedProfile)
    },
    [selectedProfile],
  )

  const handleCreate = async (values: { name: string; display_name?: string; note?: string; clone_from?: string }) => {
    try {
      await client.createProfile({
        name: values.name.trim(),
        display_name: values.display_name?.trim() || null,
        note: values.note?.trim() || null,
        clone_from: values.clone_from,
      })
      message.success('配置档案已创建')
      setCreateOpen(false)
      form.resetFields()
      reload()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建配置档案失败')
    }
  }

  const handleClone = async (values: { name: string; display_name?: string; note?: string; clone_from: string }) => {
    try {
      await client.cloneProfile({
        name: values.name.trim(),
        display_name: values.display_name?.trim() || null,
        note: values.note?.trim() || null,
        clone_from: values.clone_from,
      })
      message.success('配置档案已克隆')
      setCloneOpen(false)
      cloneForm.resetFields()
      reload()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '克隆配置档案失败')
    }
  }

  const handleMetaSave = async (values: { display_name?: string; note?: string }) => {
    if (!metaTarget) return
    try {
      await client.updateProfileMeta(metaTarget.name, {
        display_name: values.display_name?.trim() || null,
        note: values.note?.trim() || null,
      })
      message.success('档案显示信息已更新')
      setMetaOpen(false)
      setMetaTarget(null)
      metaForm.resetFields()
      reload()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '更新档案显示信息失败')
    }
  }

  const handleDelete = async (name: string) => {
    if (isDefaultProfile(name)) {
      message.info('主配置档案对应 ~/.hermes，当前不支持删除')
      return
    }
    Modal.confirm({
      title: '删除配置档案',
      content: `确定要删除配置档案“${name}”吗？`,
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await client.deleteProfile(name)
          message.success('配置档案已删除')
          reload()
        } catch (e) {
          message.error(e instanceof Error ? e.message : '删除配置档案失败')
        }
      },
    })
  }

  const handleGatewayAction = async (record: HermesProfileSummary, action: 'start' | 'stop' | 'restart') => {
    const label = getPreferredProfileLabel(record)
    const actionLabelMap = {
      start: '启动',
      stop: '停止',
      restart: '重启',
    } as const

    try {
      setGatewayBusyName(record.name)
      setGatewayBusyAction(action)
      const result = await (
        action === 'start'
          ? client.startGateway(record.name)
          : action === 'stop'
            ? client.stopGateway(record.name)
            : client.restartGateway(record.name)
      )
      message.success(`${label}网关已${actionLabelMap[action]}`)
      if (result.stdout) {
        message.info(result.stdout)
      }
      reload()
      if (selectedProfile === record.name) {
        reloadSummary()
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : `${actionLabelMap[action]}网关失败`)
    } finally {
      setGatewayBusyName(null)
      setGatewayBusyAction(null)
    }
  }

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, record: HermesProfileSummary) => (
        <div>
          <a onClick={() => setSelectedProfile(record.name)} style={{ fontWeight: selectedProfile === record.name ? 600 : 400 }}>
            {getPreferredProfileLabel(record)}
          </a>
          {record.display_name?.trim() && (
            <div>
              <Text type="secondary">ID: {record.name}</Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean) => (active ? <Tag color="green">当前</Tag> : <Tag>未启用</Tag>),
    },
    {
      title: '默认模型',
      dataIndex: 'default_model',
      key: 'default_model',
      render: (model: string | null) => model || '-',
    },
    {
      title: '提供方',
      dataIndex: 'provider',
      key: 'provider',
      render: (provider: string | null) => provider || '-',
    },
    {
      title: '渠道数',
      dataIndex: 'channels',
      key: 'channels',
      render: (channels: string[]) => channels.length,
    },
    {
      title: '网关',
      dataIndex: 'has_gateway',
      key: 'has_gateway',
      render: (has: boolean) => (has ? <Tag color="blue">运行中</Tag> : <Tag>已停止</Tag>),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: HermesProfileSummary) => (
        <Space>
          <Button
            size="small"
            type={record.has_gateway ? 'default' : 'primary'}
            icon={<PlayCircleOutlined />}
            title="启动网关"
            loading={gatewayBusyName === record.name && gatewayBusyAction === 'start'}
            disabled={record.has_gateway}
            onClick={() => handleGatewayAction(record, 'start')}
          />
          <Button
            size="small"
            icon={<PauseCircleOutlined />}
            title="停止网关"
            loading={gatewayBusyName === record.name && gatewayBusyAction === 'stop'}
            disabled={!record.has_gateway}
            onClick={() => handleGatewayAction(record, 'stop')}
          />
          <Button
            size="small"
            icon={<RedoOutlined />}
            title="重启网关"
            loading={gatewayBusyName === record.name && gatewayBusyAction === 'restart'}
            disabled={!record.has_gateway}
            onClick={() => handleGatewayAction(record, 'restart')}
          />
          <Button
            size="small"
            icon={<EditOutlined />}
            title="编辑显示名称和备注"
            onClick={() => {
              setMetaTarget(record)
              metaForm.setFieldsValue({
                display_name: record.display_name || '',
                note: record.note || '',
              })
              setMetaOpen(true)
            }}
          />
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            disabled={isDefaultProfile(record.name)}
            title={isDefaultProfile(record.name) ? '主配置档案暂不支持删除' : '删除配置档案'}
            onClick={() => handleDelete(record.name)}
          />
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>配置档案</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={reload} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新建
          </Button>
          <Button icon={<CopyOutlined />} onClick={() => setCloneOpen(true)}>
            克隆
          </Button>
        </Space>
      </div>

      {selectedProfile && summary && (
        <Card style={{ marginBottom: 16 }} title="当前配置档案摘要" loading={summaryLoading}>
          {isDefaultProfile(summary.name) && (
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary">
                主配置对应 Hermes 原生目录 <code>~/.hermes</code>，用于当前机器的默认运行环境。
                你可以修改显示名称和备注，但不能删除，也不建议改动 Hermes 内部 ID。
              </Text>
            </div>
          )}
          <Descriptions column={3} size="small">
            <Descriptions.Item label="显示名称">{getPreferredProfileLabel(summary)}</Descriptions.Item>
            <Descriptions.Item label="内部 ID">{summary.name}</Descriptions.Item>
            <Descriptions.Item label="主目录">{summary.home_path}</Descriptions.Item>
            <Descriptions.Item label="配置文件">{summary.config_path}</Descriptions.Item>
            <Descriptions.Item label="环境变量">{summary.env_path}</Descriptions.Item>
            <Descriptions.Item label="模型">{summary.default_model || '-'}</Descriptions.Item>
            <Descriptions.Item label="提供方">{summary.provider || '-'}</Descriptions.Item>
            <Descriptions.Item label="网关">{summary.has_gateway ? '运行中' : '已停止'}</Descriptions.Item>
            <Descriptions.Item label="备注" span={3}>{summary.note || '-'}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <Table
        columns={columns}
        dataSource={data || []}
        rowKey="name"
        loading={loading}
        locale={{ emptyText: <Empty description="未找到配置档案" /> }}
        pagination={false}
      />

      <Modal
        title="新建配置档案"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="内部 ID 只用于 Hermes 内部识别"
            description="内部 ID 只能使用小写字母、数字、下划线和短横线，例如 fangan-guanli。真正展示给你看的中文名称，请填写下面的“显示名称”。"
          />
          <Form.Item
            name="name"
            label="内部 ID"
            rules={[
              { required: true, message: '请输入内部 ID' },
              {
                validator: async (_, value) => {
                  const normalized = String(value || '').trim()
                  if (!normalized) return
                  if (!PROFILE_ID_PATTERN.test(normalized)) {
                    throw new Error('内部 ID 只能使用小写字母、数字、下划线和短横线，例如 fangan-guanli')
                  }
                },
              },
            ]}
            extra="示例：fangan-guanli / crm-test / feishu-prod"
          >
            <Input placeholder="请输入 Hermes 内部 ID" />
          </Form.Item>
          <Form.Item name="display_name" label="显示名称" extra="列表、下拉和摘要里会优先显示这里的中文名">
            <Input placeholder="例如：方案管理" />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={3} placeholder="可选，记录这个档案的用途，例如：飞书正式环境 / 管理后台联调" />
          </Form.Item>
          <Form.Item name="clone_from" label="从已有配置复制（可选）">
            <Select
              allowClear
              options={(data || []).map((p) => ({
                value: p.name,
                label: getProfileDisplayName(p.name),
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="克隆配置档案"
        open={cloneOpen}
        onCancel={() => { setCloneOpen(false); cloneForm.resetFields() }}
        onOk={() => cloneForm.submit()}
      >
        <Form form={cloneForm} layout="vertical" onFinish={handleClone}>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="克隆时也需要一个新的内部 ID"
            description="内部 ID 仍然只能使用英文小写、数字、下划线和短横线。显示名称和备注可以用中文填写。"
          />
          <Form.Item
            name="name"
            label="新档案内部 ID"
            rules={[
              { required: true, message: '请输入新的内部 ID' },
              {
                validator: async (_, value) => {
                  const normalized = String(value || '').trim()
                  if (!normalized) return
                  if (!PROFILE_ID_PATTERN.test(normalized)) {
                    throw new Error('内部 ID 只能使用小写字母、数字、下划线和短横线，例如 fangan-guanli')
                  }
                },
              },
            ]}
            extra="示例：fangan-guanli / crm-test / feishu-prod"
          >
            <Input placeholder="请输入新的 Hermes 内部 ID" />
          </Form.Item>
          <Form.Item name="display_name" label="显示名称">
            <Input placeholder="例如：方案管理" />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={3} placeholder="可选，记录这个档案的用途" />
          </Form.Item>
          <Form.Item name="clone_from" label="来源配置档案" rules={[{ required: true }]}>
            <Select
              options={(data || []).map((p) => ({
                value: p.name,
                label: getProfileDisplayName(p.name),
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑档案显示信息"
        open={metaOpen}
        onCancel={() => {
          setMetaOpen(false)
          setMetaTarget(null)
          metaForm.resetFields()
        }}
        onOk={() => metaForm.submit()}
      >
        {metaTarget && (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="这里只修改管理台显示信息，不会修改 Hermes 内部 ID"
              description={`当前内部 ID：${metaTarget.name}`}
            />
            <Form form={metaForm} layout="vertical" onFinish={handleMetaSave}>
              <Form.Item name="display_name" label="显示名称">
                <Input placeholder="例如：方案管理" />
              </Form.Item>
              <Form.Item name="note" label="备注">
                <Input.TextArea rows={3} placeholder="可选，记录这个档案的用途" />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  )
}
