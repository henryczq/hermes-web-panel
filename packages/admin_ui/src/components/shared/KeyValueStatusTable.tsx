import { Table, Tag, Space, Button, Modal } from 'antd'
import { EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'

interface KeyValueEntry {
  key: string
  value: boolean
}

interface KeyValueStatusTableProps {
  data: KeyValueEntry[]
  revealedKeys: Record<string, string>
  onReveal?: (key: string) => void
  onEdit?: (key: string) => void
  onDelete?: (key: string) => void
  loading?: boolean
}

export default function KeyValueStatusTable({
  data,
  revealedKeys,
  onReveal,
  onEdit,
  onDelete,
  loading,
}: KeyValueStatusTableProps) {
  const handleDelete = (key: string) => {
    Modal.confirm({
      title: `Delete ${key}?`,
      content: 'This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: () => onDelete?.(key),
    })
  }

  const columns = [
    { title: 'Key', dataIndex: 'key', key: 'key' },
    {
      title: 'Value',
      key: 'value',
      render: (_: unknown, record: KeyValueEntry) => {
        if (revealedKeys[record.key]) {
          return <Tag color="blue">{revealedKeys[record.key]}</Tag>
        }
        return record.value ? <Tag color="green">configured</Tag> : <Tag>empty</Tag>
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: KeyValueEntry) => (
        <Space>
          {record.value && onReveal && (
            <Button size="small" icon={<EyeOutlined />} onClick={() => onReveal(record.key)} />
          )}
          {onEdit && (
            <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(record.key)} />
          )}
          {onDelete && (
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.key)} />
          )}
        </Space>
      ),
    },
  ]

  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey="key"
      pagination={false}
      size="small"
      loading={loading}
    />
  )
}
