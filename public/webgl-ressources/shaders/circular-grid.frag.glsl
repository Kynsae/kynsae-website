precision mediump float;

varying mediump float vAlpha, vFadeIn;

uniform float uProgress;

const float FADE_START = 0.4000;
const float FADE_END   = 0.7000;

void main() {
  vec2 co = gl_PointCoord - vec2(0.5);
  float gauss = exp(-dot(co, co) * 18.0);
  float gVis = 1.0 - smoothstep(FADE_START, FADE_END, uProgress);
  gl_FragColor = vec4(0.8, 0.8, 1.0, vAlpha * gVis * gauss * vFadeIn);
}
