export const INTERSECT_GLSL = /* glsl */ `
bool hitSphere(Ray ray, vec3 center, float radius, inout float tMax, out vec3 outwardNormal) {
  vec3 oc = ray.origin - center;
  float halfB = dot(oc, ray.dir);
  float c = dot(oc, oc) - radius * radius;
  float disc = halfB * halfB - c;
  if (disc < 0.0) return false;
  float sq = sqrt(disc);
  float root = -halfB - sq;
  if (root < EPS || root > tMax) root = -halfB + sq;
  if (root < EPS || root > tMax) return false;
  tMax = root;
  outwardNormal = (ray.origin + ray.dir * root - center) / radius;
  return true;
}

// 无限 y 平面，平面点在 u_primA[i].xyz
bool hitPlane(Ray ray, float pointY, inout float tMax, out vec3 outwardNormal) {
  if (abs(ray.dir.y) < 1e-8) return false;
  float root = (pointY - ray.origin.y) / ray.dir.y;
  if (root < EPS || root > tMax) return false;
  tMax = root;
  outwardNormal = vec3(0.0, 1.0, 0.0);
  return true;
}

HitRecord traceScene(Ray ray, float time) {
  HitRecord rec;
  rec.hit = false;
  rec.t = INF;
  float tMax = INF;
  vec3 outwardNormal = vec3(0.0);
  for (int i = 0; i < MAX_PRIMITIVES; i++) {
    vec3 center = sampleCenter(i, time);
    vec3 nrm;
    bool hit = false;
    if (u_primC[i].w < 0.5) {
      hit = hitSphere(ray, center, u_primA[i].w, tMax, nrm);
    } else {
      hit = hitPlane(ray, center.y, tMax, nrm);
    }
    if (hit) {
      rec.hit = true;
      rec.t = tMax;
      outwardNormal = nrm;
      rec.primIndex = i;
    }
  }
  if (rec.hit) {
    rec.point = ray.origin + ray.dir * rec.t;
    rec.frontFace = dot(ray.dir, outwardNormal) < 0.0;
    rec.normal = rec.frontFace ? outwardNormal : -outwardNormal;
  }
  return rec;
}

// 地面极弱棋盘，让运动模糊方向性可读
vec3 surfaceAlbedo(int i, vec3 point) {
  vec3 albedo = u_primB[i].xyz;
  if (u_primC[i].w > 0.5) {
    float check = mod(floor(point.x * 0.5) + floor(point.z * 0.5), 2.0);
    vec3 tint = check < 1.0 ? vec3(0.82) : vec3(1.15);
    albedo *= tint;
  }
  return albedo;
}
`
