precision lowp float;
varying vec2 vUv;
uniform sampler2D uMap;
uniform float uCornerRadius, uUvZoom;
uniform vec2 uUvTilt;
uniform vec2 uSizeWorld;
uniform float uHover;
uniform float uMapAspect; // texture width / height

vec3 lin2srgb(vec3 v) {
  return mix(v * 12.92, 1.055 * exp(vec3(1.0 / 2.4) * log(v)) - 0.055, step(vec3(0.0031308), v));
}

float rBoxSDF(vec2 p, vec2 b, float r) {
  p = abs(p) - b + r;
  float qx = max(p.x, 0.0);
  float qy = max(p.y, 0.0);
  return sqrt(qx*qx + qy*qy) + min(max(p.x, p.y), 0.0) - r;
}

void main() {
  // 1. UV and position setup
  vec2 centeredUv = vUv - 0.5;
  float rW = clamp(uCornerRadius, 0.0, 0.5) * min(uSizeWorld.x, uSizeWorld.y);

  // 2. Rounded box SDF + AA mask
  float sdf = rBoxSDF(centeredUv * uSizeWorld, 0.5 * uSizeWorld, rW);
  float mask = 1.0 - smoothstep(0.0, fwidth(sdf), sdf);

  // 3. Projected UV
  vec2 tilt = clamp(uUvTilt, -0.6, 0.6);
  vec2 uv = centeredUv / max(1.0 + dot(tilt * 0.7, centeredUv), 1e-3);

  // 3b. Preserve image aspect ratio with a center-crop (cover)
  float tileAspect = uSizeWorld.x / max(uSizeWorld.y, 1e-6);
  float texAspect = max(uMapAspect, 1e-6);
  vec2 coverScale = vec2(1.0);
  if (texAspect > tileAspect) {
    // Texture is wider than tile: crop horizontally (sample narrower width)
    coverScale = vec2(tileAspect / texAspect, 1.0);
  } else {
    // Texture is taller than tile: crop vertically (sample narrower height)
    coverScale = vec2(1.0, texAspect / tileAspect);
  }
  uv *= coverScale;

  uv = uv / max(uUvZoom, 1e-6) + 0.5;

  // 4. Offset computation
  float tiltLen = length(tilt);
  float tiltMag = clamp(tiltLen * 5.5555, 0.0, 1.0); // 1/0.18 ≈ 5.5555

  // Move chromatic offset along the axis opposite to the texture's 3D rotation
  vec2 dir = (tiltLen > 1e-4) ? -normalize(tilt) : -normalize(centeredUv + 1e-6);
  vec2 offset = dir * (0.002 + 0.004 * tiltMag) * clamp(uHover, 0.0, 1.0);

  // 5. RGB chromatic aberration
  vec2 uvR = clamp(uv + offset, vec2(0.0), vec2(1.0));
  vec2 uvG = clamp(uv,           vec2(0.0), vec2(1.0));
  vec2 uvB = clamp(uv - offset, vec2(0.0), vec2(1.0));

  vec4 texR = texture2D(uMap, uvR);
  vec4 texG = texture2D(uMap, uvG);
  vec4 texB = texture2D(uMap, uvB);

  vec4 col = vec4(texR.r, texG.g, texB.b, max(max(texR.a, texG.a), texB.a));
  col.a *= mask;

  // 6. Alpha test and final color
  if (col.a < 0.01) discard;
  gl_FragColor = vec4(lin2srgb(col.rgb), col.a);
}