import { Card, Tree, Space, Tag, Button } from 'antd'
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import type { WorkspaceFileEntry } from 'hermes_web_panel_contract'

interface WorkspaceFileTreeProps {
  files: WorkspaceFileEntry[]
  selectedFile: string | null
  onSelect: (path: string) => void
  onReload: () => void
  loading: boolean
}

export default function WorkspaceFileTree({
  files,
  selectedFile,
  onSelect,
  onReload,
  loading,
}: WorkspaceFileTreeProps) {
  const treeData = files.map((entry) => ({
    title: (
      <Space>
        {entry.path}
        {entry.editable && <Tag color="green" style={{ fontSize: 10 }}>editable</Tag>}
      </Space>
    ),
    key: entry.path,
    isLeaf: entry.kind === 'file',
  }))

  return (
    <Card
      title="Files"
      extra={
        <Button size="small" icon={<ReloadOutlined />} onClick={onReload} loading={loading} />
      }
      styles={{ body: { padding: 8, overflow: 'auto', maxHeight: 'calc(100vh - 280px)' } }}
    >
      <Tree
        treeData={treeData}
        selectedKeys={selectedFile ? [selectedFile] : []}
        onSelect={(keys) => {
          if (keys[0]) onSelect(keys[0] as string)
        }}
        showIcon={false}
      />
    </Card>
  )
}
