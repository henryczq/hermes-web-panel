import { App as AntdApp, ConfigProvider } from 'antd'
import { HermesAdminClientProvider } from 'hermes_web_panel_client'
import { ProfileProvider } from 'hermes_web_panel_ui'
import { AdminApp } from 'hermes_web_panel_ui'

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677ff',
        },
      }}
    >
      <HermesAdminClientProvider>
        <ProfileProvider>
          <AntdApp>
            <AdminApp />
          </AntdApp>
        </ProfileProvider>
      </HermesAdminClientProvider>
    </ConfigProvider>
  )
}
