import { Button, Card, Form, Input, Modal, Select, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useHermesClient } from 'hermes_web_panel_client'
import { useAsyncData } from '../hooks/useAsyncData.js'
import type { ConfigSourceItem, HermesProfileSummary } from 'hermes_web_panel_contract'

const { Title } = Typography

export default function SourcesPage() {
  const client = useHermesClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [form] = Form.useForm()

  const { data, loading, reload } = useAsyncData<ConfigSourceItem[]>(
    () => client.listConfigSources(),
    [],
  )

  const { data: profiles } = useAsyncData<HermesProfileSummary[]>(
    () => client.listProfiles(),
    [],
  )

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

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ConfigSourceItem) => (
        <span>
          {record.display_name || name} {record.kind === 'default' ? <Tag color="blue">默认</Tag> : null}
        </span>
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
    </div>
  )
}
