import { Select, Space, Tag, Typography } from 'antd'
import { useProfile } from '../../context/ProfileContext'
import { useHermesClient } from 'hermes_web_panel_client'
import { useAsyncData } from '../../hooks/useAsyncData'
import type { HermesProfileSummary } from 'hermes_web_panel_contract'

interface ProfileSelectorProps {
  style?: React.CSSProperties
}

const { Text } = Typography

function getProfileDisplayName(profileName: string): string {
  return profileName === 'default' ? '主配置' : profileName
}

function getPreferredProfileLabel(profile: HermesProfileSummary): string {
  return profile.display_name?.trim() || getProfileDisplayName(profile.name)
}

export default function ProfileSelector({ style }: ProfileSelectorProps) {
  const { selectedProfile, setSelectedProfile } = useProfile()
  const client = useHermesClient()

  const { data: profiles } = useAsyncData<HermesProfileSummary[]>(
    () => client.listProfiles(),
    [],
  )

  if (!profiles || profiles.length === 0) {
    return null
  }

  return (
    <Select
      style={{ width: 200, ...style }}
      value={selectedProfile}
      placeholder="Select profile"
      onChange={setSelectedProfile}
      options={profiles.map((p) => ({
        value: p.name,
        label: (
          <Space>
            {getPreferredProfileLabel(p)}
            {p.display_name?.trim() && <Text type="secondary">({p.name})</Text>}
            {p.name === 'default' && <Tag color="blue">默认</Tag>}
            {p.is_active && <Tag color="green">当前</Tag>}
          </Space>
        ),
      }))}
    />
  )
}
