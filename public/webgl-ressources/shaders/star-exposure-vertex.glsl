precision mediump float;
#define TWO_PI 6.28318530718
#define PI 3.14159265359

uniform float uSize, uRadius, uRandomness, uRandomnessPower, uFlatness;
uniform float uTrailLength, uThickness, uSegmentsPerStar;
uniform vec3 uColor0, uColor1, uColor2, uColor3, uColor4;
uniform int uColorCount;

attribute float aIndex, aStarIndex, aSide;
varying vec3 vColor;
varying float vAlpha;

float hash(float n) { return fract(sin(n) * 43758.5453123); }

float random(float index, float offset) {
  float s1 = index * 0.0001 + offset * 0.00001;
  float s2 = index * 0.00007 + offset * 0.00003;
  return fract(hash(s1 * 12.9898) + hash(s2 * 78.233) * 0.5 + hash((s1 + s2) * 43.758) * 0.25);
}

void main() {
  float r1 = random(aIndex, 0.0), r2 = random(aIndex, 1.0), r3 = random(aIndex, 2.0), r4 = random(aIndex, 3.0);
  float r5 = random(aIndex, 4.0), r6 = random(aIndex, 5.0), r7 = random(aIndex, 6.0);

  float baseAngle = r1 * TWO_PI;
  float baseR = sqrt(r2) * uRadius;
  float cosBA = cos(baseAngle);
  float sinBA = sin(baseAngle);
  float rf = (step(0.5, r6) * 2.0 - 1.0) * uRandomness * baseR;
  float p3 = pow(r3, uRandomnessPower);
  float p4 = pow(r4, uRandomnessPower);
  float p5 = pow(r5, uRandomnessPower);
  vec3 basePos = vec3(cosBA * baseR + p3, p4 * rf * uFlatness, sinBA * baseR + p5 * rf);

  if (abs(aSide) < 0.5) {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(basePos, 1.0);
  } else {
    float arcRadius = length(basePos.xz);
    float arcAngle = atan(basePos.z, basePos.x) - (aStarIndex * uTrailLength) * PI;
    float cosArc = cos(arcAngle);
    float sinArc = sin(arcAngle);
    vec3 centerPos = vec3(cosArc * arcRadius, basePos.y, sinArc * arcRadius);
    vec4 viewPos = modelViewMatrix * vec4(centerPos, 1.0);
    float screenSpaceScale = max(-viewPos.z, 0.001) / uRadius;
    vec3 pos = centerPos + vec3(cosArc, 0.0, sinArc) * uThickness * aSide * screenSpaceScale;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }

  int cidx = int(floor(r7 * float(uColorCount)));
  vColor = cidx == 0 ? uColor0 : cidx == 1 ? uColor1 : cidx == 2 ? uColor2 : cidx == 3 ? uColor3 : uColor4;
  vAlpha = 1.0;
  gl_PointSize = uSize;
}