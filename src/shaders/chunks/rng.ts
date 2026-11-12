// 与 src/core/math/rng.ts、rng/rng_seed.ts 逐位对齐
export const RNG_GLSL = /* glsl */ `
uvec2 pcgInit(uint seed, uint seq) {
  uint inc = (seq * 2u) | 1u;
  uint state = 0u;
  uint old = state;
  state = old * 747796405u + inc;
  state = state + seed;
  old = state;
  state = old * 747796405u + inc;
  return uvec2(state, inc);
}

uint pcgNext(inout uvec2 si) {
  uint old = si.x;
  si.x = old * 747796405u + si.y;
  uint xorshifted = ((old >> 18u) ^ old) >> 27u;
  uint rot = old >> 29u;
  uint shift = (32u - rot) & 31u;
  return (xorshifted >> rot) | (xorshifted << shift);
}

float randFloat(inout uvec2 si) {
  return float(pcgNext(si) >> 8u) / 16777216.0;
}

uint mix32(uint h) {
  h = (h ^ (h >> 16u)) * 0x7feb352du;
  h = (h ^ (h >> 15u)) * 0x846ca68bu;
  return h ^ (h >> 16u);
}

uint makeSeed(uint pixelIndex, uint frameIndex, uint sampleIndex, uint configHash) {
  uint h = mix32(pixelIndex);
  h = mix32(h ^ frameIndex);
  h = mix32(h ^ sampleIndex);
  h = mix32(h ^ configHash);
  return h;
}

vec3 randUnitVector(inout uvec2 si) {
  float z = randFloat(si) * 2.0 - 1.0;
  float a = randFloat(si) * 2.0 * PI;
  float r = sqrt(max(0.0, 1.0 - z * z));
  return vec3(r * cos(a), z, r * sin(a));
}

vec3 randomInUnitSphere(inout uvec2 si) {
  for (int i = 0; i < 8; i++) {
    vec3 v = vec3(randFloat(si), randFloat(si), randFloat(si)) * 2.0 - 1.0;
    if (dot(v, v) < 1.0) return v;
  }
  return randUnitVector(si);
}

// 余弦加权半球采样，法线定向
vec3 cosineHemisphere(inout uvec2 si, vec3 normal) {
  vec3 r = randUnitVector(si);
  vec3 w = normal;
  vec3 u = normalize(cross(abs(w.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), w));
  vec3 v = cross(w, u);
  return normalize(u * r.x + v * r.y + w * abs(r.z));
}
`
