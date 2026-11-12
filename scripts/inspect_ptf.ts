// 数值诊断：读 PTF1 浮点缓冲，统计线性 HDR 分布
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { decodePtf } from '../src/node/ptf1.js'

const dir = process.argv[2] ?? 'output/session-ce764584'
const data = await readFile(join(dir, 'frame_0000.ptf1'))
const { width, height, spp, buffer } = decodePtf(data)
const pixels = width * height
const means = [0, 0, 0]
let min = Infinity
let max = 0
const samples: Array<[number, number, number]> = []
for (let p = 0; p < pixels; p++) {
  for (let c = 0; c < 3; c++) {
    const v = buffer[p * 4 + c] / spp
    means[c] += v
    if (v < min) min = v
    if (v > max) max = v
  }
  if (p === Math.floor(pixels * 0.5)) samples.push(['center' as unknown as number, 0, 0] as never)
}
console.log('尺寸', width, height, 'SPP', spp)
console.log('通道均值 (R,G,B):', means.map((m) => (m / pixels).toFixed(4)).join(', '))
console.log('最小', min.toFixed(4), '最大', max.toFixed(4))

// 取画面上中下三行的代表像素线性值
const rows = [0.2, 0.5, 0.8]
for (const ry of rows) {
  const y = Math.floor(height * (1 - ry))
  const x = Math.floor(width * 0.5)
  const idx = (y * width + x) * 4
  console.log(
    `纵向 ${ry} 处线性值:`,
    [0, 1, 2].map((c) => (buffer[idx + c] / spp).toFixed(3)).join(', '),
  )
}
