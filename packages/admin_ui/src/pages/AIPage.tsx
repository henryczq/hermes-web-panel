import { useEffect, useMemo, useState } from 'react'
import {
  App,
  Form,
  Input,
  Button,
  Card,
  Typography,
  Alert,
  Space,
  Table,
  Tag,
  Modal,
  Tabs,
  Popconfirm,
  Select,
  Descriptions,
} from 'antd'
import { PlusOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import { useHermesClient } from 'hermes_web_panel_client'
import { useAsyncData } from '../hooks/useAsyncData.js'
import { useProfile } from '../context/ProfileContext.js'
import type {
  AIConfigResponse,
  EnvResponse,
  CustomProviderListResponse,
  CustomProviderItem,
  CustomProviderTestResponse,
  OpenClawImportCandidateItem,
  OpenClawImportCandidatesResponse,
  OpenClawImportResponse,
} from 'hermes_web_panel_contract'

const { Title, Text } = Typography

const AI_ENV_KEYS: Array<{ key: string; label: string }> = [
  { key: 'OPENROUTER_API_KEY', label: 'OpenRouter API Key' },
  { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key' },
  { key: 'OPENAI_API_KEY', label: 'OpenAI API Key' },
  { key: 'GOOGLE_API_KEY', label: 'Google / Gemini API Key' },
  { key: 'GLM_API_KEY', label: 'GLM / z.ai API Key' },
  { key: 'KIMI_API_KEY', label: 'Kimi / Moonshot API Key' },
  { key: 'MINIMAX_API_KEY', label: 'MiniMax Global API Key' },
  { key: 'MINIMAX_CN_API_KEY', label: 'MiniMax China API Key' },
  { key: 'NOUS_API_KEY', label: 'Nous API Key' },
  { key: 'XIAOMI_API_KEY', label: 'Xiaomi API Key' },
  { key: 'HF_TOKEN', label: 'Hugging Face Token' },
]

const BUILTIN_PROVIDER_SOURCES: Array<{
  sourceKey: string
  label: string
  provider: string
  envKey: string
  baseUrl: string | null
}> = [
  {
    sourceKey: 'builtin:google',
    label: 'Google Gemini',
    provider: 'google',
    envKey: 'GOOGLE_API_KEY',
    baseUrl: null,
  },
  {
    sourceKey: 'builtin:minimax',
    label: 'MiniMax 国际版',
    provider: 'minimax',
    envKey: 'MINIMAX_API_KEY',
    baseUrl: null,
  },
  {
    sourceKey: 'builtin:minimax-cn',
    label: 'MiniMax 国内版',
    provider: 'minimax-cn',
    envKey: 'MINIMAX_CN_API_KEY',
    baseUrl: 'https://api.minimaxi.com/anthropic',
  },
  {
    sourceKey: 'builtin:openai',
    label: 'OpenAI',
    provider: 'openai',
    envKey: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
  },
  {
    sourceKey: 'builtin:openrouter',
    label: 'OpenRouter',
    provider: 'openrouter',
    envKey: 'OPENROUTER_API_KEY',
    baseUrl: 'https://openrouter.ai/api/v1',
  },
  {
    sourceKey: 'builtin:anthropic',
    label: 'Anthropic',
    provider: 'anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    baseUrl: null,
  },
  {
    sourceKey: 'builtin:glm',
    label: 'GLM / z.ai',
    provider: 'zai',
    envKey: 'GLM_API_KEY',
    baseUrl: 'https://api.z.ai/api/coding/paas/v4',
  },
  {
    sourceKey: 'builtin:kimi',
    label: 'Kimi / Moonshot',
    provider: 'kimi-coding',
    envKey: 'KIMI_API_KEY',
    baseUrl: null,
  },
]

function validateJson(value: string): { valid: boolean; error?: string } {
  if (!value) return { valid: true }
  try {
    JSON.parse(value)
    return { valid: true }
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'JSON 格式无效' }
  }
}

type CustomProviderFormValues = {
  name: string
  base_url: string
  api_key?: string
  api_mode?: string
  models_json?: string
}

function pickFirstCustomModel(models?: Record<string, unknown> | null): string | null {
  const names = Object.keys(models || {})
  return names[0] || null
}

export default function AIPage() {
  const client = useHermesClient()
  const { selectedProfile } = useProfile()
  const { message, modal } = App.useApp()

  const [form] = Form.useForm()
  const [jsonErrors, setJsonErrors] = useState<Record<string, string | null>>({
    auxiliary: null,
    providers: null,
    fallback_providers: null,
  })
  const [selectedMainSource, setSelectedMainSource] = useState<string | undefined>()

  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({})
  const [updateEnvKey, setUpdateEnvKey] = useState<string | null>(null)
  const [updateEnvForm] = Form.useForm()

  const [customProviderModalOpen, setCustomProviderModalOpen] = useState(false)
  const [editingCustomProvider, setEditingCustomProvider] = useState<string | null>(null)
  const [customProviderForm] = Form.useForm<CustomProviderFormValues>()
  const [customModelsError, setCustomModelsError] = useState<string | null>(null)
  const [testingCustomProvider, setTestingCustomProvider] = useState(false)
  const [savingCustomProvider, setSavingCustomProvider] = useState(false)
  const [importingOpenClaw, setImportingOpenClaw] = useState(false)
  const [openClawImportModalOpen, setOpenClawImportModalOpen] = useState(false)
  const [openClawCandidatesLoading, setOpenClawCandidatesLoading] = useState(false)
  const [openClawCandidates, setOpenClawCandidates] = useState<OpenClawImportCandidateItem[]>([])
  const [openClawSourcePath, setOpenClawSourcePath] = useState('')
  const [selectedOpenClawNames, setSelectedOpenClawNames] = useState<string[]>([])
  const [lastCustomProviderTestResult, setLastCustomProviderTestResult] = useState<CustomProviderTestResponse | null>(null)

  const { data, loading, reload } = useAsyncData<AIConfigResponse>(
    () => {
      if (!selectedProfile) return Promise.resolve({ profile_name: '', fallback_providers: [] })
      return client.getAiConfig(selectedProfile)
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

  const {
    data: customProvidersData,
    loading: customProvidersLoading,
    reload: reloadCustomProviders,
  } = useAsyncData<CustomProviderListResponse>(
    () => {
      if (!selectedProfile) return Promise.resolve({ profile_name: '', providers: [] })
      return client.getCustomProviders(selectedProfile)
    },
    [selectedProfile],
  )

  useEffect(() => {
    if (data) {
      form.setFieldsValue({
        default_model: data.default_model,
        provider: data.provider,
        base_url: data.base_url,
        auxiliary: data.auxiliary ? JSON.stringify(data.auxiliary, null, 2) : '',
        providers: data.providers ? JSON.stringify(data.providers, null, 2) : '',
        fallback_providers: data.fallback_providers ? JSON.stringify(data.fallback_providers, null, 2) : '',
      })
      setJsonErrors({
        auxiliary: null,
        providers: null,
        fallback_providers: null,
      })
    }
  }, [data, form])

  useEffect(() => {
    setRevealedKeys({})
    setCustomProviderModalOpen(false)
    setEditingCustomProvider(null)
    customProviderForm.resetFields()
    setCustomModelsError(null)
    setLastCustomProviderTestResult(null)
  }, [selectedProfile, customProviderForm])

  const handleJsonChange = (field: string, value: string) => {
    const result = validateJson(value)
    setJsonErrors((prev) => ({ ...prev, [field]: result.error ?? null }))
    form.setFieldsValue({ [field]: value })
  }

  const handleSaveAiConfig = async (values: Record<string, string>) => {
    if (!selectedProfile) return

    const errors: Record<string, string | null> = {
      auxiliary: validateJson(values.auxiliary).error || null,
      providers: validateJson(values.providers).error || null,
      fallback_providers: validateJson(values.fallback_providers).error || null,
    }
    setJsonErrors(errors)

    if (Object.values(errors).some((item) => item !== null)) {
      message.error('请先修复 JSON 格式错误后再保存')
      return
    }

    try {
      const parseJson = (val: string) => {
        if (!val) return null
        return JSON.parse(val)
      }
      const fallbackProviders = parseJson(values.fallback_providers)
      if (fallbackProviders !== null && !Array.isArray(fallbackProviders)) {
        message.error('回退提供方必须是 JSON 数组')
        return
      }
      await client.saveAiConfig(selectedProfile, {
        default_model: values.default_model || null,
        provider: values.provider || null,
        base_url: values.base_url || null,
        auxiliary: parseJson(values.auxiliary),
        providers: parseJson(values.providers),
        fallback_providers: fallbackProviders,
      })
      message.success('AI 配置已保存')
      reload()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存 AI 配置失败')
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

  const handleUpdateEnv = (key: string) => {
    setUpdateEnvKey(key)
    updateEnvForm.setFieldsValue({ value: revealedKeys[key] || '' })
  }

  const handleUpdateEnvSubmit = async (values: { value: string }) => {
    if (!selectedProfile || !updateEnvKey) return
    try {
      await client.updateEnvKey(selectedProfile, updateEnvKey, values.value)
      message.success('提供方密钥已保存')
      setUpdateEnvKey(null)
      setRevealedKeys((prev) => ({ ...prev, [updateEnvKey]: values.value }))
      reloadEnv()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存提供方密钥失败')
    }
  }

  const providerKeyRows = useMemo(
    () =>
      AI_ENV_KEYS.map((item) => ({
        key: item.key,
        label: item.label,
        configured: Boolean(envData?.variables?.[item.key]),
      })),
    [envData],
  )

  const mainSourceOptions = useMemo(() => {
    const builtinOptions = BUILTIN_PROVIDER_SOURCES
      .filter((item) => Boolean(envData?.variables?.[item.envKey]))
      .map((item) => ({
        key: item.sourceKey,
        label: item.label,
        provider: item.provider,
        base_url: item.baseUrl,
        kind: 'builtin' as const,
        hint: `已配置 ${item.envKey}`,
      }))

    const customOptions = (customProvidersData?.providers || []).map((item) => ({
      key: `custom:${item.name}`,
      label: `自定义 API / ${item.name}`,
      provider: 'custom',
      base_url: item.base_url,
      kind: 'custom' as const,
      hint: item.api_mode || 'custom_providers',
    }))

    return [...builtinOptions, ...customOptions]
  }, [customProvidersData, envData])

  useEffect(() => {
    if (!data) return
    const matchedCustom = (customProvidersData?.providers || []).find(
      (item) => data.base_url && item.base_url === data.base_url,
    )
    if (matchedCustom) {
      setSelectedMainSource(`custom:${matchedCustom.name}`)
      form.setFieldsValue({
        provider: 'custom',
        base_url: matchedCustom.base_url,
      })
      return
    }

    const matchedBuiltin = BUILTIN_PROVIDER_SOURCES.find((item) => item.provider === data.provider)
    if (matchedBuiltin && envData?.variables?.[matchedBuiltin.envKey]) {
      setSelectedMainSource(matchedBuiltin.sourceKey)
      form.setFieldsValue({
        provider: matchedBuiltin.provider,
        base_url: data.base_url ?? matchedBuiltin.baseUrl,
      })
      return
    }

    setSelectedMainSource(undefined)
  }, [customProvidersData, data, envData, form])

  const handleMainSourceChange = (value: string) => {
    setSelectedMainSource(value)
    const option = mainSourceOptions.find((item) => item.key === value)
    if (!option) return
    form.setFieldsValue({
      provider: option.provider,
      base_url: option.base_url,
    })
  }

  const selectedMainSourceInfo = mainSourceOptions.find((item) => item.key === selectedMainSource)

  const parseCustomModelsJson = (value?: string) => {
    if (!value?.trim()) return null
    const parsed = JSON.parse(value)
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error('模型配置必须是 JSON 对象')
    }
    return parsed as Record<string, unknown>
  }

  const openCreateCustomProvider = () => {
    setEditingCustomProvider(null)
    setCustomModelsError(null)
    customProviderForm.resetFields()
    customProviderForm.setFieldsValue({ api_mode: '' })
    setCustomProviderModalOpen(true)
  }

  const openEditCustomProvider = (record: CustomProviderItem) => {
    setEditingCustomProvider(record.name)
    setCustomModelsError(null)
    customProviderForm.setFieldsValue({
      name: record.name,
      base_url: record.base_url,
      api_key: record.api_key || '',
      api_mode: record.api_mode || '',
      models_json: record.models ? JSON.stringify(record.models, null, 2) : '',
    })
    setCustomProviderModalOpen(true)
  }

  const handleCustomModelsChange = (value: string) => {
    setCustomModelsError(validateJson(value).error || null)
    customProviderForm.setFieldsValue({ models_json: value })
  }

  const handleSaveCustomProvider = async () => {
    if (!selectedProfile) return
    try {
      setSavingCustomProvider(true)
      const values = await customProviderForm.validateFields()
      const models = parseCustomModelsJson(values.models_json)
      setCustomModelsError(null)
      await client.saveCustomProvider(selectedProfile, {
        name: values.name.trim(),
        base_url: values.base_url.trim(),
        api_key: values.api_key?.trim() || null,
        api_mode: values.api_mode?.trim() || null,
        models,
      })
      message.success(editingCustomProvider ? '自定义 API 已更新' : '自定义 API 已新增')
      setCustomProviderModalOpen(false)
      setEditingCustomProvider(null)
      customProviderForm.resetFields()
      reloadCustomProviders()
    } catch (e) {
      if (e instanceof Error) {
        if (e.message.includes('outOfDate') || e.message.includes('validate')) return
        message.error(e.message || '保存自定义 API 失败')
      }
    } finally {
      setSavingCustomProvider(false)
    }
  }

  const runCustomProviderTest = async (payload: {
    base_url: string
    api_key?: string | null
    api_mode?: string | null
    model?: string | null
  }) => {
    if (!selectedProfile) return
    try {
      setTestingCustomProvider(true)
      const result = await client.testCustomProvider(selectedProfile, {
        base_url: payload.base_url,
        api_key: payload.api_key || null,
        api_mode: payload.api_mode || null,
        model: payload.model || null,
      })
      setLastCustomProviderTestResult(result)
      if (result.success) {
        message.success(result.message)
      } else {
        message.error(result.message)
      }
      modal.info({
        title: '连通性测试结果',
        width: 720,
        content: (
          <div>
            <p>{result.message}</p>
            {result.details && (
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 320, overflow: 'auto' }}>
                {JSON.stringify(result.details, null, 2)}
              </pre>
            )}
          </div>
        ),
      })
    } catch (e) {
      setLastCustomProviderTestResult({
        success: false,
        message: e instanceof Error ? e.message : '测试自定义 API 失败',
      })
      message.error(e instanceof Error ? e.message : '测试自定义 API 失败')
    } finally {
      setTestingCustomProvider(false)
    }
  }

  const handleTestCustomProviderFromModal = async () => {
    try {
      const values = await customProviderForm.validateFields(['base_url', 'api_key', 'api_mode', 'models_json'])
      parseCustomModelsJson(values.models_json)
      setCustomModelsError(null)
      await runCustomProviderTest({
        base_url: values.base_url.trim(),
        api_key: values.api_key?.trim() || null,
        api_mode: values.api_mode?.trim() || null,
        model: pickFirstCustomModel(parseCustomModelsJson(values.models_json)),
      })
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) {
        return
      }
      if (e instanceof Error && !e.message.includes('validate')) {
        message.error(e.message)
      }
    }
  }

  const handleDeleteCustomProvider = async (name: string) => {
    if (!selectedProfile) return
    try {
      await client.deleteCustomProvider(selectedProfile, name)
      message.success('自定义 API 已删除')
      reloadCustomProviders()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除自定义 API 失败')
    }
  }

  const handleImportOpenClaw = async () => {
    if (!selectedProfile) return
    try {
      setOpenClawCandidatesLoading(true)
      const result: OpenClawImportCandidatesResponse = await client.getOpenClawImportCandidates(selectedProfile)
      setOpenClawCandidates(result.candidates)
      setOpenClawSourcePath(result.source_path)
      setSelectedOpenClawNames(result.candidates.filter((item) => item.import_strategy === 'custom').map((item) => item.name))
      setOpenClawImportModalOpen(true)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '读取 OpenClaw 导入列表失败')
    } finally {
      setOpenClawCandidatesLoading(false)
    }
  }

  const handleConfirmOpenClawImport = async () => {
    if (!selectedProfile) return
    try {
      setImportingOpenClaw(true)
      const result: OpenClawImportResponse = await client.importOpenClawCustomProviders(selectedProfile, {
        names: selectedOpenClawNames,
      })
      message.success(`已从 OpenClaw 导入 ${result.count} 个自定义 API`)
      setOpenClawImportModalOpen(false)
      reloadCustomProviders()
      modal.info({
        title: 'OpenClaw 导入结果',
        width: 720,
        content: (
          <div>
            <p>来源文件：{result.source_path}</p>
            <p>成功导入：{result.imported.length} 个</p>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 240, overflow: 'auto' }}>
              {JSON.stringify({ imported: result.imported, skipped: result.skipped }, null, 2)}
            </pre>
          </div>
        ),
      })
    } catch (e) {
      message.error(e instanceof Error ? e.message : '从 OpenClaw 导入失败')
    } finally {
      setImportingOpenClaw(false)
    }
  }

  if (!selectedProfile) {
    return <Alert message="请先选择一个配置档案" type="info" />
  }

  const providerKeyColumns = [
    {
      title: '环境变量',
      dataIndex: 'key',
      key: 'key',
    },
    {
      title: '说明',
      dataIndex: 'label',
      key: 'label',
    },
    {
      title: '状态',
      key: 'status',
      render: (_: unknown, record: { key: string; configured: boolean }) => {
        if (revealedKeys[record.key]) {
          return <Tag color="blue">{revealedKeys[record.key]}</Tag>
        }
        return record.configured ? <Tag color="green">已配置</Tag> : <Tag>未配置</Tag>
      },
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: { key: string; configured: boolean }) => (
        <Space>
          {record.configured && (
            <Button size="small" onClick={() => handleReveal(record.key)}>
              查看
            </Button>
          )}
          <Button size="small" type="primary" onClick={() => handleUpdateEnv(record.key)}>
            {record.configured ? '修改' : '新增'}
          </Button>
        </Space>
      ),
    },
  ]

  const customProviderColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '基础 URL',
      dataIndex: 'base_url',
      key: 'base_url',
      ellipsis: true,
    },
    {
      title: 'API 模式',
      key: 'api_mode',
      render: (_: unknown, record: CustomProviderItem) => record.api_mode || <Text type="secondary">自动</Text>,
    },
    {
      title: '模型配置',
      key: 'models',
      render: (_: unknown, record: CustomProviderItem) => {
        const count = Object.keys(record.models || {}).length
        return count > 0 ? <Tag color="green">{count} 项</Tag> : <Tag>未配置</Tag>
      },
    },
    {
      title: '密钥',
      key: 'api_key',
      render: (_: unknown, record: CustomProviderItem) =>
        record.api_key_configured ? <Tag color="green">已配置</Tag> : <Tag>未配置</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: CustomProviderItem) => (
        <Space>
          <Button size="small" onClick={() => openEditCustomProvider(record)}>
            编辑
          </Button>
          <Button
            size="small"
            onClick={() =>
              runCustomProviderTest({
                base_url: record.base_url,
                api_key: record.api_key || null,
                api_mode: record.api_mode || null,
                model: pickFirstCustomModel(record.models),
              })
            }
          >
            测试
          </Button>
          <Popconfirm
            title={`删除 ${record.name}？`}
            description="会从当前 profile 的 config.yaml 移除这个自定义 API。"
            okText="删除"
            cancelText="取消"
            onConfirm={() => handleDeleteCustomProvider(record.name)}
          >
            <Button size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const openClawCandidateColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      key: 'import_strategy',
      render: (_: unknown, record: OpenClawImportCandidateItem) =>
        record.import_strategy === 'builtin'
          ? <Tag color="orange">内置支持</Tag>
          : <Tag color="green">自定义 API</Tag>,
    },
    {
      title: '基础 URL',
      dataIndex: 'base_url',
      key: 'base_url',
      ellipsis: true,
    },
    {
      title: 'API 模式',
      key: 'api_mode',
      render: (_: unknown, record: OpenClawImportCandidateItem) => record.api_mode || '-',
    },
    {
      title: '模型数',
      key: 'models_count',
      render: (_: unknown, record: OpenClawImportCandidateItem) => record.models_count,
    },
    {
      title: '说明',
      key: 'reason',
      render: (_: unknown, record: OpenClawImportCandidateItem) => (
        <span>{record.reason || '-'}</span>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>AI 配置</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { reload(); reloadEnv(); reloadCustomProviders() }} />
        </Space>
      </div>

      <Tabs
        defaultActiveKey="config"
        items={[
          {
            key: 'config',
            label: '1. AI 配置',
            children: (
              <Form form={form} layout="vertical" onFinish={handleSaveAiConfig}>
                <Card
                  title="主模型配置"
                  style={{ marginBottom: 16 }}
                  extra={
                    <Space>
                      <Button icon={<ReloadOutlined />} onClick={reload} loading={loading}>
                        重新读取
                      </Button>
                      <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()}>
                        保存
                      </Button>
                    </Space>
                  }
                >
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="这里用于切换当前主模型来源"
                    description="优先从你已经配置好 key 的官方 provider 或已经新增的自定义 API 里选择。选择后会自动带出对应的 provider 和基础 URL，不再需要手工输入这些底层参数。"
                  />
                  <Form.Item label="AI 来源">
                    <Select
                      placeholder="请选择一个已可用的 AI 来源"
                      value={selectedMainSource}
                      onChange={handleMainSourceChange}
                      options={mainSourceOptions.map((item) => ({
                        value: item.key,
                        label: `${item.label} (${item.hint})`,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name="default_model" label="默认模型">
                    <Input placeholder="例如：gemini-2.5-flash / MiniMax-M2.7 / custom:local:qwen2.5" />
                  </Form.Item>
                  <Descriptions bordered size="small" column={1}>
                    <Descriptions.Item label="当前 Provider">
                      {selectedMainSourceInfo?.provider || data?.provider || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="当前基础 URL">
                      {selectedMainSourceInfo?.base_url || form.getFieldValue('base_url') || '使用 provider 默认地址'}
                    </Descriptions.Item>
                  </Descriptions>
                  <Form.Item name="provider" hidden>
                    <Input />
                  </Form.Item>
                  <Form.Item name="base_url" hidden>
                    <Input />
                  </Form.Item>
                </Card>

                <Card title="辅助配置（JSON）" style={{ marginBottom: 16 }}>
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="给辅助任务单独指定模型"
                    description="用于图片理解、网页摘要、上下文压缩、记忆整理等后台辅助任务。通常可留空保持默认。只有当你想让这些任务走和主模型不同的 provider / model / base_url 时才需要填写。常见字段如 vision、web_extract、compression、flush_memories。"
                  />
                  <Form.Item name="auxiliary">
                    <Input.TextArea
                      rows={6}
                      style={{ fontFamily: 'monospace' }}
                      onChange={(e) => handleJsonChange('auxiliary', e.target.value)}
                    />
                  </Form.Item>
                  {jsonErrors.auxiliary && (
                    <Alert message={jsonErrors.auxiliary} type="error" showIcon style={{ marginTop: 8 }} />
                  )}
                </Card>

                <Card title="提供方配置（JSON）" style={{ marginBottom: 16 }}>
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="给特定 provider 补充高级参数"
                    description="这里不是选择当前提供方，而是给 providers 配置额外参数。普通接入 OpenAI、OpenRouter、MiniMax 时通常留空即可。更适合高级场景，例如为某个 provider 指定扩展参数。"
                  />
                  <Form.Item name="providers">
                    <Input.TextArea
                      rows={8}
                      style={{ fontFamily: 'monospace' }}
                      onChange={(e) => handleJsonChange('providers', e.target.value)}
                    />
                  </Form.Item>
                  {jsonErrors.providers && (
                    <Alert message={jsonErrors.providers} type="error" showIcon style={{ marginTop: 8 }} />
                  )}
                </Card>

                <Card title="回退提供方（JSON）">
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="主模型失败时的备用链路"
                    description="这里填一个数组，表示主模型调用失败后依次尝试的备用 provider / model / base_url。适合做高可用，例如主模型用 MiniMax，失败后切 OpenRouter。没有容灾需求可以留空。"
                  />
                  <Form.Item name="fallback_providers">
                    <Input.TextArea
                      rows={6}
                      style={{ fontFamily: 'monospace' }}
                      onChange={(e) => handleJsonChange('fallback_providers', e.target.value)}
                    />
                  </Form.Item>
                  {jsonErrors.fallback_providers && (
                    <Alert message={jsonErrors.fallback_providers} type="error" showIcon style={{ marginTop: 8 }} />
                  )}
                </Card>
              </Form>
            ),
          },
          {
            key: 'env',
            label: '2. AI 提供方密钥',
            children: (
              <Card
                title="AI 提供方密钥"
                extra={
                  <Button icon={<ReloadOutlined />} onClick={reloadEnv} loading={envLoading}>
                    刷新
                  </Button>
                }
              >
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message="这里管理的是 .env 中的提供方密钥"
                  description="例如 MiniMax 的 key 不在 config.yaml 中，而是在 .env 里保存。要新增或修改 minimax，请直接编辑这里的 MINIMAX_API_KEY 或 MINIMAX_CN_API_KEY。"
                />
                <Table
                  size="small"
                  pagination={false}
                  loading={envLoading}
                  rowKey="key"
                  columns={providerKeyColumns}
                  dataSource={providerKeyRows}
                />
              </Card>
            ),
          },
          {
            key: 'custom',
            label: '3. 自定义 API',
            children: (
              <Card
                title="自定义 API"
                extra={
                  <Space>
                    <Button icon={<ReloadOutlined />} onClick={reloadCustomProviders} loading={customProvidersLoading}>
                      刷新
                    </Button>
                    <Button onClick={handleImportOpenClaw} loading={openClawCandidatesLoading}>
                      从 OpenClaw 导入
                    </Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreateCustomProvider}>
                      新增
                    </Button>
                  </Space>
                }
              >
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message="这里管理的是 config.yaml 里的 custom_providers"
                  description="适合接入你自己的 OpenAI 兼容接口、代理服务、局域网模型服务或公司内部网关。支持查看列表、新增、修改、删除，并可测试接口连通性。也可以一键从 ~/.openclaw/openclaw.json 导入现有配置。"
                />
                {lastCustomProviderTestResult && (
                  <Alert
                    type={lastCustomProviderTestResult.success ? 'success' : 'error'}
                    showIcon
                    style={{ marginBottom: 16 }}
                    message={lastCustomProviderTestResult.message || (lastCustomProviderTestResult.success ? '测试成功' : '测试失败')}
                    description={
                      lastCustomProviderTestResult.details ? (
                        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
                          {JSON.stringify(lastCustomProviderTestResult.details, null, 2)}
                        </pre>
                      ) : undefined
                    }
                  />
                )}
                <Table
                  size="small"
                  rowKey="name"
                  loading={customProvidersLoading || testingCustomProvider}
                  columns={customProviderColumns}
                  dataSource={customProvidersData?.providers || []}
                  pagination={false}
                  locale={{ emptyText: '暂无自定义 API，可点击右上角“新增”' }}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title="从 OpenClaw 导入"
        open={openClawImportModalOpen}
        width={960}
        onCancel={() => setOpenClawImportModalOpen(false)}
        onOk={handleConfirmOpenClawImport}
        okText="导入所选项"
        confirmLoading={importingOpenClaw}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="请选择要导入的 OpenClaw provider"
          description="内置支持的 provider 会标记为“内置支持”，这类一般建议直接使用本页的 AI 提供方密钥和主模型切换，不建议导入到自定义 API。默认只勾选真正需要作为自定义接口管理的项。"
        />
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary">来源文件：{openClawSourcePath || '~/.openclaw/openclaw.json'}</Text>
        </div>
        <Table
          size="small"
          rowKey="name"
          pagination={false}
          columns={openClawCandidateColumns}
          dataSource={openClawCandidates}
          rowSelection={{
            selectedRowKeys: selectedOpenClawNames,
            onChange: (keys) => setSelectedOpenClawNames(keys as string[]),
            getCheckboxProps: (record: OpenClawImportCandidateItem) => ({
              disabled: record.import_strategy === 'builtin',
            }),
          }}
        />
      </Modal>

      <Modal
        title={updateEnvKey ? `编辑 ${updateEnvKey}` : '编辑提供方密钥'}
        open={!!updateEnvKey}
        onCancel={() => setUpdateEnvKey(null)}
        onOk={() => updateEnvForm.submit()}
      >
        <Form form={updateEnvForm} layout="vertical" onFinish={handleUpdateEnvSubmit}>
          <Form.Item
            name="value"
            label="值"
            rules={[{ required: true, message: '请输入密钥值' }]}
          >
            <Input.Password placeholder="请输入密钥值" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingCustomProvider ? `编辑自定义 API：${editingCustomProvider}` : '新增自定义 API'}
        open={customProviderModalOpen}
        onCancel={() => {
          setCustomProviderModalOpen(false)
          setEditingCustomProvider(null)
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setCustomProviderModalOpen(false)
            setEditingCustomProvider(null)
          }}>
            取消
          </Button>,
          <Button key="test" onClick={handleTestCustomProviderFromModal} loading={testingCustomProvider}>
            测试连通性
          </Button>,
          <Button key="save" type="primary" onClick={handleSaveCustomProvider} loading={savingCustomProvider}>
            保存
          </Button>,
        ]}
      >
        <Form form={customProviderForm} layout="vertical">
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="例如：local / work / anthropic-proxy" disabled={!!editingCustomProvider} />
          </Form.Item>

          <Form.Item
            name="base_url"
            label="基础 URL"
            rules={[{ required: true, message: '请输入基础 URL' }]}
          >
            <Input placeholder="例如：http://localhost:8080/v1" />
          </Form.Item>

          <Form.Item name="api_key" label="API Key">
            <Input.Password placeholder="可留空；无鉴权的本地服务可以不填" />
          </Form.Item>

          <Form.Item name="api_mode" label="API 模式">
            <Select
              allowClear
              placeholder="留空表示自动识别"
              options={[
                { value: 'chat_completions', label: 'chat_completions' },
                { value: 'responses', label: 'responses' },
                { value: 'anthropic_messages', label: 'anthropic_messages' },
              ]}
            />
          </Form.Item>

          <Form.Item name="models_json" label="模型配置（JSON）">
            <Input.TextArea
              rows={8}
              style={{ fontFamily: 'monospace' }}
              placeholder={'例如：{\n  "qwen3.5:27b": { "context_length": 32768 }\n}'}
              onChange={(e) => handleCustomModelsChange(e.target.value)}
            />
          </Form.Item>
          {customModelsError && (
            <Alert type="error" showIcon message={customModelsError} style={{ marginTop: 8 }} />
          )}
        </Form>
      </Modal>
    </div>
  )
}
