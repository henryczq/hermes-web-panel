import { Card, Input } from 'antd'
import { useState, useEffect } from 'react'

const { TextArea } = Input

interface JsonEditorCardProps {
  title: string
  value: unknown
  onChange?: (value: unknown) => void
  readOnly?: boolean
  rows?: number
  extra?: React.ReactNode
}

export default function JsonEditorCard({
  title,
  value,
  onChange,
  readOnly = false,
  rows = 6,
  extra,
}: JsonEditorCardProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      setText(value ? JSON.stringify(value, null, 2) : '')
      setError(null)
    } catch {
      setText(String(value ?? ''))
    }
  }, [value])

  const handleChange = (newText: string) => {
    setText(newText)
    if (onChange) {
      try {
        onChange(newText ? JSON.parse(newText) : null)
        setError(null)
      } catch {
        setError('Invalid JSON')
      }
    }
  }

  return (
    <Card title={title} size="small" extra={extra}>
      <TextArea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        rows={rows}
        style={{ fontFamily: 'monospace', fontSize: 13 }}
        readOnly={readOnly}
      />
      {error && (
        <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>{error}</div>
      )}
    </Card>
  )
}
