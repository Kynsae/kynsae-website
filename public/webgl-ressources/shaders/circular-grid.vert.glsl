precision mediump float;

attribute vec2 aUnit;
attribute float aRadius, aAlpha, aSpeed;

varying mediump float vAlpha, vFadeIn;

uniform float uSize, uProgress, uRotationProgress, uIdleRotation, uFadeIn;
uniform float uMinRadius, uRadiusSpan;

const float TAU       = 6.283185307179586;
const float TURNS     = 0.2;
const float FADE_SOFT = 0.2000;
const float SCALE_AMT = 0.3200;
const float SCALE_FROM = 0.8000;
const float WAVE_SOFT = 0.5000;

void main() {
  float rp = clamp((aRadius - uMinRadius) / max(uRadiusSpan, 0.0001), 0.0, 1.0);
  float fade = smoothstep(0.0, FADE_SOFT, uProgress - rp);
  float ringFadeIn = smoothstep(0.0, WAVE_SOFT, uFadeIn - rp * (1.0 - WAVE_SOFT));

  // Discard invisible points before expensive sin/cos + matrix math
  float visAlpha = aAlpha * (1.0 - fade) * ringFadeIn;
  if (visAlpha < 0.002) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
    vFadeIn = 0.0;
    return;
  }

  float angle = TAU * (TURNS * uRotationProgress + uIdleRotation) * aSpeed;
  float c = cos(angle), s = sin(angle);
  float fiScale = SCALE_FROM + (1.0 - SCALE_FROM) * ringFadeIn;
  float sR = aRadius * fiScale * (1.0 + uProgress * SCALE_AMT * (rp * 5.0 - 1.0));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(
    (aUnit.x * c - aUnit.y * s) * sR,
    (aUnit.x * s + aUnit.y * c) * sR,
    0.0, 1.0
  );
  gl_PointSize = uSize;
  vAlpha = aAlpha * (1.0 - fade);
  vFadeIn = ringFadeIn;
}
