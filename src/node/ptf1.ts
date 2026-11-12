// PTF1: magic "PTF1"(0-3) | u16 width(4-5) | u16 height(6-7) | u32 spp(8-11) | u32 reserved(12-15)
export const PTF_MAGIC = 0x31465450 // "PTF1" 小端
const HEADER_BYTES = 16

export function encodePtf(width: number, height: number, spp: number, buffer: Float32Array): Buffer {
  const header = Buffer.alloc(HEADER_BYTES)
  header.writeUInt32LE(PTF_MAGIC, 0)
  header.writeUInt16LE(width, 4)
  header.writeUInt16LE(height, 6)
  header.writeUInt32LE(spp, 8)
  header.writeUInt32LE(0, 12)
  return Buffer.concat([header, Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength)])
}

export function decodePtf(data: Buffer): { width: number; height: number; spp: number; buffer: Float32Array } {
  if (data.length < HEADER_BYTES || data.readUInt32LE(0) !== PTF_MAGIC) {
    throw new Error('PTF1 文件头魔数不匹配')
  }
  const width = data.readUInt16LE(4)
  const height = data.readUInt16LE(6)
  const spp = data.readUInt32LE(8)
  const expected = HEADER_BYTES + width * height * 4 * 4
  if (data.length !== expected) throw new Error(`PTF1 尺寸不符：期望 ${expected}，实际 ${data.length}`)
  const buffer = new Float32Array(width * height * 4)
  buffer.set(new Float32Array(data.buffer, data.byteOffset + HEADER_BYTES, width * height * 4))
  return { width, height, spp, buffer }
}
