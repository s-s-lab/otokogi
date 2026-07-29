import { describe, expect, it } from 'vitest'
import { buildShareHash, getShareKeyFromHash } from './share'

describe('shared URL helpers', () => {
  const key = 'a'.repeat(64)

  it('reads a valid share key from the URL hash', () => {
    expect(getShareKeyFromHash(`#/group/${key}`)).toBe(key)
  })

  it('rejects malformed share hashes', () => {
    expect(getShareKeyFromHash('#/group/short')).toBeNull()
    expect(getShareKeyFromHash('#/other/' + key)).toBeNull()
  })

  it('builds the canonical group hash', () => {
    expect(buildShareHash(key)).toBe(`#/group/${key}`)
  })
})
