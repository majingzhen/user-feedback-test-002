import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PRESETS } from '../../src/core/config/presets.js'
import { buildDemoScene } from '../../src/core/scene/demo_scene.js'
import { computeConfigHash, fnv1aHex } from '../../src/core/scene/scene_hash.js'
import { validateConfig } from '../../src/core/config/validation.js'

test('FNV-1a 已知向量', () => {
  assert.equal(fnv1aHex(''), '811c9dc5')
  assert.equal(fnv1aHex('a'), 'e40c292c')
})

test('hash 对 targetSpp 不敏感（提高 SPP 是合法续算）', () => {
  const scene = buildDemoScene()
  const a = { ...PRESETS.preview, targetSpp: 32 }
  const b = { ...PRESETS.preview, targetSpp: 256 }
  assert.equal(computeConfigHash(a, scene), computeConfigHash(b, scene))
})

test('hash 对 sppPerPass 与场景参数敏感', () => {
  const scene = buildDemoScene()
  const base = PRESETS.preview
  const changed = { ...base, sppPerPass: base.sppPerPass * 2, targetSpp: base.sppPerPass * 2 }
  assert.notEqual(computeConfigHash(base, scene), computeConfigHash(changed, scene))
  const moved = {
    ...scene,
    primitives: scene.primitives.map((p, i) =>
      i === 4
        ? { ...p, center: [p.center[0] + 0.1, p.center[1], p.center[2]] as [number, number, number] }
        : p,
    ),
  }
  assert.notEqual(computeConfigHash(base, scene), computeConfigHash(base, moved))
})

test('默认预设通过校验', () => {
  assert.deepEqual(validateConfig(PRESETS.preview), [])
  assert.deepEqual(validateConfig(PRESETS.demo), [])
})

test('非法配置被拦截', () => {
  const bad = { ...PRESETS.preview, targetSpp: 30 }
  assert.ok(validateConfig(bad).length > 0)
})
