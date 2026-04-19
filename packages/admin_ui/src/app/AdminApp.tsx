import { useState } from 'react'
import AdminShell from './AdminShell'
import type { MenuKey } from './admin-menu.config'
import ProfilesPage from '../pages/ProfilesPage'
import SourcesPage from '../pages/SourcesPage'
import ChannelsPage from '../pages/ChannelsPage'
import AIPage from '../pages/AIPage'
import WorkspacePage from '../pages/WorkspacePage'

const pageMap: Record<MenuKey, React.ComponentType> = {
  profiles: ProfilesPage,
  sources: SourcesPage,
  channels: ChannelsPage,
  ai: AIPage,
  workspace: WorkspacePage,
}

export default function AdminApp() {
  const [activeMenu, setActiveMenu] = useState<MenuKey>('profiles')
  const Page = pageMap[activeMenu]

  return (
    <AdminShell activeMenu={activeMenu} onMenuChange={setActiveMenu}>
      <Page />
    </AdminShell>
  )
}
