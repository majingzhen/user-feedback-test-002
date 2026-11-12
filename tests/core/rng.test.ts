import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pcgInit, pcgNext, pcgFloat } from '../../src/core/math/rng.js'
import { makeSeed } from '../../src/core/rng/rng_seed.js'

test('PCG32 同种子序列稳定', () => {
  const a = pcgInit(12345, 7)
  const b = pcgInit(12345, 7)
  const seqA = Array.from({ length: 16 }, () => pcgNext(a))
  const seqB = Array.from({ length: 16 }, () => pcgNext(b))
  assert.deepEqual(seqA, seqB)
})

test('PCG32 不同种子序列不同', () => {
  const a = pcgInit(1, 0)
  const b = pcgInit(2, 0)
  assert.notEqual(pcgNext(a), pcgNext(b))
})

test('pcgFloat 落在 [0,1)', () => {
  const s = pcgInit(999, 3)
  for (let i = 0; i < 1000; i++) {
    const x = pcgFloat(s)
    assert.ok(x >= 0 && x < 1)
  }
})

test('makeSeed 四要素确定且输入敏感', () => {
  const s1 = makeSeed(10, 2, 5, 0xabcdef)
  const s2 = makeSeed(10, 2, 5, 0xabcdef)
  const s3 = makeSeed(10, 2, 6, 0xabcdef)
  assert.equal(s1, s2)
  assert.notEqual(s1, s3)
})
