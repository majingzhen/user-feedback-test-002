// std140：每物体固定 8 个 vec4（128 字节），场景上传侧见 gl/scene_upload.ts
export const SCENE_GLSL = /* glsl */ `
layout(std140) uniform SceneBlock {
  vec4 u_primA[MAX_PRIMITIVES]; // xyz center(基准), w radius
  vec4 u_primB[MAX_PRIMITIVES]; // xyz albedo, w kind (0 lambert/1 metal/2 dielectric)
  vec4 u_primC[MAX_PRIMITIVES]; // x roughness, y ior, z motionKind, w shape(0 sphere/1 plane)
  vec4 u_primD[MAX_PRIMITIVES]; // xyz attenuation
  vec4 u_primE[MAX_PRIMITIVES]; // linear: xyz velocity
  vec4 u_primF[MAX_PRIMITIVES]; // orbit: x radius, y omega, z phase, w baseY
  vec4 u_skyA;                  // xyz zenith, w intensity
  vec4 u_skyB;                  // xyz horizon, w lobePower
  vec4 u_skyC;                  // xyz lobeDirection, w lobeIntensity
};

vec3 sampleCenter(int i, float time) {
  vec3 base = u_primA[i].xyz;
  float mk = u_primC[i].z;
  if (mk < 0.5) return base;
  if (mk < 1.5) return base + u_primE[i].xyz * time;
  float angle = u_primF[i].y * time + u_primF[i].z;
  return vec3(
    base.x + u_primF[i].x * cos(angle),
    u_primF[i].w,
    base.z + u_primF[i].x * sin(angle)
  );
}

vec3 skyColor(vec3 dir) {
  float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 grad = mix(u_skyB.xyz, u_skyA.xyz, h);
  float lobe = pow(max(dot(dir, normalize(u_skyC.xyz)), 0.0), u_skyB.w);
  return (grad + lobe * u_skyC.w) * u_skyA.w;
}
`
