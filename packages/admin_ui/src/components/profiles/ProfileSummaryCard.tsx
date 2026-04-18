import { Card, Descriptions, Tag, Space } from 'antd'
import type { HermesProfileSummary } from 'hermes_web_panel_contract'

interface ProfileSummaryCardProps {
  profile: HermesProfileSummary | undefined
  selectedName: string
}

export default function ProfileSummaryCard({ profile, selectedName }: ProfileSummaryCardProps) {
  if (!profile) return null

  return (
    <Card style={{ marginBottom: 16 }} title="Selected Profile Summary">
      <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} size="small">
        <Descriptions.Item label="Name">{selectedName}</Descriptions.Item>
        <Descriptions.Item label="Status">
          <Tag color={profile.is_active ? 'green' : 'default'}>
            {profile.is_active ? 'active' : 'inactive'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Home">{profile.home_path}</Descriptions.Item>
        <Descriptions.Item label="Config">{profile.config_path}</Descriptions.Item>
        <Descriptions.Item label="Env">{profile.env_path}</Descriptions.Item>
        <Descriptions.Item label="Model">{profile.default_model || '-'}</Descriptions.Item>
        <Descriptions.Item label="Provider">{profile.provider || '-'}</Descriptions.Item>
        <Descriptions.Item label="Channels">
          <Space>
            {profile.channels.map((ch) => (
              <Tag key={ch} color="blue">{ch}</Tag>
            ))}
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="Gateway">
          <Tag color={profile.has_gateway ? 'blue' : 'default'}>
            {profile.has_gateway ? 'running' : 'stopped'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="API Server">
          <Tag color={profile.has_api_server ? 'green' : 'default'}>
            {profile.has_api_server ? 'running' : 'stopped'}
          </Tag>
        </Descriptions.Item>
      </Descriptions>
    </Card>
  )
}
