import { Button, Card, Table, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useHermesClient } from 'hermes_web_panel_client'
import { useAsyncData } from '../hooks/useAsyncData.js'
import type { ConfigSourceItem } from 'hermes_web_panel_contract'

const { Title } = Typography

export default function SourcesPage() {
  const client = useHermesClient()
  const { data, loading, reload } = useAsyncData<ConfigSourceItem[]>(
    () => client.listConfigSources(),
    [],
  )

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ConfigSourceItem) => (
        <span>
          {record.display_name || name} {record.kind === 'default' ? <Tag color="blue">默认</Tag> : null}
        </span>
      ),
    },
    { title: '类型', dataIndex: 'kind', key: 'kind' },
    {
      title: '关联档案',
      key: 'linked_profiles',
      render: (_: unknown, record: ConfigSourceItem) => record.linked_profiles.length,
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      render: (note?: string | null) => note || '-',
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>共享配置</Title>
        <Button icon={<ReloadOutlined />} onClick={reload} loading={loading} />
      </div>
      <Card>
        <Table rowKey="id" dataSource={data || []} columns={columns} pagination={false} loading={loading} />
      </Card>
    </div>
  )
}
