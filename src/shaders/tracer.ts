import { COMMON_GLSL } from './chunks/common.js'
import { RNG_GLSL } from './chunks/rng.js'
import { SCENE_GLSL } from './chunks/scene.js'
import { INTERSECT_GLSL } from './chunks/intersect.js'
import { CAMERA_GLSL } from './chunks/camera.js'
import { MATERIALS_GLSL } from './chunks/materials.js'

const TRACER_MAIN = /* glsl */ `
uniform uint u_configHash;
uniform uint u_frameIndex;
uniform uint u_sampleBase;
uniform float u_shutterStart;
uniform float u_shutterSpan;
uniform sampler2D u_accumTex;

out vec4 outColor;

void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy);
  uint pixelIndex = uint(ip.y) * uint(u_resolution.x) + uint(ip.x);
  vec3 accum = texelFetch(u_accumTex, ip, 0).rgb;

  for (uint s = 0u; s < uint(SPP_PER_PASS); s++) {
    uint globalSample = u_sampleBase + s;
    uint seed = makeSeed(pixelIndex, u_frameIndex, globalSample, u_configHash);
    uvec2 si = pcgInit(seed, u_frameIndex * 7919u + 17u);

    vec2 jitter = vec2(randFloat(si), randFloat(si));
    vec2 uv = (vec2(ip) + jitter) / u_resolution;
    float shutterTime = u_shutterStart + randFloat(si) * u_shutterSpan;
    Ray ray = cameraRayAt(uv, shutterTime);

    vec3 throughput = vec3(1.0);
    vec3 radiance = vec3(0.0);

    for (int depth = 0; depth < MAX_DEPTH; depth++) {
      HitRecord rec = traceScene(ray, shutterTime);
      if (!rec.hit) {
        radiance += throughput * skyColor(normalize(ray.dir));
        break;
      }

      int kind = int(u_primB[rec.primIndex].w + 0.5);
      vec3 nextDir;
      vec3 attenuation;
      bool scattered = false;
      if (kind == 0) {
        scattered = scatterLambertian(rec, si, nextDir, attenuation);
      } else if (kind == 1) {
        scattered = scatterMetal(rec, ray, si, nextDir, attenuation);
      } else {
        scattered = scatterDielectric(rec, ray, si, nextDir, attenuation);
      }
      if (!scattered) break;

      // 射线穿出玻璃体积时施加 Beer-Lambert 吸收
      if (kind == 2 && !rec.frontFace) {
        vec3 att = u_primD[rec.primIndex].xyz;
        vec3 absorb = -log(clamp(att, 1e-4, 1.0)) * rec.t;
        attenuation *= exp(-absorb);
      }

      throughput *= attenuation;
      ray = Ray(rec.point + rec.normal * EPS, nextDir);

      if (depth >= RR_START_DEPTH) {
        if (randFloat(si) > RR_SURVIVAL) break;
        throughput /= RR_SURVIVAL;
      }
    }

    accum += radiance;
  }

  outColor = vec4(accum, 1.0);
}
`

export function buildTracerSource(defines: Record<string, number>): string {
  const defineLines = Object.entries(defines)
    .map(([k, v]) => `#define ${k} ${v}`)
    .join('\n')
  return [
    '#version 300 es',
    defineLines,
    'precision highp float;',
    'precision highp int;',
    COMMON_GLSL,
    RNG_GLSL,
    SCENE_GLSL,
    INTERSECT_GLSL,
    CAMERA_GLSL,
    MATERIALS_GLSL,
    TRACER_MAIN,
  ].join('\n')
}
