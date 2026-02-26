precision lowp float;

varying float vIsActive;
varying float vRandomDotOpacity;

uniform float uFadeout;

void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = dot(p, p);

  float mask = 1.0 - smoothstep(0.04, 0.36, d);

  float alpha = max(vIsActive, vRandomDotOpacity) * mask * uFadeout;

  if (alpha < 0.01) discard;

  gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
}