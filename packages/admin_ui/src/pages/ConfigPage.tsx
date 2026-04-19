import { useEffect, useState } from 'react'
import {
  Tabs,
  Input,
  Button,
  Card,
  Table,
  Space,
  message,
  Typography,
  Alert,
  Tag,
  Modal,
  Form,
} from 'antd'
import { SaveOutlined, ReloadOutlined, EyeOutlined, DeleteOutlined, HistoryOutlined } from '@ant-design/icons'
import { useHermesClient } from 'hermes_web_panel_client'
import { useAsyncData } from '../hooks/useAsyncData.js'
import { useProfile } from '../context/ProfileContext.js'
import type { ConfigRawResponse, EnvResponse, ConfigBackupItem } from 'hermes_web_panel_contract'

const { Title } = Typography
const { TextArea } = Input

export default function ConfigPage() {
  const client = useHermesClient()
  const { selectedProfile } = useProfile()
  const [configContent, setConfigContent] = useState('')
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({})
  const [addEnvOpen, setAddEnvOpen] = useState(false)
  const [addEnvForm] = Form.useForm()
  const [envSearch, setEnvSearch] = useState('')

  const { data: configData, loading: configLoading, reload: reloadConfig } = useAsyncData<ConfigRawResponse>(
    () => {
      if (!selectedProfile) return Promise.resolve({ profile_name: '', content: '' })
      return client.getConfigRaw(selectedProfile)
    },
    [selectedProfile],
  )

  const { data: envData, loading: envLoading, reload: reloadEnv } = useAsyncData<EnvResponse>(
    () => {
      if (!selectedProfile) return Promise.resolve({ profile_name: '', variables: {} })
      return client.getEnvState(selectedProfile)
    },
    [selectedProfile],
  )

  const { data: backupsData, loading: backupsLoading, reload: reloadBackups } = useAsyncData<ConfigBackupItem[]>(
    () => {
      if (!selectedProfile) return Promise.resolve([])
      return client.listConfigBackups(selectedProfile)
    },
    [selectedProfile],
  )

  useEffect(() => {
    if (configData) {
      setConfigContent(configData.content)
    }
  }, [configData])

  useEffect(() => {
    setRevealedKeys({})
  }, [selectedProfile])

  const handleSaveConfig = async () => {
    if (!selectedProfile) return
    try {
      await client.saveConfigRaw(selectedProfile, { content: configContent })
      message.success('配置已保存')
      reloadConfig()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存配置失败')
    }
  }

  const handleBackup = async () => {
    if (!selectedProfile) return
    try {
      await client.backupConfig(selectedProfile)
      message.success('配置已备份')
      reloadBackups()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '备份配置失败')
    }
  }

  const handleReveal = async (key: string) => {
    if (!selectedProfile) return
    try {
      const res = await client.revealEnvKey(selectedProfile, key)
      setRevealedKeys((prev) => ({ ...prev, [key]: res.value }))
    } catch (e) {
      message.error(e instanceof Error ? e.message : '查看密钥失败')
    }
  }

  const [updateEnvKey, setUpdateEnvKey] = useState<string | null>(null)
  const [updateEnvForm] = Form.useForm()

  const handleUpdateEnv = async (key: string) => {
    if (!selectedProfile) return
    setUpdateEnvKey(key)
    updateEnvForm.setFieldsValue({ value: '' })
  }

  const handleUpdateEnvSubmit = async (values: { value: string }) => {
    if (!selectedProfile || !updateEnvKey) return
    try {
      await client.updateEnvKey(selectedProfile, updateEnvKey, values.value)
      message.success('密钥已更新')
      setUpdateEnvKey(null)
      reloadEnv()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '更新密钥失败')
    }
  }

  const handleDeleteEnv = async (key: string) => {
    if (!selectedProfile) return
    Modal.confirm({
      title: `删除 ${key}？`,
      content: '此操作不可撤销。',
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await client.deleteEnvKey(selectedProfile, key)
          message.success('密钥已删除')
          reloadEnv()
        } catch (e) {
          message.error(e instanceof Error ? e.message : '删除密钥失败')
        }
      },
    })
  }

  const handleAddEnv = async (values: { key: string; value: string }) => {
    if (!selectedProfile) return
    try {
      await client.updateEnvKey(selectedProfile, values.key, values.value)
      message.success('密钥已添加')
      setAddEnvOpen(false)
      addEnvForm.resetFields()
      reloadEnv()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '添加密钥失败')
    }
  }

  const handleRollback = async (filename: string) => {
    if (!selectedProfile) return
    Modal.confirm({
      title: '回滚配置',
      content: `确定要回滚到备份“${filename}”吗？`,
      okText: '回滚',
      okType: 'danger',
      onOk: async () => {
        try {
          await client.rollbackConfig(selectedProfile, filename)
          message.success('配置已回滚')
          reloadConfig()
          reloadBackups()
        } catch (e) {
          message.error(e instanceof Error ? e.message : '回滚配置失败')
        }
      },
    })
  }

  if (!selectedProfile) {
    return <Alert message="请先在档案页选择一个档案后再进入高级配置" type="info" />
  }

  const envColumns = [
    { title: '键名', dataIndex: 'key', key: 'key' },
    {
      title: '值',
      key: 'value',
      render: (_: unknown, record: { key: string; value: boolean }) => {
        if (revealedKeys[record.key]) {
          return <Tag color="blue">{revealedKeys[record.key]}</Tag>
        }
        return record.value ? <Tag color="green">已配置</Tag> : <Tag>空</Tag>
      },
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: { key: string; value: boolean }) => (
        <Space>
          {record.value && (
            <Button size="small" icon={<EyeOutlined />} onClick={() => handleReveal(record.key)} />
          )}
          <Button size="small" onClick={() => handleUpdateEnv(record.key)}>编辑</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteEnv(record.key)} />
        </Space>
      ),
    },
  ]

  const backupColumns = [
    { title: '文件名', dataIndex: 'filename', key: 'filename' },
    {
      title: '修改时间',
      dataIndex: 'modified',
      key: 'modified',
      render: (value: number) => new Date(value * 1000).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: ConfigBackupItem) => (
        <Button size="small" danger onClick={() => handleRollback(record.filename)}>
          回滚
        </Button>
      ),
    },
  ]

  const envEntries = Object.entries(envData?.variables || {})
    .filter(([key]) => !envSearch || key.toLowerCase().includes(envSearch.toLowerCase()))
    .map(([key, value]) => ({
      key,
      value,
    }))

  return (
    <div>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="这里编辑的是原始配置文件，可能绕过配置源/档案绑定关系。建议仅高级用户使用。"
      />
      <Title level={4}>系统配置</Title>
      <Tabs
        defaultActiveKey="config"
        items={[
          {
            key: 'config',
            label: 'config.yaml',
            children: (
              <Card
                extra={
                  <Space>
                    <Button icon={<ReloadOutlined />} onClick={reloadConfig} loading={configLoading} />
                    <Button icon={<HistoryOutlined />} onClick={handleBackup}>
                      备份
                    </Button>
                    <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveConfig}>
                      保存
                    </Button>
                  </Space>
                }
              >
                <TextArea
                  value={configContent}
                  onChange={(e) => setConfigContent(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: 13, minHeight: 400 }}
                />
                {configData?.parsed && (
                  <Card title="解析预览" style={{ marginTop: 16 }} size="small">
                    <pre style={{ fontSize: 12, maxHeight: 300, overflow: 'auto' }}>
                      {JSON.stringify(configData.parsed, null, 2)}
                    </pre>
                  </Card>
                )}
              </Card>
            ),
          },
          {
            key: 'env',
            label: '.env',
            children: (
              <Card
                title="环境变量"
                extra={
                  <Space>
                    <Input.Search
                      placeholder="搜索键名"
                      allowClear
                      style={{ width: 200 }}
                      onChange={(e) => setEnvSearch(e.target.value)}
                    />
                    <Button type="primary" onClick={() => { setAddEnvOpen(true); addEnvForm.resetFields() }}>
                      添加键值
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={reloadEnv} loading={envLoading} />
                  </Space>
                }
              >
                <Table
                  columns={envColumns}
                  dataSource={envEntries}
                  rowKey="key"
                  pagination={false}
                  size="small"
                />
              </Card>
            ),
          },
          {
            key: 'backups',
            label: '备份',
            children: (
              <Card
                title="配置备份"
                extra={
                  <Button icon={<ReloadOutlined />} onClick={reloadBackups} loading={backupsLoading} />
                }
              >
                <Table
                  columns={backupColumns}
                  dataSource={backupsData || []}
                  rowKey="filename"
                  pagination={false}
                  size="small"
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title={`更新 ${updateEnvKey}`}
        open={!!updateEnvKey}
        onCancel={() => setUpdateEnvKey(null)}
        onOk={() => updateEnvForm.submit()}
      >
        <Form form={updateEnvForm} layout="vertical" onFinish={handleUpdateEnvSubmit}>
          <Form.Item name="value" label="值">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加环境变量"
        open={addEnvOpen}
        onCancel={() => setAddEnvOpen(false)}
        onOk={() => addEnvForm.submit()}
      >
        <Form form={addEnvForm} layout="vertical" onFinish={handleAddEnv}>
          <Form.Item name="key" label="键名" rules={[{ required: true, message: '请输入键名' }]}>
            <Input placeholder="例如：MY_API_KEY" />
          </Form.Item>
          <Form.Item name="value" label="值" rules={[{ required: true, message: '请输入值' }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
