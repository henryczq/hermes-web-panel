import { Card, Input, Space, Tag, Button } from 'antd'
import { SaveOutlined } from '@ant-design/icons'

const { TextArea } = Input

interface WorkspaceFileEditorProps {
  filePath: string | null
  content: string
  readOnly: boolean
  onChange: (content: string) => void
  onSave: () => void
}

export default function WorkspaceFileEditor({
  filePath,
  content,
  readOnly,
  onChange,
  onSave,
}: WorkspaceFileEditorProps) {
  return (
    <Card
      title={
        <Space>
          {filePath || 'No file selected'}
          {readOnly && filePath && <Tag>read-only</Tag>}
        </Space>
      }
      extra={
        filePath && !readOnly && (
          <Button type="primary" size="small" icon={<SaveOutlined />} onClick={onSave}>
            Save
          </Button>
        )
      }
      style={{ flex: 1 }}
      styles={{ body: { padding: 0 } }}
    >
      <TextArea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: 'none',
          borderRadius: 0,
          height: 'calc(100vh - 280px)',
          fontFamily: 'monospace',
          fontSize: 13,
          padding: 16,
          resize: 'none',
        }}
        disabled={readOnly || !filePath}
      />
    </Card>
  )
}
