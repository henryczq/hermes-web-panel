import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  DeleteOutlined,
  EyeOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { useHermesClient } from 'hermes_web_panel_client'
import { useAsyncData } from '../hooks/useAsyncData.js'
import { useProfile } from '../context/ProfileContext.js'
import type {
  ConfigBackupItem,
  ConfigRawResponse,
  EnvResponse,
  HermesProfileSummary,
  WorkspaceFileBackupItem,
  WorkspaceFileEntry,
} from 'hermes_web_panel_contract'

const { Title, Paragraph, Text } = Typography
const { TextArea } = Input

const CORE_FILES = ['SOUL.md', 'MEMORY.md', 'USER.md', 'AGENTS.md'] as const
const RUNTIME_FILES = ['config.yaml', '.env'] as const

interface DisplayFileItem {
  path: string
  kind: 'file'
  editable: boolean
  size?: number | null
  exists: boolean
}

function getProfileLabel(profile: HermesProfileSummary): string {
  return profile.display_name?.trim() || (profile.name === 'default' ? '主配置' : profile.name)
}

function getFileGroup(path: string): 'core' | 'runtime' | 'other' {
  if ((CORE_FILES as readonly string[]).includes(path)) return 'core'
  if ((RUNTIME_FILES as readonly string[]).includes(path)) return 'runtime'
  return 'other'
}

function getFileDescription(filePath: string): string {
  switch (filePath) {
    case 'SOUL.md':
      return '定义当前档案的人设、行为边界和系统级指令。'
    case 'MEMORY.md':
      return '记录代理自己的长期工作记忆。'
    case 'USER.md':
      return '记录用户画像、偏好和沟通习惯。'
    case 'AGENTS.md':
      return '补充团队协作或代理编排说明。'
    case 'config.yaml':
      return 'Hermes 原始运行配置。适合处理模型、provider、路由和低频配置项。'
    case '.env':
      return '当前档案的敏感环境变量，例如不同档案使用的 MiniMax API Key。'
    default:
      return '当前档案下的可编辑文件。'
  }
}

function getFileDisplayTitle(filePath: string): string {
  switch (filePath) {
    case 'SOUL.md':
      return '人格设定'
    case 'MEMORY.md':
      return '长期记忆'
    case 'USER.md':
      return '用户画像'
    case 'AGENTS.md':
      return '协作说明'
    case 'config.yaml':
      return '运行配置'
    case '.env':
      return '环境变量'
    default:
      return filePath
  }
}

export default function WorkspacePage() {
  const client = useHermesClient()
  const { selectedProfile, setSelectedProfile } = useProfile()

  const [activeFile, setActiveFile] = useState<string>('SOUL.md')
  const [textContent, setTextContent] = useState('')
  const [dirty, setDirty] = useState(false)

  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({})
  const [envSearch, setEnvSearch] = useState('')
  const [addEnvOpen, setAddEnvOpen] = useState(false)
  const [updateEnvKey, setUpdateEnvKey] = useState<string | null>(null)
  const [addEnvForm] = Form.useForm()
  const [updateEnvForm] = Form.useForm()

  const { data: profiles, loading: profilesLoading, reload: reloadProfiles } = useAsyncData<HermesProfileSummary[]>(
    () => client.listProfiles(),
    [],
  )

  const currentProfile = useMemo(
    () => profiles?.find((item) => item.name === selectedProfile) || null,
    [profiles, selectedProfile],
  )

  const { data: files, loading: filesLoading, reload: reloadFiles } = useAsyncData<WorkspaceFileEntry[]>(
    () => {
      if (!selectedProfile) return Promise.resolve([])
      return client.getWorkspaceFiles(selectedProfile)
    },
    [selectedProfile],
  )

  useEffect(() => {
    if (!selectedProfile && profiles && profiles.length > 0) {
      setSelectedProfile(profiles[0].name)
    }
  }, [profiles, selectedProfile, setSelectedProfile])

  const editableFiles = useMemo(() => {
    const items = (files || []).filter((entry) => entry.kind === 'file' && entry.editable)
    const order = [...CORE_FILES, ...RUNTIME_FILES]
    return items.sort((a, b) => {
      const ai = order.indexOf(a.path as (typeof order)[number])
      const bi = order.indexOf(b.path as (typeof order)[number])
      if (ai !== -1 || bi !== -1) {
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
      }
      return a.path.localeCompare(b.path)
    })
  }, [files])

  const coreFiles = useMemo<DisplayFileItem[]>(
    () =>
      CORE_FILES.map((path) => {
        const existing = editableFiles.find((entry) => entry.path === path)
        return {
          path,
          kind: 'file',
          editable: existing?.editable ?? false,
          size: existing?.size ?? null,
          exists: Boolean(existing),
        }
      }),
    [editableFiles],
  )
  const runtimeFiles = useMemo(
    () =>
      editableFiles
        .filter((entry) => getFileGroup(entry.path) === 'runtime')
        .map((entry) => ({ ...entry, exists: true })),
    [editableFiles],
  )
  const customFiles = useMemo(
    () =>
      editableFiles
        .filter((entry) => getFileGroup(entry.path) === 'other')
        .map((entry) => ({ ...entry, exists: true })),
    [editableFiles],
  )

  useEffect(() => {
    if (!editableFiles.length) return
    if (!editableFiles.find((entry) => entry.path === activeFile)) {
      setActiveFile(editableFiles[0].path)
    }
  }, [activeFile, editableFiles])

  const isRuntimeFile = getFileGroup(activeFile) === 'runtime'
  const isEnvFile = activeFile === '.env'
  const isConfigFile = activeFile === 'config.yaml'

  const { data: fileData, loading: fileLoading, reload: reloadFile } = useAsyncData<{
    profile_name: string
    path: string
    content: string
    size: number
  } | null>(
    () => {
      if (!selectedProfile || !activeFile || isRuntimeFile) return Promise.resolve(null)
      return client.readWorkspaceFile(selectedProfile, activeFile)
    },
    [selectedProfile, activeFile, isRuntimeFile],
  )

  const { data: workspaceBackups, loading: workspaceBackupLoading, reload: reloadWorkspaceBackups } =
    useAsyncData<WorkspaceFileBackupItem[]>(
      () => {
        if (!selectedProfile || !activeFile || isRuntimeFile) return Promise.resolve([])
        return client.listWorkspaceFileBackups(selectedProfile, activeFile)
      },
      [selectedProfile, activeFile, isRuntimeFile],
    )

  const { data: configData, loading: configLoading, reload: reloadConfig } = useAsyncData<ConfigRawResponse | null>(
    () => {
      if (!selectedProfile || !isConfigFile) return Promise.resolve(null)
      return client.getConfigRaw(selectedProfile)
    },
    [selectedProfile, isConfigFile],
  )

  const { data: envData, loading: envLoading, reload: reloadEnv } = useAsyncData<EnvResponse | null>(
    () => {
      if (!selectedProfile || !isEnvFile) return Promise.resolve(null)
      return client.getEnvState(selectedProfile)
    },
    [selectedProfile, isEnvFile],
  )

  const { data: configBackups, loading: configBackupsLoading, reload: reloadConfigBackups } =
    useAsyncData<ConfigBackupItem[]>(
      () => {
        if (!selectedProfile || !isConfigFile) return Promise.resolve([])
        return client.listConfigBackups(selectedProfile)
      },
      [selectedProfile, isConfigFile],
    )

  useEffect(() => {
    setDirty(false)
    setRevealedKeys({})
    if (isConfigFile) {
      setTextContent(configData?.content || '')
      return
    }
    if (!isRuntimeFile) {
      setTextContent(fileData?.content || '')
      return
    }
    setTextContent('')
  }, [activeFile, configData, fileData, isConfigFile, isRuntimeFile])

  const envEntries = useMemo(
    () =>
      Object.entries(envData?.variables || {})
        .filter(([key]) => !envSearch || key.toLowerCase().includes(envSearch.toLowerCase()))
        .map(([key, value]) => ({ key, value })),
    [envData, envSearch],
  )

  const handleSwitchProfile = (profileName: string) => {
    if (dirty) {
      Modal.confirm({
        title: '存在未保存内容',
        content: '切换档案会丢失当前未保存内容，是否继续？',
        okText: '继续切换',
        onOk: () => {
          setSelectedProfile(profileName)
          setDirty(false)
        },
      })
      return
    }
    setSelectedProfile(profileName)
  }

  const handleSwitchFile = (filePath: string) => {
    if (dirty) {
      Modal.confirm({
        title: '存在未保存内容',
        content: '切换文件会丢失当前未保存内容，是否继续？',
        okText: '继续切换',
        onOk: () => {
          setActiveFile(filePath)
          setDirty(false)
        },
      })
      return
    }
    setActiveFile(filePath)
  }

  const handleSave = async () => {
    if (!selectedProfile) return
    try {
      if (isConfigFile) {
        await client.saveConfigRaw(selectedProfile, { content: textContent })
        message.success('config.yaml 已保存')
        reloadConfig()
      } else if (!isRuntimeFile) {
        await client.writeWorkspaceFile(selectedProfile, { path: activeFile, content: textContent })
        message.success(`${activeFile} 已保存`)
        reloadFile()
      }
      setDirty(false)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存文件失败')
    }
  }

  const handleBackup = async () => {
    if (!selectedProfile) return
    try {
      if (isConfigFile) {
        await client.backupConfig(selectedProfile)
        message.success('config.yaml 已备份')
        reloadConfigBackups()
      } else if (!isRuntimeFile) {
        await client.backupWorkspaceFile(selectedProfile, activeFile)
        message.success(`${activeFile} 已备份`)
        reloadWorkspaceBackups()
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '备份失败')
    }
  }

  const handleRestoreWorkspaceBackup = async (backupFilename: string) => {
    if (!selectedProfile) return
    Modal.confirm({
      title: '恢复文件备份',
      content: `确定要将 ${activeFile} 恢复到备份 ${backupFilename} 吗？`,
      okText: '恢复',
      okType: 'danger',
      onOk: async () => {
        try {
          await client.restoreWorkspaceFileBackup(selectedProfile, activeFile, backupFilename)
          message.success(`${activeFile} 已恢复`)
          reloadFile()
          reloadWorkspaceBackups()
          setDirty(false)
        } catch (error) {
          message.error(error instanceof Error ? error.message : '恢复文件失败')
        }
      },
    })
  }

  const handleRollbackConfig = async (filename: string) => {
    if (!selectedProfile) return
    Modal.confirm({
      title: '回滚 config.yaml',
      content: `确定要恢复备份 ${filename} 吗？`,
      okText: '回滚',
      okType: 'danger',
      onOk: async () => {
        try {
          await client.rollbackConfig(selectedProfile, filename)
          message.success('config.yaml 已回滚')
          reloadConfig()
          reloadConfigBackups()
          setDirty(false)
        } catch (error) {
          message.error(error instanceof Error ? error.message : '回滚 config.yaml 失败')
        }
      },
    })
  }

  const handleRevealEnv = async (key: string) => {
    if (!selectedProfile) return
    try {
      const result = await client.revealEnvKey(selectedProfile, key)
      setRevealedKeys((prev) => ({ ...prev, [key]: result.value }))
    } catch (error) {
      message.error(error instanceof Error ? error.message : '读取环境变量失败')
    }
  }

  const handleDeleteEnv = async (key: string) => {
    if (!selectedProfile) return
    Modal.confirm({
      title: `删除 ${key}`,
      content: '删除后需要重新填写才会恢复。',
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await client.deleteEnvKey(selectedProfile, key)
          message.success('环境变量已删除')
          reloadEnv()
        } catch (error) {
          message.error(error instanceof Error ? error.message : '删除环境变量失败')
        }
      },
    })
  }

  const submitUpdateEnv = async (values: { value: string }) => {
    if (!selectedProfile || !updateEnvKey) return
    try {
      await client.updateEnvKey(selectedProfile, updateEnvKey, values.value)
      message.success(`${updateEnvKey} 已更新`)
      setUpdateEnvKey(null)
      updateEnvForm.resetFields()
      reloadEnv()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '更新环境变量失败')
    }
  }

  const submitAddEnv = async (values: { key: string; value: string }) => {
    if (!selectedProfile) return
    try {
      await client.updateEnvKey(selectedProfile, values.key.trim(), values.value)
      message.success('环境变量已写入')
      setAddEnvOpen(false)
      addEnvForm.resetFields()
      reloadEnv()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '写入环境变量失败')
    }
  }

  const envColumns = [
    { title: '键名', dataIndex: 'key', key: 'key' },
    {
      title: '状态',
      key: 'status',
      render: (_: unknown, record: { key: string; value: boolean }) =>
        revealedKeys[record.key] ? (
          <Text code>{revealedKeys[record.key]}</Text>
        ) : record.value ? (
          <Tag color="green">已配置</Tag>
        ) : (
          <Tag>空</Tag>
        ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: { key: string; value: boolean }) => (
        <Space>
          {record.value && (
            <Button size="small" icon={<EyeOutlined />} onClick={() => handleRevealEnv(record.key)}>
              查看
            </Button>
          )}
          <Button
            size="small"
            onClick={() => {
              setUpdateEnvKey(record.key)
              updateEnvForm.setFieldsValue({ value: '' })
            }}
          >
            编辑
          </Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteEnv(record.key)}>
            删除
          </Button>
        </Space>
      ),
    },
  ]

  const workspaceBackupColumns = [
    { title: '备份文件', dataIndex: 'filename', key: 'filename' },
    {
      title: '时间',
      dataIndex: 'modified',
      key: 'modified',
      render: (value: number) => new Date(value * 1000).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: WorkspaceFileBackupItem) => (
        <Button size="small" danger onClick={() => handleRestoreWorkspaceBackup(record.filename)}>
          恢复
        </Button>
      ),
    },
  ]

  const configBackupColumns = [
    { title: '备份文件', dataIndex: 'filename', key: 'filename' },
    {
      title: '时间',
      dataIndex: 'modified',
      key: 'modified',
      render: (value: number) => new Date(value * 1000).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: ConfigBackupItem) => (
        <Button size="small" danger onClick={() => handleRollbackConfig(record.filename)}>
          回滚
        </Button>
      ),
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
      <Card
        title="档案列表"
        extra={
          <Button size="small" icon={<ReloadOutlined />} onClick={reloadProfiles} loading={profilesLoading} />
        }
      >
        <List
          locale={{ emptyText: <Empty description="暂无档案" /> }}
          dataSource={profiles || []}
          renderItem={(item) => (
            <List.Item
              style={{
                cursor: 'pointer',
                paddingInline: 12,
                borderRadius: 8,
                background: item.name === selectedProfile ? '#e6f4ff' : 'transparent',
                marginBottom: 8,
              }}
              onClick={() => handleSwitchProfile(item.name)}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <Text strong>{getProfileLabel(item)}</Text>
                    {item.is_active && <Tag color="green">当前</Tag>}
                  </Space>
                }
                description={
                  <Space direction="vertical" size={2}>
                    <Text type="secondary">ID: {item.name}</Text>
                    <Text type="secondary" ellipsis>{item.home_path}</Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {!selectedProfile || !currentProfile ? (
          <Alert type="info" showIcon message="请先从左侧选择一个档案。" />
        ) : (
          <>
            <Card>
              <Title level={4} style={{ margin: 0 }}>
                {getProfileLabel(currentProfile)} 的档案文件
              </Title>
              <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                在一个页面里集中管理当前档案的核心文件与运行配置，包括 `SOUL.md`、`MEMORY.md`、`USER.md`、`AGENTS.md`、`config.yaml` 和 `.env`。
              </Paragraph>
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
              <Card
                title="关键文件"
                extra={
                  <Button size="small" icon={<ReloadOutlined />} onClick={reloadFiles} loading={filesLoading} />
                }
              >
                <Space direction="vertical" size={20} style={{ width: '100%' }}>
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: 10 }}>
                      核心文件
                    </Text>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: 10,
                        marginBottom: 14,
                      }}
                    >
                      {coreFiles.map((item) => (
                        <button
                          key={item.path}
                          type="button"
                          onClick={() => item.exists && handleSwitchFile(item.path)}
                          disabled={!item.exists}
                          style={{
                            textAlign: 'left',
                            border: item.path === activeFile ? '1px solid #f0b84b' : '1px solid #e5e7eb',
                            background: item.path === activeFile ? '#fff7e6' : '#fff',
                            borderRadius: 10,
                            padding: '12px 14px',
                            cursor: item.exists ? 'pointer' : 'not-allowed',
                            opacity: item.exists ? 1 : 0.65,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <div style={{ fontWeight: 700 }}>{getFileDisplayTitle(item.path)}</div>
                            {!item.exists && <Tag color="default" style={{ marginInlineEnd: 0 }}>未创建</Tag>}
                          </div>
                          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{item.path}</div>
                          <div style={{ fontSize: 12, color: '#444' }}>{getFileDescription(item.path)}</div>
                        </button>
                      ))}
                    </div>
                    <List
                      locale={{ emptyText: <Empty description="暂无核心文件" /> }}
                      dataSource={coreFiles}
                      renderItem={(item) => (
                        <List.Item
                          style={{
                            cursor: item.exists ? 'pointer' : 'not-allowed',
                            paddingInline: 12,
                            borderRadius: 8,
                            background: item.path === activeFile ? '#fff7e6' : 'transparent',
                            marginBottom: 8,
                            opacity: item.exists ? 1 : 0.65,
                          }}
                          onClick={() => item.exists && handleSwitchFile(item.path)}
                        >
                          <List.Item.Meta
                            title={
                              <Space size={8}>
                                <Text strong={item.path === activeFile}>{getFileDisplayTitle(item.path)}</Text>
                                <Text type="secondary">{item.path}</Text>
                                {!item.exists && <Tag color="default">未创建</Tag>}
                              </Space>
                            }
                            description={getFileDescription(item.path)}
                          />
                        </List.Item>
                      )}
                    />
                  </div>

                  <div>
                    <Text strong style={{ display: 'block', marginBottom: 10 }}>
                      运行配置
                    </Text>
                    <List
                      locale={{ emptyText: <Empty description="暂无运行配置文件" /> }}
                      dataSource={runtimeFiles}
                      renderItem={(item) => (
                        <List.Item
                          style={{
                            cursor: 'pointer',
                            paddingInline: 12,
                            borderRadius: 8,
                            background: item.path === activeFile ? '#fff7e6' : 'transparent',
                            marginBottom: 8,
                          }}
                          onClick={() => handleSwitchFile(item.path)}
                        >
                          <List.Item.Meta
                            title={<Text strong={item.path === activeFile}>{item.path}</Text>}
                            description={getFileDescription(item.path)}
                          />
                        </List.Item>
                      )}
                    />
                  </div>

                  <div>
                    <Text strong style={{ display: 'block', marginBottom: 10 }}>
                      自定义文档
                    </Text>
                    <List
                      locale={{ emptyText: <Empty description="暂无自定义文档" /> }}
                      dataSource={customFiles}
                      renderItem={(item) => (
                        <List.Item
                          style={{
                            cursor: 'pointer',
                            paddingInline: 12,
                            borderRadius: 8,
                            background: item.path === activeFile ? '#fff7e6' : 'transparent',
                            marginBottom: 8,
                          }}
                          onClick={() => handleSwitchFile(item.path)}
                        >
                          <List.Item.Meta
                            title={<Text strong={item.path === activeFile}>{item.path}</Text>}
                            description={getFileDescription(item.path)}
                          />
                        </List.Item>
                      )}
                    />
                  </div>
                </Space>
              </Card>

              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                {isEnvFile ? (
                  <Card
                    title=".env"
                    extra={
                      <Space>
                        <Input.Search
                          placeholder="搜索键名"
                          allowClear
                          style={{ width: 220 }}
                          onChange={(event) => setEnvSearch(event.target.value)}
                        />
                        <Button onClick={() => setAddEnvOpen(true)}>添加键值</Button>
                        <Button icon={<ReloadOutlined />} onClick={reloadEnv} loading={envLoading}>
                          刷新
                        </Button>
                      </Space>
                    }
                  >
                    <Paragraph type="secondary">{getFileDescription(activeFile)}</Paragraph>
                    <Table
                      rowKey="key"
                      columns={envColumns}
                      dataSource={envEntries}
                      pagination={false}
                      size="small"
                      locale={{ emptyText: '当前档案没有匹配的环境变量' }}
                    />
                  </Card>
                ) : (
                  <Card
                    title={
                      <Space>
                        <span>{activeFile}</span>
                        {dirty && <Tag color="orange">未保存</Tag>}
                      </Space>
                    }
                    extra={
                      <Space>
                        <Button
                          icon={<ReloadOutlined />}
                          onClick={isConfigFile ? reloadConfig : reloadFile}
                          loading={isConfigFile ? configLoading : fileLoading}
                        >
                          重新读取
                        </Button>
                        <Button icon={<HistoryOutlined />} onClick={handleBackup}>
                          备份
                        </Button>
                        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
                          保存
                        </Button>
                      </Space>
                    }
                  >
                    <Paragraph type="secondary">{getFileDescription(activeFile)}</Paragraph>
                    {!editableFiles.find((entry) => entry.path === activeFile) && getFileGroup(activeFile) === 'core' && (
                      <Alert
                        type="warning"
                        showIcon
                        style={{ marginBottom: 16 }}
                        message={`${activeFile} 当前未创建`}
                        description="这个档案目前没有对应文件，所以暂时无法编辑。现在会先标记出来，后续可以继续补“创建缺失文件”按钮。"
                      />
                    )}
                    <TextArea
                      value={textContent}
                      onChange={(event) => {
                        setTextContent(event.target.value)
                        setDirty(true)
                      }}
                      style={{
                        minHeight: 380,
                        fontFamily: 'monospace',
                        fontSize: 13,
                      }}
                    />
                  </Card>
                )}

                {!isEnvFile && (
                  <Card
                    title={isConfigFile ? 'config.yaml 备份' : `${activeFile} 备份`}
                    extra={
                      <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={isConfigFile ? reloadConfigBackups : reloadWorkspaceBackups}
                        loading={isConfigFile ? configBackupsLoading : workspaceBackupLoading}
                      />
                    }
                  >
                    {isConfigFile ? (
                      <Table
                        rowKey="filename"
                        columns={configBackupColumns}
                        dataSource={configBackups || []}
                        pagination={false}
                        size="small"
                        locale={{ emptyText: '当前档案还没有 config.yaml 备份' }}
                      />
                    ) : (
                      <Table
                        rowKey="filename"
                        columns={workspaceBackupColumns}
                        dataSource={workspaceBackups || []}
                        pagination={false}
                        size="small"
                        locale={{ emptyText: '当前文件还没有备份' }}
                      />
                    )}
                  </Card>
                )}
              </Space>
            </div>
          </>
        )}
      </Space>

      <Modal
        open={addEnvOpen}
        title="添加环境变量"
        onCancel={() => setAddEnvOpen(false)}
        onOk={() => addEnvForm.submit()}
        okText="保存"
      >
        <Form layout="vertical" form={addEnvForm} onFinish={submitAddEnv}>
          <Form.Item name="key" label="键名" rules={[{ required: true, message: '请输入键名' }]}>
            <Input placeholder="例如 MINIMAX_API_KEY" />
          </Form.Item>
          <Form.Item name="value" label="值" rules={[{ required: true, message: '请输入值' }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={Boolean(updateEnvKey)}
        title={`编辑 ${updateEnvKey || ''}`}
        onCancel={() => setUpdateEnvKey(null)}
        onOk={() => updateEnvForm.submit()}
        okText="保存"
      >
        <Form layout="vertical" form={updateEnvForm} onFinish={submitUpdateEnv}>
          <Form.Item name="value" label="新值" rules={[{ required: true, message: '请输入新值' }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
