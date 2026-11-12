export const CAMERA_GLSL = /* glsl */ `
uniform vec3 u_lookAt;
uniform float u_orbitRadius;
uniform float u_orbitHeight;
uniform float u_duration;
uniform float u_fovTanHalf;
uniform vec2 u_resolution;

vec3 orbitOrigin(float time) {
  float theta = 2.0 * PI * time / u_duration;
  return vec3(u_orbitRadius * cos(theta), u_orbitHeight, u_orbitRadius * sin(theta));
}

Ray cameraRayAt(vec2 uv, float time) {
  vec3 origin = orbitOrigin(time);
  vec3 forward = normalize(u_lookAt - origin);
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, forward);
  vec2 film = (uv - 0.5) * 2.0;
  film.x *= u_resolution.x / u_resolution.y;
  vec3 dir = normalize(
    forward + right * (film.x * u_fovTanHalf) + up * (film.y * u_fovTanHalf)
  );
  return Ray(origin, dir);
}
`
