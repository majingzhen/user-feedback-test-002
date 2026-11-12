export const DISPLAY_GLSL = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D u_accumTex;
uniform float u_spp;
uniform float u_exposure;
uniform vec2 u_resolution;

out vec4 outColor;

// 扩展 Reinhard（带白场），中调对比扎实，避免整体发灰
vec3 tonemap(vec3 x) {
  const float white = 1.8;
  vec3 num = x * (1.0 + x / (white * white));
  return num / (1.0 + x);
}

// 确定性哈希抖动，缓解 8-bit banding
float dither(ivec2 p) {
  uint h = uint(p.x) * 374761393u + uint(p.y) * 668265263u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  return float(h & 255u) / 255.0 - 0.5;
}

void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy);
  vec3 linear = texelFetch(u_accumTex, ip, 0).rgb / max(u_spp, 1.0);
  // canvas 挂载 SRGB8 绘制缓冲，输出线性值由浏览器精确转 sRGB
  vec3 mapped = tonemap(linear * u_exposure);
  mapped += dither(ip) / 255.0;
  outColor = vec4(clamp(mapped, 0.0, 1.0), 1.0);
}
`

const QUAD_VERT = /* glsl */ `#version 300 es
precision highp float;
const vec2 POSITIONS[3] = vec2[3](
  vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0)
);
void main() {
  gl_Position = vec4(POSITIONS[gl_VertexID], 0.0, 1.0);
}
`

export function buildDisplaySource(): string {
  return DISPLAY_GLSL
}

export function buildQuadVertexSource(): string {
  return QUAD_VERT
}
