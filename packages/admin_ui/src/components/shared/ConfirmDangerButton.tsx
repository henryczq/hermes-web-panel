import { Button, Modal } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'

interface ConfirmDangerButtonProps {
  title: string
  content: string
  okText?: string
  onConfirm: () => void | Promise<void>
  children?: React.ReactNode
  buttonProps?: React.ComponentProps<typeof Button>
}

export default function ConfirmDangerButton({
  title,
  content,
  okText = 'Confirm',
  onConfirm,
  children,
  buttonProps,
}: ConfirmDangerButtonProps) {
  const handleClick = () => {
    Modal.confirm({
      title,
      content,
      icon: <ExclamationCircleOutlined />,
      okText,
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        await onConfirm()
      },
    })
  }

  return (
    <Button danger onClick={handleClick} {...buttonProps}>
      {children}
    </Button>
  )
}
