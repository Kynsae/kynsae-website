precision lowp float;
varying vec2 vUv;
uniform float uTilt, uLeftWeight;

void main() {
  vUv = uv;
  vec3 p = position;
  float w = mix(uv.x, 1.0 - uv.x, clamp(uLeftWeight, 0.0, 1.0));
  p.y += uTilt * w;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
}