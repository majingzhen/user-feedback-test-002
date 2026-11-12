import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodePtf, encodePtf, PTF_MAGIC } from '../../src/node/ptf1.js'

test('PTF1 编码解码往返一致', () => {
  const buffer = new Float32Array([1.5, -2.25, 3.125, 0, 4, 5, 6, 7])
  const packed = encodePtf(2, 1, 48, buffer)
  assert.equal(packed.readUInt32LE(0), PTF_MAGIC)
  const decoded = decodePtf(packed)
  assert.equal(decoded.width, 2)
  assert.equal(decoded.height, 1)
  assert.equal(decoded.spp, 48)
  assert.deepEqual(Array.from(decoded.buffer), Array.from(buffer))
})

test('PTF1 魔数错误抛异常', () => {
  const bad = Buffer.alloc(32)
  assert.throws(() => decodePtf(bad))
})
