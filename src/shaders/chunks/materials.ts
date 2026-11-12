export const MATERIALS_GLSL = /* glsl */ `
vec3 reflectDir(vec3 v, vec3 n) {
  return v - 2.0 * dot(v, n) * n;
}

float schlickFresnel(float cosine, float ratio) {
  float r0 = (1.0 - ratio) / (1.0 + ratio);
  r0 *= r0;
  return r0 + (1.0 - r0) * pow(1.0 - cosine, 5.0);
}

bool scatterLambertian(HitRecord rec, inout uvec2 si, out vec3 dir, out vec3 attenuation) {
  dir = cosineHemisphere(si, rec.normal);
  attenuation = surfaceAlbedo(rec.primIndex, rec.point);
  return true;
}

bool scatterMetal(HitRecord rec, Ray ray, inout uvec2 si, out vec3 dir, out vec3 attenuation) {
  int i = rec.primIndex;
  vec3 albedo = u_primB[i].xyz;
  float rough = u_primC[i].x;
  vec3 reflected = reflectDir(normalize(ray.dir), rec.normal);
  if (rough > 0.0) reflected = normalize(reflected + randomInUnitSphere(si) * rough);
  if (dot(reflected, rec.normal) <= 0.0) return false;
  float cosine = max(dot(-normalize(ray.dir), rec.normal), 0.0);
  vec3 fresnel = albedo + (1.0 - albedo) * pow(1.0 - cosine, 5.0);
  dir = reflected;
  attenuation = fresnel;
  return true;
}

bool scatterDielectric(HitRecord rec, Ray ray, inout uvec2 si, out vec3 dir, out vec3 attenuation) {
  int i = rec.primIndex;
  float ior = u_primC[i].y;
  float ratio = rec.frontFace ? 1.0 / ior : ior;
  vec3 unitDir = normalize(ray.dir);
  float cosTheta = min(dot(-unitDir, rec.normal), 1.0);
  float sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));
  bool cannotRefract = ratio * sinTheta > 1.0;
  if (cannotRefract || schlickFresnel(cosTheta, ratio) > randFloat(si)) {
    dir = reflectDir(unitDir, rec.normal);
  } else {
    vec3 perpendicular = ratio * (unitDir + cosTheta * rec.normal);
    vec3 parallel = -sqrt(abs(1.0 - dot(perpendicular, perpendicular))) * rec.normal;
    dir = normalize(perpendicular + parallel);
  }
  // Beer-Lambert 吸收在出体积时于主循环处理，散射本身不衰减
  attenuation = vec3(1.0);
  return true;
}
`
