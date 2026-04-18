import { Card, Table, Button } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import ConfirmDangerButton from '../shared/ConfirmDangerButton'
import type { ConfigBackupItem } from 'hermes_web_panel_contract'

interface BackupListProps {
  backups: ConfigBackupItem[]
  onRollback: (filename: string) => void
  onReload: () => void
  loading: boolean
}

export default function BackupList({ backups, onRollback, onReload, loading }: BackupListProps) {
  const columns = [
    { title: 'Filename', dataIndex: 'filename', key: 'filename' },
    { title: 'Created', dataIndex: 'created_at', key: 'created_at' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: ConfigBackupItem) => (
        <ConfirmDangerButton
          title="Rollback Config"
          content={`Rollback to backup "${record.filename}"?`}
          okText="Rollback"
          onConfirm={() => onRollback(record.filename)}
          buttonProps={{ size: 'small' }}
        >
          Rollback
        </ConfirmDangerButton>
      ),
    },
  ]

  return (
    <Card
      title="Config Backups"
      extra={
        <Button icon={<ReloadOutlined />} onClick={onReload} loading={loading} />
      }
    >
      <Table
        columns={columns}
        dataSource={backups}
        rowKey="filename"
        pagination={false}
        size="small"
      />
    </Card>
  )
}
