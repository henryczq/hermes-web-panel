import { Card, Input, Button, Space } from 'antd'
import { SaveOutlined, ReloadOutlined, HistoryOutlined } from '@ant-design/icons'

const { TextArea } = Input

interface ConfigEditorProps {
  content: string
  onChange: (content: string) => void
  onSave: () => void
  onBackup: () => void
  onReload: () => void
  loading: boolean
  parsedPreview?: unknown
}

export default function ConfigEditor({
  content,
  onChange,
  onSave,
  onBackup,
  onReload,
  loading,
  parsedPreview,
}: ConfigEditorProps) {
  return (
    <Card
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={onReload} loading={loading} />
          <Button icon={<HistoryOutlined />} onClick={onBackup}>
            Backup
          </Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={onSave}>
            Save
          </Button>
        </Space>
      }
    >
      <TextArea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        style={{ fontFamily: 'monospace', fontSize: 13, minHeight: 400 }}
      />
      {parsedPreview && (
        <Card title="Parsed Preview" style={{ marginTop: 16 }} size="small">
          <pre style={{ fontSize: 12, maxHeight: 300, overflow: 'auto' }}>
            {JSON.stringify(parsedPreview, null, 2)}
          </pre>
        </Card>
      )}
    </Card>
  )
}
