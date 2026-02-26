// Must match PATH_PTS and STARS in star-rain.ts
#define PATH_PTS 15
#define PATH_PTS_M1 14
#define STARS 200

uniform float uPct;
uniform sampler2D uPath;
uniform float uTrail;

attribute float aStar;
attribute float aT;
attribute float aScale;
attribute float aBaseOp;
attribute vec3 aCol;

varying float vOp;
varying vec3 vCol;

vec4 pt(float s, int i) {
  return texture2D(uPath, vec2((float(i) + .5) / float(PATH_PTS), (s + .5) / float(STARS)));
}

vec3 samplePath(float s, float d) {
  vec4 a = pt(s, 0);
  for (int i = 1; i < PATH_PTS; i++) {
    vec4 b = pt(s, i);
    if (b.w >= d) return mix(a.xyz, b.xyz, (d - a.w) / max(b.w - a.w, 1e-4));
    a = b;
  }
  return a.xyz;
}

void main() {
  float total = pt(aStar, PATH_PTS_M1).w;
  float head = total * uPct;
  float tail = max(0.0, head - uTrail * aScale);
  vec3 p = samplePath(aStar, mix(tail, head, aT));

  float kIn = smoothstep(0.1, 0.4, uPct);
  float kOut = smoothstep(0.8, 1.0, uPct);
  vOp = kIn * (1.0 - kOut) * aBaseOp;
  vCol = aCol;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
