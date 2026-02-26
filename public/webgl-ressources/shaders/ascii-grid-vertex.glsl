precision lowp float;

attribute float charData;

varying float vIsActive;
varying float vRandomDotOpacity;
varying vec2  vUv;

uniform float uDotSize;
uniform float uSpacing;
uniform float uDistortionAmount;
uniform float uVerticalOffset;
uniform float uVerticalOffsetScale;
uniform vec2  uMouseParallax;

float rand(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453);
}

void main() {
  vUv = uv;
  vIsActive = charData;

  vec2 cell = floor(uv * 150.0);
  float r0 = rand(cell);
  float r1 = rand(cell + 42.17);
  float r2 = rand(cell + 73.91);

  float isRandom = step(0.99, r0) * step(vIsActive, 0.1);

  vRandomDotOpacity = isRandom * (0.01 + r1 * 0.5);

  float inactiveSpeed = isRandom * (0.1 + r2 * 0.5);
  float randomSize    = 0.4 + r2 * 1.2;

  vec2 toCenter = uv - 0.5;
  float dist    = length(toCenter);

  float scale = mix(0.3, 1.9, vIsActive);
  scale = mix(scale, randomSize, isRandom);
  scale *= max(0.5, 1.0 - dist * 2.0) * uDotSize;

  vec3 pos = position;
  float move = max(vIsActive * vIsActive, inactiveSpeed);

  pos.xy -= toCenter * vIsActive * 0.1 * uSpacing;
  pos.y  += uVerticalOffset * uVerticalOffsetScale * move;
  pos.xy += uMouseParallax * move;

  float d = dot(pos.xy, pos.xy);
  pos.xy *= 1.0 + d * uDistortionAmount;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = scale;
}