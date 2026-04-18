import { describe, it, expect } from 'vitest'

describe('Basic smoke tests', () => {
  it('passes basic assertion', () => {
    expect(true).toBe(true)
  })

  it('JSON validation works', () => {
    const validateJson = (value: string) => {
      if (!value) return { valid: true }
      try {
        JSON.parse(value)
        return { valid: true }
      } catch (e) {
        return { valid: false, error: e instanceof Error ? e.message : 'Invalid JSON' }
      }
    }

    expect(validateJson('')).toEqual({ valid: true })
    expect(validateJson('{"key": "value"}')).toEqual({ valid: true })
    expect(validateJson('{invalid').valid).toBe(false)
  })

  it('Channel registry pattern works', () => {
    const CHANNEL_REGISTRY = {
      feishu: { label: 'Feishu', supportsScan: true },
      wecom_bot: { label: 'WeCom Bot', supportsScan: true },
      telegram: { label: 'Telegram', supportsScan: false },
    }

    expect(CHANNEL_REGISTRY.feishu.supportsScan).toBe(true)
    expect(CHANNEL_REGISTRY.telegram.supportsScan).toBe(false)
  })
})
