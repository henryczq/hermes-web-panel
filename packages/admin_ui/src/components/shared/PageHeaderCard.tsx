import { Card, Typography, Space, Button } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'

const { Title } = Typography

interface PageHeaderCardProps {
  title: string
  extra?: React.ReactNode
  onReload?: () => void
  loading?: boolean
  children?: React.ReactNode
}

export default function PageHeaderCard({
  title,
  extra,
  onReload,
  loading,
  children,
}: PageHeaderCardProps) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {title}
        </Title>
        <Space>
          {onReload && (
            <Button icon={<ReloadOutlined />} onClick={onReload} loading={loading} />
          )}
          {extra}
        </Space>
      </div>
      {children}
    </div>
  )
}
