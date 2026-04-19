import {
  ProfileOutlined,
  LinkOutlined,
  RobotOutlined,
  FolderOutlined,
  SettingOutlined,
} from '@ant-design/icons'

export type MenuKey = 'profiles' | 'sources' | 'channels' | 'ai' | 'workspace'

export interface MenuItemDef {
  key: MenuKey
  icon: typeof ProfileOutlined
  label: string
}

export const menuDefs: MenuItemDef[] = [
  { key: 'profiles', icon: ProfileOutlined, label: '档案' },
  { key: 'sources', icon: SettingOutlined, label: '共享配置' },
  { key: 'channels', icon: LinkOutlined, label: '渠道' },
  { key: 'ai', icon: RobotOutlined, label: 'AI' },
  { key: 'workspace', icon: FolderOutlined, label: '档案文件' },
]

export const menuLabels: Record<MenuKey, string> = {
  profiles: '档案',
  sources: '共享配置',
  channels: '渠道',
  ai: 'AI',
  workspace: '档案文件',
}
