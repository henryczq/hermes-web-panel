import { Alert, Spin, Result, Button } from 'antd'

interface AsyncStatePanelProps {
  loading: boolean
  error: Error | null
  empty?: boolean
  emptyDescription?: string
  onRetry?: () => void
  children: React.ReactNode
}

export default function AsyncStatePanel({
  loading,
  error,
  empty,
  emptyDescription = 'No data available',
  onRetry,
  children,
}: AsyncStatePanelProps) {
  if (loading) {
    return <Spin size="large" style={{ display: 'block', textAlign: 'center', padding: 40 }} />
  }

  if (error) {
    return (
      <Result
        status="error"
        title="Failed to load"
        subTitle={error.message}
        extra={
          onRetry && (
            <Button type="primary" onClick={onRetry}>
              Retry
            </Button>
          )
        }
      />
    )
  }

  if (empty) {
    return <Alert message="No data" description={emptyDescription} type="info" showIcon />
  }

  return <>{children}</>
}
