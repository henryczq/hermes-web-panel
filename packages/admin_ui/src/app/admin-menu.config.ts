import {
  ProfileOutlined,
  LinkOutlined,
  RobotOutlined,
  FolderOutlined,
  SettingOutlined,
} from '@ant-design/icons'

export type MenuKey = 'profiles' | 'channels' | 'ai' | 'workspace' | 'config'

export interface MenuItemDef {
  key: MenuKey
  icon: typeof ProfileOutlined
  label: string
}

export const menuDefs: MenuItemDef[] = [
  { key: 'profiles', icon: ProfileOutlined, label: '配置档案' },
  { key: 'channels', icon: LinkOutlined, label: '渠道接入' },
  { key: 'ai', icon: RobotOutlined, label: 'AI 配置' },
  { key: 'workspace', icon: FolderOutlined, label: '工作区' },
  { key: 'config', icon: SettingOutlined, label: '系统配置' },
]

export const menuLabels: Record<MenuKey, string> = {
  profiles: '配置档案',
  channels: '渠道接入',
  ai: 'AI 配置',
  workspace: '工作区',
  config: '系统配置',
}
