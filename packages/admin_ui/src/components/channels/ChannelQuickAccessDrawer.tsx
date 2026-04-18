import { Drawer, Form, Input, Button, message, Alert, Switch, InputNumber } from 'antd'
import { useState } from 'react'
import { useHermesClient } from 'hermes_web_panel_client'

interface ChannelQuickAccessDrawerProps {
  open: boolean
  profileName: string
  channelId: string
  channelLabel: string
  fields: { name: string; label: string; type?: 'password' | 'text' | 'switch' | 'number'; required?: boolean }[]
  onClose: () => void
  onComplete: () => void
}

export default function ChannelQuickAccessDrawer({
  open,
  profileName,
  channelId,
  channelLabel,
  fields,
  onClose,
  onComplete,
}: ChannelQuickAccessDrawerProps) {
  const client = useHermesClient()
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (values: Record<string, string>) => {
    setSubmitting(true)
    try {
      await client.updateChannel(profileName, channelId, values)
      message.success(`${channelLabel} 配置已保存`)
      form.resetFields()
      onComplete()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存配置失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer
      title={`${channelLabel} - 快速接入`}
      open={open}
      onClose={onClose}
      width={480}
    >
      <Alert
        message={`请输入 ${channelLabel} 所需的凭证信息`}
        description="这些配置会直接写入当前的配置档案。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        {fields.map((field) => (
          <Form.Item
            key={field.name}
            name={field.name}
            label={field.label}
            rules={field.required ? [{ required: true, message: `请输入${field.label}` }] : []}
            valuePropName={field.type === 'switch' ? 'checked' : undefined}
          >
            {field.type === 'password' ? <Input.Password /> :
             field.type === 'switch' ? <Switch /> :
             field.type === 'number' ? <InputNumber style={{ width: '100%' }} /> :
             <Input />}
          </Form.Item>
        ))}
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting} block>
            保存到配置档案
          </Button>
        </Form.Item>
      </Form>
    </Drawer>
  )
}
