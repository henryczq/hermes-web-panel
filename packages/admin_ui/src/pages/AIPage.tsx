import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tabs,
  Typography,
  message,
} from 'antd'
import { PlusOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import { useHermesClient } from 'hermes_web_panel_client'
import { useAsyncData } from '../hooks/useAsyncData.js'

const { Title, Text } = Typography

const BUILTIN_ENV_KEYS = [
  { key: 'OPENAI_API_KEY', label: 'OpenAI', provider: 'openai' },
  { key: 'OPENROUTER_API_KEY', label: 'OpenRouter', provider: 'openrouter' },
  { key: 'ANTHROPIC_API_KEY', label: 'Anthropic', provider: 'anthropic' },
  { key: 'GOOGLE_API_KEY', label: 'Google Gemini', provider: 'google' },
  { key: 'GEMINI_API_KEY', label: 'Gemini', provider: 'google' },
  { key: 'GLM_API_KEY', label: 'GLM / z.ai', provider: 'zai' },
  { key: 'KIMI_API_KEY', label: 'Kimi / Moonshot', provider: 'kimi-coding' },
  { key: 'MINIMAX_API_KEY', label: 'MiniMax', provider: 'minimax' },
  { key: 'MINIMAX_CN_API_KEY', label: 'MiniMax CN', provider: 'minimax-cn' },
  { key: 'NOUS_API_KEY', label: 'Nous', provider: 'nous' },
  { key: 'XIAOMI_API_KEY', label: 'Xiaomi', provider: 'xiaomi' },
  { key: 'HF_TOKEN', label: 'Hugging Face Token', provider: 'huggingface' },
] as const

const BUILTIN_AI_SOURCES = [
  {
    value: 'builtin:google',
    label: 'Google Gemini',
    provider: 'google',
    envKeys: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'],
    base_url: '',
  },
  {
    value: 'builtin:minimax',
    label: 'MiniMax 国际版',
    provider: 'minimax',
    envKeys: ['MINIMAX_API_KEY'],
    base_url: '',
  },
  {
    value: 'builtin:minimax-cn',
    label: 'MiniMax 国内版',
    provider: 'minimax-cn',
    envKeys: ['MINIMAX_CN_API_KEY'],
    base_url: 'https://api.minimaxi.com/anthropic',
  },
  {
    value: 'builtin:openai',
    label: 'OpenAI',
    provider: 'openai',
    envKeys: ['OPENAI_API_KEY'],
    base_url: 'https://api.openai.com/v1',
  },
  {
    value: 'builtin:openrouter',
    label: 'OpenRouter',
    provider: 'openrouter',
    envKeys: ['OPENROUTER_API_KEY'],
    base_url: 'https://openrouter.ai/api/v1',
  },
  {
    value: 'builtin:anthropic',
    label: 'Anthropic',
    provider: 'anthropic',
    envKeys: ['ANTHROPIC_API_KEY'],
    base_url: '',
  },
  {
    value: 'builtin:glm',
    label: 'GLM / z.ai',
    provider: 'zai',
    envKeys: ['GLM_API_KEY'],
    base_url: 'https://api.z.ai/api/coding/paas/v4',
  },
  {
    value: 'builtin:kimi',
    label: 'Kimi / Moonshot',
    provider: 'kimi-coding',
    envKeys: ['KIMI_API_KEY'],
    base_url: '',
  },
] as const

function jsonText(value: unknown): string {
  if (value == null) {
    return ''
  }
  return JSON.stringify(value, null, 2)
}

function parseJsonObject(value: string, fieldLabel: string): Record<string, unknown> | null {
  if (!value.trim()) {
    return null
  }
  const parsed = JSON.parse(value)
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error(`${fieldLabel}必须是 JSON 对象`)
  }
  return parsed as Record<string, unknown>
}

function parseJsonArray(value: string, fieldLabel: string): unknown[] | null {
  if (!value.trim()) {
    return null
  }
  const parsed = JSON.parse(value)
  if (!Array.isArray(parsed)) {
    throw new Error(`${fieldLabel}必须是 JSON 数组`)
  }
  return parsed
}

function pickCustomProviderModel(models: Record<string, unknown> | null | undefined): string | null {
  if (!models) {
    return null
  }
  const keys = Object.keys(models)
  return keys.length > 0 ? keys[0] : null
}

export default function AIPage() {
  const client = useHermesClient()
  const [form] = Form.useForm()
  const [envForm] = Form.useForm()
  const [customForm] = Form.useForm()
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [editingEnvKey, setEditingEnvKey] = useState<string | null>(null)
  const [customModalOpen, setCustomModalOpen] = useState(false)
  const [editingCustomName, setEditingCustomName] = useState<string | null>(null)
  const [customSaving, setCustomSaving] = useState(false)
  const [customTesting, setCustomTesting] = useState(false)
  const [selectedAiSource, setSelectedAiSource] = useState<string | undefined>(undefined)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importSubmitting, setImportSubmitting] = useState(false)
  const [importSourcePath, setImportSourcePath] = useState('')
  const [importCandidates, setImportCandidates] = useState<
    Array<{
      name: string
      base_url: string
      api_mode?: string | null
      api_key_configured: boolean
      models_count: number
      model_names: string[]
      import_strategy: string
      builtin_provider?: string | null
      builtin_label?: string | null
      reason?: string | null
    }>
  >([])
  const [selectedImportNames, setSelectedImportNames] = useState<React.Key[]>([])

  const { data: sources, loading: sourcesLoading, reload: reloadSources } = useAsyncData(
    () => client.listConfigSources(),
    [],
  )

  useEffect(() => {
    if (!selectedSourceId && sources && sources.length > 0) {
      const preferred = sources.find((item) => item.kind !== 'default') || sources[0]
      setSelectedSourceId(preferred.id)
    }
  }, [sources, selectedSourceId])

  const currentSource = useMemo(
    () => (sources || []).find((item) => item.id === selectedSourceId) || null,
    [sources, selectedSourceId],
  )

  const backingProfile = currentSource?.backing_profile || null

  const { data: aiConfig, loading: aiLoading, reload: reloadAi } = useAsyncData(
    () => {
      if (!backingProfile) return Promise.resolve(null)
      return client.getAiConfig(backingProfile)
    },
    [backingProfile],
  )

  const { data: envData, loading: envLoading, reload: reloadEnv } = useAsyncData(
    () => {
      if (!backingProfile) return Promise.resolve(null)
      return client.getEnvState(backingProfile)
    },
    [backingProfile],
  )

  const { data: customProviders, loading: customLoading, reload: reloadCustomProviders } = useAsyncData(
    () => {
      if (!backingProfile) return Promise.resolve(null)
      return client.getCustomProviders(backingProfile)
    },
    [backingProfile],
  )

  useEffect(() => {
    if (!aiConfig) {
      form.resetFields()
      return
    }
    form.setFieldsValue({
      default_model: aiConfig.default_model || '',
      provider: aiConfig.provider || '',
      base_url: aiConfig.base_url || '',
      embedding: jsonText(aiConfig.embedding),
      auxiliary: jsonText(aiConfig.auxiliary),
      providers: jsonText(aiConfig.providers),
      fallback_providers: jsonText(aiConfig.fallback_providers),
    })
  }, [aiConfig, form])

  const aiSourceOptions = useMemo(() => {
    const builtin = BUILTIN_AI_SOURCES
      .filter((item) => item.envKeys.some((envKey) => envData?.variables?.[envKey]))
      .map((item) => ({
        value: item.value,
        label: `${item.label} (${item.envKeys.find((envKey) => envData?.variables?.[envKey])})`,
        provider: item.provider,
        base_url: item.base_url,
      }))

    const custom = (customProviders?.providers || []).map((item) => ({
      value: `custom:${item.name}`,
      label: `自定义模型 / ${item.name}`,
      provider: 'custom',
      base_url: item.base_url,
      model: pickCustomProviderModel(item.models || null),
    }))

    return [...builtin, ...custom]
  }, [customProviders, envData])

  useEffect(() => {
    if (!aiConfig) {
      setSelectedAiSource(undefined)
      return
    }
    const matchedCustom = (customProviders?.providers || []).find(
      (item) => aiConfig.base_url && item.base_url === aiConfig.base_url,
    )
    if (matchedCustom) {
      setSelectedAiSource(`custom:${matchedCustom.name}`)
      return
    }

    const matchedBuiltin = BUILTIN_AI_SOURCES.find(
      (item) =>
        item.provider === aiConfig.provider &&
        item.envKeys.some((envKey) => envData?.variables?.[envKey]),
    )
    setSelectedAiSource(matchedBuiltin?.value)
  }, [aiConfig, customProviders, envData])

  const handleAiSourceChange = (value: string) => {
    setSelectedAiSource(value)
    const option = aiSourceOptions.find((item) => item.value === value)
    if (!option) return
    if (option.provider === 'custom') {
      form.setFieldsValue({
        provider: 'custom',
        base_url: option.base_url || '',
        default_model: option.model || form.getFieldValue('default_model'),
      })
      return
    }
    form.setFieldsValue({
      provider: option.provider,
      base_url: option.base_url || '',
    })
  }

  const handleSaveAi = async (values: Record<string, string>) => {
    if (!backingProfile) return
    try {
      await client.saveAiConfig(backingProfile, {
        default_model: values.default_model?.trim() || null,
        provider: values.provider?.trim() || null,
        base_url: values.base_url?.trim() || null,
        embedding: parseJsonObject(values.embedding || '', 'Embedding 配置'),
        auxiliary: parseJsonObject(values.auxiliary || '', '辅助配置'),
        providers: parseJsonObject(values.providers || '', '提供方配置'),
        fallback_providers: parseJsonArray(values.fallback_providers || '', '回退提供方'),
      })
      message.success('共享配置 AI 已保存')
      reloadAi()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存 AI 配置失败')
    }
  }

  const openEnvEditor = (envKey: string) => {
    setEditingEnvKey(envKey)
    envForm.setFieldsValue({ value: '' })
  }

  const handleSaveEnv = async (values: { value: string }) => {
    if (!backingProfile || !editingEnvKey) return
    try {
      await client.updateEnvKey(backingProfile, editingEnvKey, values.value)
      message.success('共享配置 API Key 已保存')
      setEditingEnvKey(null)
      envForm.resetFields()
      reloadEnv()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存 API Key 失败')
    }
  }

  const openCustomModal = (provider?: {
    name: string
    base_url: string
    api_key?: string | null
    api_mode?: string | null
    models?: Record<string, unknown> | null
  }) => {
    setCustomModalOpen(true)
    setEditingCustomName(provider?.name || null)
    customForm.setFieldsValue({
      name: provider?.name || '',
      base_url: provider?.base_url || '',
      api_key: provider?.api_key || '',
      api_mode: provider?.api_mode || '',
      models_json: jsonText(provider?.models),
    })
  }

  const handleSaveCustomProvider = async () => {
    if (!backingProfile) return
    try {
      setCustomSaving(true)
      const values = await customForm.validateFields()
      await client.saveCustomProvider(backingProfile, {
        name: values.name.trim(),
        base_url: values.base_url.trim(),
        api_key: values.api_key?.trim() || null,
        api_mode: values.api_mode?.trim() || null,
        models: parseJsonObject(values.models_json || '', '模型配置'),
      })
      message.success(editingCustomName ? '自定义模型已更新' : '自定义模型已新增')
      setCustomModalOpen(false)
      setEditingCustomName(null)
      customForm.resetFields()
      reloadCustomProviders()
    } catch (e) {
      if (e instanceof Error) {
        message.error(e.message)
      }
    } finally {
      setCustomSaving(false)
    }
  }

  const handleTestCustomProvider = async () => {
    if (!backingProfile) return
    try {
      setCustomTesting(true)
      const values = await customForm.validateFields(['base_url', 'api_key', 'api_mode', 'models_json'])
      const models = parseJsonObject(values.models_json || '', '模型配置')
      const model = pickCustomProviderModel(models)
      const result = await client.testCustomProvider(backingProfile, {
        base_url: values.base_url.trim(),
        api_key: values.api_key?.trim() || null,
        api_mode: values.api_mode?.trim() || null,
        model,
      })
      if (result.success) {
        message.success(result.message)
      } else {
        message.error(result.message)
      }
    } catch (e) {
      if (e instanceof Error) {
        message.error(e.message)
      }
    } finally {
      setCustomTesting(false)
    }
  }

  const handleDeleteCustomProvider = async (providerName: string) => {
    if (!backingProfile) return
    try {
      await client.deleteCustomProvider(backingProfile, providerName)
      message.success('自定义模型已删除')
      reloadCustomProviders()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除自定义模型失败')
    }
  }

  const handleImportFromOpenClaw = async () => {
    if (!backingProfile) return
    try {
      setImportLoading(true)
      const payload = await client.getOpenClawImportCandidates(backingProfile)
      const defaultSelected = payload.candidates
        .filter((item) => item.import_strategy === 'custom')
        .map((item) => item.name)
      setImportCandidates(payload.candidates)
      setImportSourcePath(payload.source_path)
      setSelectedImportNames(defaultSelected)
      setImportModalOpen(true)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '读取 OpenClaw 导入列表失败')
    } finally {
      setImportLoading(false)
    }
  }

  const handleConfirmImportFromOpenClaw = async () => {
    if (!backingProfile) return
    try {
      setImportSubmitting(true)
      const names = selectedImportNames.map((item) => String(item))
      const result = await client.importOpenClawCustomProviders(backingProfile, { names })
      message.success(`已从 OpenClaw 导入 ${result.count} 个自定义模型`)
      setImportModalOpen(false)
      reloadCustomProviders()
      Modal.info({
        title: 'OpenClaw 导入结果',
        width: 720,
        content: (
          <div>
            <p>来源文件：{result.source_path}</p>
            <p>成功导入：{result.imported.length} 个</p>
            <Input.TextArea
              readOnly
              value={JSON.stringify({ imported: result.imported, skipped: result.skipped }, null, 2)}
              autoSize={{ minRows: 8, maxRows: 14 }}
              style={{ fontFamily: 'monospace' }}
            />
          </div>
        ),
      })
    } catch (e) {
      message.error(e instanceof Error ? e.message : '从 OpenClaw 导入失败')
    } finally {
      setImportSubmitting(false)
    }
  }

  const envColumns = [
    { title: '环境变量', dataIndex: 'key', key: 'key' },
    { title: '说明', dataIndex: 'label', key: 'label' },
    {
      title: '状态',
      key: 'status',
      render: (_: unknown, record: (typeof BUILTIN_ENV_KEYS)[number]) => (
        envData?.variables?.[record.key] ? <Tag color="green">已配置</Tag> : <Tag>未配置</Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: (typeof BUILTIN_ENV_KEYS)[number]) => (
        <Button size="small" onClick={() => openEnvEditor(record.key)}>
          {envData?.variables?.[record.key] ? '修改' : '新增'}
        </Button>
      ),
    },
  ]

  const customColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '基础 URL', dataIndex: 'base_url', key: 'base_url' },
    { title: 'API 模式', dataIndex: 'api_mode', key: 'api_mode', render: (value: string | null) => value || '-' },
    {
      title: '模型数',
      key: 'models_count',
      render: (_: unknown, record: { models?: Record<string, unknown> | null }) => Object.keys(record.models || {}).length,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: {
        name: string
        base_url: string
        api_key?: string | null
        api_mode?: string | null
        models?: Record<string, unknown> | null
      }) => (
        <Space>
          <Button size="small" onClick={() => openCustomModal(record)}>编辑</Button>
          <Button size="small" danger onClick={() => handleDeleteCustomProvider(record.name)}>删除</Button>
        </Space>
      ),
    },
  ]

  const importColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '类型',
      key: 'import_strategy',
      render: (_: unknown, record: { import_strategy: string }) =>
        record.import_strategy === 'builtin' ? <Tag color="orange">内置支持</Tag> : <Tag color="green">自定义模型</Tag>,
    },
    { title: '基础 URL', dataIndex: 'base_url', key: 'base_url' },
    { title: 'API 模式', dataIndex: 'api_mode', key: 'api_mode', render: (value: string | null) => value || '-' },
    { title: '模型数', dataIndex: 'models_count', key: 'models_count' },
    { title: '说明', dataIndex: 'reason', key: 'reason', render: (value: string | null) => value || '-' },
  ]

  const currentAiSourceOption = aiSourceOptions.find((item) => item.value === selectedAiSource)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>AI 管理</Title>
        <Space>
          <Select
            style={{ width: 280 }}
            value={selectedSourceId || undefined}
            placeholder="选择共享配置"
            loading={sourcesLoading}
            onChange={setSelectedSourceId}
            options={(sources || []).map((item) => ({
              value: item.id,
              label: item.display_name || item.name,
            }))}
          />
          <Button icon={<ReloadOutlined />} onClick={() => {
            reloadSources()
            reloadAi()
            reloadEnv()
            reloadCustomProviders()
          }} loading={aiLoading || envLoading || customLoading}>
            刷新
          </Button>
        </Space>
      </div>

      {!currentSource ? (
        <Card>
          <Empty description="暂无可用共享配置源" />
        </Card>
      ) : (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Text strong>{currentSource.display_name || currentSource.name}</Text>
              <Text type="secondary">Backing Profile：{backingProfile || '-'}</Text>
              <Text type="secondary">
                关联档案：{currentSource.linked_profiles.length > 0 ? currentSource.linked_profiles.join('、') : '暂无关联档案'}
              </Text>
              <Alert
                type="info"
                showIcon
                message="AI 管理以共享配置为维度"
                description="这里编辑的是共享配置本身。修改后，所有继承该共享配置的档案会一起受到影响，包括默认模型、provider、embedding、内置 API key 和自定义模型。"
              />
            </Space>
          </Card>

          <Tabs
            defaultActiveKey="config"
            items={[
              {
                key: 'config',
                label: '1. 共享 AI 配置',
                children: (
                  <Form form={form} layout="vertical" onFinish={handleSaveAi}>
                    <Card
                      extra={
                        <Space>
                          <Button icon={<ReloadOutlined />} onClick={reloadAi} loading={aiLoading}>重新读取</Button>
                          <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()}>保存</Button>
                        </Space>
                      }
                    >
                      <Alert
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                        message="这里编辑的是共享 AI 配置"
                        description="建议先从已配置好密钥的官方 Provider 或已新增的自定义模型中选择 AI 来源，再填写默认模型。这样 provider 和 base_url 会自动带出，减少手工出错。"
                      />
                      <Form.Item label="AI 来源">
                        <Select
                          allowClear
                          placeholder="请选择一个已配置 key 的内置来源或自定义模型"
                          value={selectedAiSource}
                          options={aiSourceOptions.map((item) => ({ value: item.value, label: item.label }))}
                          onChange={handleAiSourceChange}
                        />
                      </Form.Item>
                      <Form.Item name="default_model" label="默认模型">
                        <Input placeholder="例如：MiniMax-M2.7 / gpt-4o-mini / kimi-k2.5" />
                      </Form.Item>
                      <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
                        <Descriptions.Item label="当前 Provider">
                          {currentAiSourceOption?.provider || form.getFieldValue('provider') || '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="当前基础 URL">
                          {currentAiSourceOption?.base_url || form.getFieldValue('base_url') || '使用 provider 默认地址'}
                        </Descriptions.Item>
                      </Descriptions>
                      <Form.Item name="provider" hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item name="base_url" hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item name="embedding" label="Embedding 配置（JSON）">
                        <Input.TextArea rows={6} style={{ fontFamily: 'monospace' }} />
                      </Form.Item>
                      <Form.Item name="auxiliary" label="辅助配置（JSON）">
                        <Input.TextArea rows={6} style={{ fontFamily: 'monospace' }} />
                      </Form.Item>
                      <Form.Item name="providers" label="提供方配置（JSON）">
                        <Input.TextArea rows={8} style={{ fontFamily: 'monospace' }} />
                      </Form.Item>
                      <Form.Item name="fallback_providers" label="回退提供方（JSON 数组）">
                        <Input.TextArea rows={6} style={{ fontFamily: 'monospace' }} />
                      </Form.Item>
                    </Card>
                  </Form>
                ),
              },
              {
                key: 'env',
                label: '2. 共享 API Key',
                children: (
                  <Card extra={<Button icon={<ReloadOutlined />} onClick={reloadEnv} loading={envLoading}>刷新</Button>}>
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: 16 }}
                      message="这里管理共享配置对应 backing profile 的 .env"
                      description="内置 Provider 的密钥统一保存在这里。修改后，所有继承该共享配置的档案都会随之生效，不需要每个档案重复配置一次。"
                    />
                    <Table
                      rowKey="key"
                      size="small"
                      pagination={false}
                      columns={envColumns}
                      dataSource={[...BUILTIN_ENV_KEYS]}
                      loading={envLoading}
                    />
                  </Card>
                ),
              },
              {
                key: 'custom',
                label: '3. 自定义模型与导入',
                children: (
                  <Card
                    extra={
                      <Space>
                        <Button icon={<ReloadOutlined />} onClick={reloadCustomProviders} loading={customLoading}>刷新</Button>
                        <Button onClick={handleImportFromOpenClaw} loading={importLoading}>从 OpenClaw 导入</Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => openCustomModal()}>新增</Button>
                      </Space>
                    }
                  >
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: 16 }}
                      message="这里管理 config.yaml 中的 custom_providers"
                      description="适合接入代理服务、局域网模型服务、公司内部网关或其它 OpenAI 兼容接口。也可以从 ~/.openclaw/openclaw.json 读取已有 provider 并按需导入。"
                    />
                    <Table
                      rowKey="name"
                      size="small"
                      pagination={false}
                      columns={customColumns}
                      dataSource={customProviders?.providers || []}
                      loading={customLoading}
                    />
                  </Card>
                ),
              },
            ]}
          />
        </>
      )}

      <Modal
        title={editingEnvKey ? `编辑 ${editingEnvKey}` : '编辑环境变量'}
        open={!!editingEnvKey}
        onCancel={() => {
          setEditingEnvKey(null)
          envForm.resetFields()
        }}
        onOk={() => envForm.submit()}
      >
        <Form form={envForm} layout="vertical" onFinish={handleSaveEnv}>
          <Form.Item name="value" label="值" rules={[{ required: true, message: '请输入值' }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingCustomName ? `编辑自定义模型：${editingCustomName}` : '新增自定义模型'}
        open={customModalOpen}
        onCancel={() => {
          setCustomModalOpen(false)
          setEditingCustomName(null)
          customForm.resetFields()
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setCustomModalOpen(false)
            setEditingCustomName(null)
            customForm.resetFields()
          }}>
            取消
          </Button>,
          <Button key="test" onClick={handleTestCustomProvider} loading={customTesting}>
            测试连通性
          </Button>,
          <Button key="save" type="primary" onClick={handleSaveCustomProvider} loading={customSaving}>
            保存
          </Button>,
        ]}
      >
        <Form form={customForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：local / work / proxy" disabled={!!editingCustomName} />
          </Form.Item>
          <Form.Item name="base_url" label="基础 URL" rules={[{ required: true, message: '请输入基础 URL' }]}>
            <Input placeholder="例如：http://localhost:8080/v1" />
          </Form.Item>
          <Form.Item name="api_key" label="API Key">
            <Input.Password placeholder="无鉴权服务可留空" />
          </Form.Item>
          <Form.Item name="api_mode" label="API 模式">
            <Input placeholder="例如：chat_completions / responses / anthropic_messages" />
          </Form.Item>
          <Form.Item name="models_json" label="模型配置（JSON）">
            <Input.TextArea rows={8} style={{ fontFamily: 'monospace' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="从 OpenClaw 导入"
        open={importModalOpen}
        width={960}
        okText="导入所选项"
        cancelText="取消"
        confirmLoading={importSubmitting}
        onCancel={() => setImportModalOpen(false)}
        onOk={handleConfirmImportFromOpenClaw}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="默认只勾选需要作为自定义模型管理的项"
          description="标记为“内置支持”的 provider 一般不建议导入为 custom_providers，优先使用上面的共享 API Key 和 AI 来源切换即可。"
        />
        <Text type="secondary">来源文件：{importSourcePath || '~/.openclaw/openclaw.json'}</Text>
        <Table
          style={{ marginTop: 12 }}
          rowKey="name"
          size="small"
          pagination={false}
          columns={importColumns}
          dataSource={importCandidates}
          rowSelection={{
            selectedRowKeys: selectedImportNames,
            onChange: (keys) => setSelectedImportNames(keys),
            getCheckboxProps: (record) => ({
              disabled: record.import_strategy === 'builtin',
            }),
          }}
        />
      </Modal>
    </div>
  )
}
