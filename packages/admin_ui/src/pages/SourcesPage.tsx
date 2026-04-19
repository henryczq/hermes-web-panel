import { Alert, Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMemo, useState } from 'react'
import { useHermesClient } from 'hermes_web_panel_client'
import { useAsyncData } from '../hooks/useAsyncData.js'
import type { ConfigSourceItem, HermesProfileSummary } from 'hermes_web_panel_contract'

const { Title } = Typography

export default function SourcesPage() {
  const client = useHermesClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [bindOpen, setBindOpen] = useState(false)
  const [target, setTarget] = useState<ConfigSourceItem | null>(null)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [bindForm] = Form.useForm()

  const { data, loading, reload } = useAsyncData<ConfigSourceItem[]>(
    () => client.listConfigSources(),
    [],
  )

  const { data: profiles, reload: reloadProfiles } = useAsyncData<HermesProfileSummary[]>(
    () => client.listProfiles(),
    [],
  )

  const sourceIdToProfiles = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const item of data || []) {
      map.set(item.id, item.linked_profiles || [])
    }
    return map
  }, [data])

  const handleCreate = async (values: { name: string; backing_profile?: string; display_name?: string; note?: string }) => {
    try {
      await client.createConfigSource({
        name: values.name.trim(),
        backing_profile: values.backing_profile || null,
        display_name: values.display_name?.trim() || null,
        note: values.note?.trim() || null,
      })
      message.success('共享配置已创建')
      setCreateOpen(false)
      form.resetFields()
      reload()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建共享配置失败')
    }
  }

  const handleEdit = async (values: { name: string; backing_profile?: string; display_name?: string; note?: string }) => {
    if (!target) return
    try {
      await client.updateConfigSource(target.id, {
        name: values.name.trim(),
        backing_profile: values.backing_profile || null,
        display_name: values.display_name?.trim() || null,
        note: values.note?.trim() || null,
      })
      message.success('共享配置已更新')
      setEditOpen(false)
      setTarget(null)
      editForm.resetFields()
      reload()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '更新共享配置失败')
    }
  }

  const handleDelete = async (record: ConfigSourceItem) => {
    Modal.confirm({
      title: `删除共享配置：${record.display_name || record.name}`,
      content: '会解除该共享配置与所有档案的继承关系，但不会删除承载档案里的实际文件。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await client.deleteConfigSource(record.id)
          message.success('共享配置已删除')
          reload()
          reloadProfiles()
        } catch (e) {
          message.error(e instanceof Error ? e.message : '删除共享配置失败')
        }
      },
    })
  }

  const handleBindProfiles = async (values: { profile_names: string[] }) => {
    if (!target) return
    try {
      const selected = new Set(values.profile_names || [])
      const current = new Set(sourceIdToProfiles.get(target.id) || [])
      const allProfiles = profiles || []

      for (const profile of allProfiles) {
        const shouldBind = selected.has(profile.name)
        const isBound = current.has(profile.name)
        if (shouldBind && !isBound) {
          await client.updateProfileBinding(profile.name, { mode: 'inherit', source_id: target.id })
        }
        if (!shouldBind && isBound) {
          await client.updateProfileBinding(profile.name, { mode: 'standalone', source_id: null })
        }
      }

      message.success('关联档案已更新')
      setBindOpen(false)
      setTarget(null)
      bindForm.resetFields()
      reload()
      reloadProfiles()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '更新关联档案失败')
    }
  }

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ConfigSourceItem) => (
        <Space direction="vertical" size={0}>
          <span>
            {record.display_name || name} {record.kind === 'default' ? <Tag color="blue">默认</Tag> : null}
          </span>
          {record.display_name ? <Typography.Text type="secondary">ID: {name}</Typography.Text> : null}
        </Space>
      ),
    },
    { title: '类型', dataIndex: 'kind', key: 'kind' },
    {
      title: '承载档案',
      key: 'backing_profile',
      render: (_: unknown, record: ConfigSourceItem) => record.backing_profile || '-',
    },
    {
      title: '关联档案',
      key: 'linked_profiles',
      render: (_: unknown, record: ConfigSourceItem) => record.linked_profiles.length,
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      render: (note?: string | null) => note || '-',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: ConfigSourceItem) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setTarget(record)
              editForm.setFieldsValue({
                name: record.name,
                backing_profile: record.backing_profile || undefined,
                display_name: record.display_name || '',
                note: record.note || '',
              })
              setEditOpen(true)
            }}
          >
            编辑
          </Button>
          {record.kind !== 'default' ? (
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            >
              删除
            </Button>
          ) : null}
          <Button
            size="small"
            onClick={() => {
              setTarget(record)
              bindForm.setFieldsValue({
                profile_names: sourceIdToProfiles.get(record.id) || [],
              })
              setBindOpen(true)
            }}
          >
            管理档案
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>共享配置</Title>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<ReloadOutlined />} onClick={reload} loading={loading} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新建共享配置
          </Button>
        </div>
      </div>
      <Card>
        <Table rowKey="id" dataSource={data || []} columns={columns} pagination={false} loading={loading} />
      </Card>

      <Modal
        title="新建共享配置"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="共享配置需要一个承载档案"
            description="如果你不手动指定承载档案，系统会自动创建一个与共享配置同名的 backing profile，用来保存该共享配置的 AI、.env 和渠道等实际文件。"
          />
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：china-main / ai-prod" />
          </Form.Item>
          <Form.Item name="display_name" label="显示名称">
            <Input placeholder="例如：国内主配置" />
          </Form.Item>
          <Form.Item name="backing_profile" label="承载档案">
            <Select
              allowClear
              options={(profiles || []).map((p) => ({ value: p.name, label: p.display_name || p.name }))}
            />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑共享配置"
        open={editOpen}
        onCancel={() => { setEditOpen(false); setTarget(null); editForm.resetFields() }}
        onOk={() => editForm.submit()}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item name="name" label="内部名称" rules={[{ required: true, message: '请输入内部名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="display_name" label="显示名称">
            <Input />
          </Form.Item>
          <Form.Item name="backing_profile" label="承载档案">
            <Select
              allowClear
              options={(profiles || []).map((p) => ({ value: p.name, label: p.display_name || p.name }))}
            />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="管理关联档案"
        open={bindOpen}
        onCancel={() => { setBindOpen(false); setTarget(null); bindForm.resetFields() }}
        onOk={() => bindForm.submit()}
      >
        <Form form={bindForm} layout="vertical" onFinish={handleBindProfiles}>
          <Form.Item name="profile_names" label="关联档案">
            <Select
              mode="multiple"
              placeholder="选择要绑定到这个共享配置的档案"
              options={(profiles || []).map((p) => ({ value: p.name, label: p.display_name || p.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
