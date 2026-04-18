import { Card, Form, Input, Button, Space } from 'antd'
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons'
import JsonEditorCard from '../shared/JsonEditorCard'
import type { AIConfigResponse } from 'hermes_web_panel_contract'

interface AIConfigFormProps {
  data: AIConfigResponse | null
  loading: boolean
  onSave: (values: Record<string, string>) => void
  onReload: () => void
}

export default function AIConfigForm({ data, loading, onSave, onReload }: AIConfigFormProps) {
  const [form] = Form.useForm()

  const handleSave = (values: Record<string, string | undefined>) => {
    const parseJson = (val: string | undefined) => {
      if (!val) return null
      try { return JSON.parse(val) } catch { return null }
    }
    onSave({
      default_model: values.default_model || '',
      provider: values.provider || '',
      base_url: values.base_url || '',
      auxiliary: values.auxiliary ? JSON.stringify(parseJson(values.auxiliary)) : '',
      providers: values.providers ? JSON.stringify(parseJson(values.providers)) : '',
      fallback_providers: values.fallback_providers ? JSON.stringify(parseJson(values.fallback_providers)) : '',
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h4 style={{ margin: 0 }}>AI Configuration</h4>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={onReload} loading={loading} />
          <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()}>
            Save
          </Button>
        </Space>
      </div>

      <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{
        default_model: data?.default_model,
        provider: data?.provider,
        base_url: data?.base_url,
        auxiliary: data?.auxiliary ? JSON.stringify(data.auxiliary, null, 2) : '',
        providers: data?.providers ? JSON.stringify(data.providers, null, 2) : '',
        fallback_providers: data?.fallback_providers ? JSON.stringify(data.fallback_providers, null, 2) : '',
      }}>
        <Card title="Default Model" style={{ marginBottom: 16 }}>
          <Form.Item name="default_model" label="Default Model">
            <Input placeholder="e.g. gpt-4" />
          </Form.Item>
          <Form.Item name="provider" label="Provider">
            <Input placeholder="e.g. openai" />
          </Form.Item>
          <Form.Item name="base_url" label="Base URL">
            <Input placeholder="e.g. https://api.openai.com/v1" />
          </Form.Item>
        </Card>

        <JsonEditorCard
          title="Auxiliary (JSON)"
          value={data?.auxiliary}
          rows={4}
        />

        <JsonEditorCard
          title="Providers (JSON)"
          value={data?.providers}
          rows={6}
        />

        <JsonEditorCard
          title="Fallback Providers (JSON)"
          value={data?.fallback_providers}
          rows={4}
        />
      </Form>
    </div>
  )
}
