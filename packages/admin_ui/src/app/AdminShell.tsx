import { useState, useMemo, createElement } from 'react'
import { Layout, Menu, Drawer, Button, Space, Grid } from 'antd'
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import type { MenuKey } from './admin-menu.config'
import { menuDefs } from './admin-menu.config'
import ProfileSelector from '../components/shared/ProfileSelector'
const { Sider, Content, Header } = Layout

interface AdminShellProps {
  activeMenu: MenuKey
  onMenuChange: (key: MenuKey) => void
  children: React.ReactNode
}

export default function AdminShell({ activeMenu, onMenuChange, children }: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const screens = Grid.useBreakpoint()
  const isDesktop = screens.lg ?? false

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
          <ProfileSelector />
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
