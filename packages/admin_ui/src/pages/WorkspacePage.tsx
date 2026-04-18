import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Tree,
  Input,
  Button,
  Card,
  Space,
  message,
  Typography,
  Alert,
  Tag,
  Modal,
} from 'antd'
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons'
import { useHermesClient } from 'hermes_web_panel_client'
import { useAsyncData } from '../hooks/useAsyncData.js'
import { useProfile } from '../context/ProfileContext.js'
import type { WorkspaceFileEntry } from 'hermes_web_panel_contract'

const { Title } = Typography
const { TextArea } = Input

interface TreeNode {
  title: React.ReactNode
  key: string
  isLeaf: boolean
  selectable: boolean
  children?: TreeNode[]
}

export default function WorkspacePage() {
  const client = useHermesClient()
  const { selectedProfile } = useProfile()
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [readOnly, setReadOnly] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  const [loadedDirs, setLoadedDirs] = useState<Set<string>>(new Set())

  const { data, loading, reload } = useAsyncData<WorkspaceFileEntry[]>(
    () => {
      if (!selectedProfile) return Promise.resolve([])
      return client.getWorkspaceFiles(selectedProfile)
    },
    [selectedProfile],
  )

  const fileMap = useMemo(
    () => new Map((data || []).map((entry) => [entry.path, entry])),
    [data],
  )

  const loadDirectory = useCallback(
    async (dirPath: string) => {
      if (!selectedProfile || loadedDirs.has(dirPath)) return
      try {
        const entries = await client.getWorkspaceFiles(selectedProfile, dirPath)
        setLoadedDirs((prev) => new Set([...prev, dirPath]))
        return entries
      } catch {
        return []
      }
    },
    [selectedProfile, loadedDirs, client],
  )

  const handleExpand = async (keys: React.Key[]) => {
    setExpandedKeys(keys as string[])
    for (const key of keys) {
      if (!loadedDirs.has(key as string)) {
        await loadDirectory(key as string)
      }
    }
  }

  useEffect(() => {
    if (selectedFile && selectedProfile) {
      client.readWorkspaceFile(selectedProfile, selectedFile)
        .then((res) => {
          setFileContent(res.content)
          setReadOnly(!(fileMap.get(res.path)?.editable ?? false))
          setDirty(false)
        })
        .catch((e) => {
          message.error(e instanceof Error ? e.message : '读取文件失败')
          setFileContent('')
        })
    }
  }, [client, fileMap, selectedFile, selectedProfile])

  const handleSave = async () => {
    if (!selectedProfile || !selectedFile) return
    try {
      await client.writeWorkspaceFile(selectedProfile, {
        path: selectedFile,
        content: fileContent,
      })
      message.success('文件已保存')
      setDirty(false)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存文件失败')
    }
  }

  const handleFileSelect = (keys: React.Key[]) => {
    if (keys[0]) {
      if (dirty) {
        Modal.confirm({
          title: '存在未保存内容',
          content: '当前有未保存的修改，确定要丢弃吗？',
          okText: '丢弃',
          onOk: () => {
            setSelectedFile(keys[0] as string)
            setDirty(false)
          },
        })
      } else {
        setSelectedFile(keys[0] as string)
      }
    }
  }

  if (!selectedProfile) {
    return <Alert message="请先选择一个配置档案" type="info" />
  }

  const buildTree = (entries: WorkspaceFileEntry[]): TreeNode[] => {
    const nodeMap = new Map<string, TreeNode>()
    const roots: TreeNode[] = []

    for (const entry of entries) {
      const node: TreeNode = {
        title: (
          <Space>
            {entry.path.split('/').pop() || entry.path}
            {entry.editable && <Tag color="green" style={{ fontSize: 10 }}>可编辑</Tag>}
          </Space>
        ),
        key: entry.path,
        isLeaf: entry.kind === 'file',
        selectable: entry.kind === 'file',
        children: entry.kind === 'dir' ? [] : undefined,
      }
      nodeMap.set(entry.path, node)
    }

    for (const entry of entries) {
      const node = nodeMap.get(entry.path)!
      const parts = entry.path.split('/')
      if (parts.length === 1) {
        roots.push(node)
      } else {
        const parentPath = parts.slice(0, -1).join('/')
        const parent = nodeMap.get(parentPath)
        if (parent && parent.children) {
          parent.children.push(node)
        }
      }
    }

    return roots
  }

  const treeData = useMemo(() => buildTree(data || []), [data])

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 200px)' }}>
      <Card
        title="文件"
        style={{ width: 300, flexShrink: 0 }}
        extra={
          <Button size="small" icon={<ReloadOutlined />} onClick={reload} loading={loading} />
        }
        styles={{ body: { padding: 8, overflow: 'auto', maxHeight: 'calc(100vh - 280px)' } }}
      >
        <Tree
          treeData={treeData}
          expandedKeys={expandedKeys}
          onExpand={handleExpand}
          onSelect={handleFileSelect}
          selectedKeys={selectedFile ? [selectedFile] : []}
          showIcon={false}
          loadData={async (treeNode) => {
            const key = treeNode.key as string
            if (!loadedDirs.has(key)) {
              await loadDirectory(key)
            }
          }}
        />
      </Card>

      <Card
        title={
          <Space>
            {selectedFile || '未选择文件'}
            {dirty && <Tag color="orange">未保存</Tag>}
            {readOnly && selectedFile && <Tag>只读</Tag>}
          </Space>
        }
        extra={
          selectedFile && !readOnly && (
            <Button type="primary" size="small" icon={<SaveOutlined />} onClick={handleSave}>
              保存
            </Button>
          )
        }
        style={{ flex: 1 }}
        styles={{ body: { padding: 0 } }}
      >
        <TextArea
          value={fileContent}
          onChange={(e) => {
            setFileContent(e.target.value)
            setDirty(true)
          }}
          style={{
            border: 'none',
            borderRadius: 0,
            height: 'calc(100vh - 280px)',
            fontFamily: 'monospace',
            fontSize: 13,
            padding: 16,
            resize: 'none',
          }}
          disabled={readOnly || !selectedFile}
        />
      </Card>
    </div>
  )
}
