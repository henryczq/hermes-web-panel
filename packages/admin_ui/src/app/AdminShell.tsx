import { useState, useMemo, createElement, useEffect } from 'react'
import { Layout, Menu, Drawer, Button, Space, Tag, Select, Grid, Typography } from 'antd'
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import type { MenuKey } from './admin-menu.config'
import { menuDefs } from './admin-menu.config'
import { useProfile } from '../context/ProfileContext.js'
import { useHermesClient } from 'hermes_web_panel_client'
import { useAsyncData } from '../hooks/useAsyncData.js'
import type { HermesProfileSummary } from 'hermes_web_panel_contract'

const { Sider, Content, Header } = Layout
const { Text } = Typography

interface AdminShellProps {
  activeMenu: MenuKey
  onMenuChange: (key: MenuKey) => void
  children: React.ReactNode
}

function getProfileDisplayName(profileName: string): string {
  return profileName === 'default' ? '主配置' : profileName
}

function getPreferredProfileLabel(profile: HermesProfileSummary): string {
  return profile.display_name?.trim() || getProfileDisplayName(profile.name)
}

export default function AdminShell({ activeMenu, onMenuChange, children }: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { selectedProfile, setSelectedProfile } = useProfile()
  const client = useHermesClient()
  const screens = Grid.useBreakpoint()
  const isDesktop = screens.lg ?? false

  const { data: profiles } = useAsyncData<HermesProfileSummary[]>(
    () => client.listProfiles(),
    [],
  )

  useEffect(() => {
    if (!selectedProfile && profiles && profiles.length > 0) {
      setSelectedProfile(profiles[0].name)
    }
  }, [profiles, selectedProfile, setSelectedProfile])

  const menuItems = useMemo(
    () =>
      menuDefs.map((item) => ({
        key: item.key,
        icon: createElement(item.icon),
        label: item.label,
      })),
    [],
  )

  const headerContent = (
    <Space>
      <span style={{ fontWeight: 600 }}>Hermes 管理台</span>
      {profiles && profiles.length > 0 && (
        <Select
          style={{ width: 180 }}
          value={selectedProfile}
          placeholder="选择配置档案"
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
      )}
    </Space>
  )

  const siderContent = (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[activeMenu]}
      items={menuItems}
      onClick={({ key }) => onMenuChange(key as MenuKey)}
    />
  )

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {isDesktop && (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          collapsedWidth={80}
          trigger={null}
        >
          <div style={{ padding: '16px', color: '#fff', fontSize: 16, fontWeight: 600 }}>
            {collapsed ? 'H' : 'Hermes 管理台'}
          </div>
          {siderContent}
        </Sider>
      )}
      <Layout>
        <Header
          style={{
            padding: '0 16px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          <Space>
            {!isDesktop && (
              <Button
                type="text"
                icon={drawerOpen ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setDrawerOpen(true)}
              />
            )}
            {headerContent}
          </Space>
        </Header>
        <Content
          style={{
            margin: 16,
            padding: 24,
            background: '#fff',
            borderRadius: 8,
            minHeight: 280,
          }}
        >
          {children}
        </Content>
      </Layout>
      {!isDesktop && (
        <Drawer
          title="菜单"
          placement="left"
          onClose={() => setDrawerOpen(false)}
          open={drawerOpen}
          styles={{ body: { padding: 0 } }}
        >
          <Menu
            mode="inline"
            selectedKeys={[activeMenu]}
            items={menuItems}
            onClick={({ key }) => {
              onMenuChange(key as MenuKey)
              setDrawerOpen(false)
            }}
          />
        </Drawer>
      )}
    </Layout>
  )
}
