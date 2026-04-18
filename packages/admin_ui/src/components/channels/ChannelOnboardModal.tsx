import { Modal, Steps, QRCode, Alert, Button, Space, Descriptions, Tag, Typography } from 'antd'
import { useState, useEffect, useRef } from 'react'
import { useHermesClient } from 'hermes_web_panel_client'
import { message } from 'antd'

type OnboardStep = 'scan' | 'waiting' | 'success' | 'apply' | 'done'
const { Text } = Typography

interface ChannelOnboardModalProps {
  open: boolean
  profileName: string
  channelId: string
  channelLabel: string
  onClose: () => void
  onComplete: () => void
}

export default function ChannelOnboardModal({
  open,
  profileName,
  channelId,
  channelLabel,
  onClose,
  onComplete,
}: ChannelOnboardModalProps) {
  const client = useHermesClient()
  const [step, setStep] = useState<OnboardStep>('scan')
  const [qrUrl, setQrUrl] = useState<string>('')
  const [sessionId, setSessionId] = useState<string>('')
  const [credentials, setCredentials] = useState<Record<string, string> | null>(null)
  const [applying, setApplying] = useState(false)
  const [sessionError, setSessionError] = useState<string>('')
  const pollTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (open) {
      setStep('scan')
      setQrUrl('')
      setSessionId('')
      setCredentials(null)
      setSessionError('')
      startSession()
      return () => stopPolling()
    }
    stopPolling()
    return undefined
  }, [open])

  const stopPolling = () => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  const startSession = async () => {
    try {
      const res = await client.startOnboardSession(profileName, channelId)
      setSessionId(res.session_id)
      setQrUrl(res.qr_url || '')
      setSessionError('')
      setStep('waiting')
      startPolling(res.session_id)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '启动接入流程失败')
      onClose()
    }
  }

  const startPolling = (sid: string) => {
    stopPolling()
    pollTimerRef.current = window.setInterval(async () => {
      try {
        const res = await client.getOnboardSession(profileName, channelId, sid)
        if (res.qr_url) {
          setQrUrl(res.qr_url)
        }
        if (res.status === 'completed') {
          stopPolling()
          setCredentials(res.credentials || null)
          setSessionError('')
          setStep('success')
        } else if (res.status === 'error' || res.status === 'failed' || res.status === 'denied' || res.status === 'expired') {
          stopPolling()
          setSessionError(res.error || '接入流程失败')
          message.error(res.error || '接入流程失败')
          setStep('scan')
        } else if (res.status === 'waiting_confirm') {
          setSessionError('')
          setStep('waiting')
        }
      } catch {
        // polling error, ignore
      }
    }, 3000)
  }

  const handleApply = async () => {
    if (!sessionId) return
    setApplying(true)
    try {
      await client.applyOnboardSession(profileName, channelId, sessionId)
      message.success('配置已写入当前档案')
      setStep('done')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '写入配置失败')
    } finally {
      setApplying(false)
    }
  }

  const handleClose = () => {
    stopPolling()
    setStep('scan')
    setQrUrl('')
    setSessionId('')
    setCredentials(null)
    setSessionError('')
    onClose()
  }

  const stepItems = [
    { title: '扫码授权', hint: '使用对应应用扫描二维码' },
    { title: '等待授权', hint: '等待授权完成' },
    { title: '查看凭证', hint: '确认已获取到的凭证信息' },
    { title: '应用配置', hint: '写入当前配置档案' },
    { title: '完成', hint: '配置已应用' },
  ]

  const currentStepIndex = { scan: 0, waiting: 1, success: 2, apply: 3, done: 4 }[step]

  return (
    <Modal
      title={`${channelLabel} - 快速接入`}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={600}
    >
      <Steps
        current={currentStepIndex}
        items={stepItems.map((item) => ({ title: item.title }))}
        size="small"
        responsive={false}
        style={{ marginBottom: 8 }}
      />
      <div style={{ marginBottom: 24 }}>
        <Text type="secondary">{stepItems[currentStepIndex]?.hint}</Text>
      </div>

      {step === 'scan' && (
        <Alert message={sessionError || '启动会话失败'} type="error" showIcon />
      )}

      {step === 'waiting' && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          {qrUrl && <QRCode value={qrUrl} size={200} />}
          <p style={{ marginTop: 16, color: '#666' }}>
            请使用你的 {channelLabel} 应用扫描二维码
          </p>
          <Alert
            message={channelId === 'weixin' ? '正在等待扫码或确认...' : '正在等待授权...'}
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        </div>
      )}

      {step === 'success' && credentials && (
        <div>
          <Alert
            message="授权成功"
            description="已成功获取凭证信息，点击下方按钮即可写入当前配置档案。"
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Descriptions column={1} size="small" bordered>
            {Object.entries(credentials).map(([k, v]) => (
              <Descriptions.Item key={k} label={k}>
                <Tag color="blue">{v ? '已获取' : '空'}</Tag>
              </Descriptions.Item>
            ))}
          </Descriptions>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Button type="primary" onClick={() => setStep('apply')}>
              写入配置档案
            </Button>
          </div>
        </div>
      )}

      {step === 'apply' && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <p>确定要将这些凭证写入配置档案“{profileName}”吗？</p>
          <Space>
            <Button onClick={() => setStep('success')}>返回</Button>
            <Button type="primary" loading={applying} onClick={handleApply}>
              应用
            </Button>
          </Space>
        </div>
      )}

      {step === 'done' && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Alert
            message="配置应用成功"
            description="渠道配置已经成功写入当前配置档案。"
            type="success"
            showIcon
          />
          <Button type="primary" style={{ marginTop: 16 }} onClick={onComplete}>
            刷新渠道列表
          </Button>
        </div>
      )}
    </Modal>
  )
}
