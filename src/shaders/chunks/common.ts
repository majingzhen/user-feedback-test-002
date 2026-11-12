export const COMMON_GLSL = /* glsl */ `
#define PI 3.141592653589793
#define INF 1e9
#define EPS 1e-4

struct Ray {
  vec3 origin;
  vec3 dir;
};

struct HitRecord {
  bool hit;
  float t;
  vec3 point;
  vec3 normal;
  bool frontFace;
  int primIndex;
};
`
