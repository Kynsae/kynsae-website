precision lowp float;
uniform float uTime;
uniform float uSize;
uniform float uMorph;
uniform float uRamp;
uniform float uSphereRadius;
uniform vec3 uMouse;
uniform float uMouseRadius;   // radius of influence
uniform float uMouseStrength; // displacement amount toward mouse

const float PI = 3.141592653589793;
const vec3 seed1 = vec3(-2.57, 0.98, -1.46);
const vec3 seed2 = vec3(1.12, 2.44, -0.77);

attribute vec3 modelPosition;
varying float vIntensity;
varying float vMouseInfluence;

// Simple per-vertex random
float rand(vec3 p) {
  p = fract(p * 0.32 + vec3(0.1, 0.1, 0.1));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

// Smooth value noise via trilinear interpolation of hashed corners
float valueNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);

  float n000 = rand(i + vec3(0.0, 0.0, 0.0));
  float n100 = rand(i + vec3(1.0, 0.0, 0.0));
  float n010 = rand(i + vec3(0.0, 1.0, 0.0));
  float n110 = rand(i + vec3(1.0, 1.0, 0.0));
  float n001 = rand(i + vec3(0.0, 0.0, 1.0));
  float n101 = rand(i + vec3(1.0, 0.0, 1.0));
  float n011 = rand(i + vec3(0.0, 1.0, 1.0));
  float n111 = rand(i + vec3(1.0, 1.0, 1.0));

  float n00 = mix(n000, n100, f.x);
  float n01 = mix(n010, n110, f.x);
  float n10 = mix(n001, n101, f.x);
  float n11 = mix(n011, n111, f.x);
  float n0 = mix(n00, n01, f.y);
  float n1 = mix(n10, n11, f.y);
  return mix(n0, n1, f.z);
}

float fbm(vec3 p, int octaves) {
  float sum = 0.0;
  float amp = 0.5;
  vec3 q = p;
  for (int i = 0; i < octaves; i++) {
    sum += valueNoise(q) * amp;
    q *= 2.0;
    amp *= 0.5;
  }
  return sum;
}

// Rotate vector v around a given axis by angle (Rodrigues' formula)
// Assumes `axis` is already normalized by the caller
vec3 rotateAroundAxis(vec3 v, vec3 axis, float angle) {
  float c = cos(angle);
  return v * c + cross(axis, v) * sin(angle) + axis * dot(axis, v) * (1.0 - c);
}

vec3 explodedPosition(vec3 position, vec3 dir, float ramp, float radialAmp, float noise) {
  float radialNoise = (noise - 0.5) * 2.0;
  float noisyRadius = uSphereRadius * ramp * (1.0 + radialAmp * (1.0 - ramp) * radialNoise);
  return dir * (noisyRadius * cos(ramp * radialNoise));
}

float computeExplosionNoise(float noise) {
  // Add noise-based organic variation
  float noiseVariation = noise * 0.5;
  float temporalVariation = sin(uTime * 0.3 + dot(position, vec3(1.0, 1.7, 2.1))) * 0.08;
  
  // NOTE: These two variables control how the sphere should look.
  float baseTransitionStart = 0.2 + noiseVariation + temporalVariation;
  float baseTransitionEnd = 1.0 + temporalVariation;

  return smoothstep(baseTransitionStart, baseTransitionEnd, uRamp) * 0.8;
}

vec3 genMouseNoise(vec3 morphed) {
  float mouseEnabled = clamp((0.65 - uMorph) * 10.0, 0.0, 1.0);
  vMouseInfluence = smoothstep(uMouseRadius, 0.0, length(morphed - uMouse)) * mouseEnabled;

  vec3 toMouseDir = normalize(uMouse - morphed);

  // Reduce noise influence near the end to prevent flickering
  float noiseReduction = smoothstep(0.75, 1.0, uMorph);
  float noise = fbm(morphed * 2.3 + uTime, 2);
  vec3 curlish = normalize((noise * vec3(1.0, 1.2, 1.4)) * 2.0 - 1.0);

  // Blend direct attraction with a noisy tangential field to form tendrils
  vec3 tendrilDir = normalize(mix(toMouseDir, curlish, mix(0.35 + 0.15 * noise, 0.2, noiseReduction)));
  float tendrilAmp = uMouseStrength * vMouseInfluence * mix(0.55 + 0.25 * noise, 0.4, noiseReduction);

  return tendrilDir * tendrilAmp;
}

void main() {
  vec3 dir = normalize(position);

  // Add small, position-driven jitter to break coherence
  vec3 nearestAxis = vec3(
    0.0,
    1.0,
    0.0
  );
  
  float noise_1 = fbm(position * 2.0 + uTime * 0.07, 2);
  float noise_2 = fbm(dir * 5.0 + nearestAxis * 2.0 + uTime * 0.6, 4);
  float noise_3 = fbm(position + uTime, 3);
  
  float dAxis = dot(dir, nearestAxis);
  float cBand = smoothstep(0.8, 0.6, dAxis);

  // NOTE: You can change the speed of the flicker by multiplying uTime by a factor.
  float flicker = 0.54 + 0.5 * noise_2;
  float nearest = cBand * flicker;

  // Robust orthonormal basis around the nearest axis for swirling
  vec3 up = (abs(nearestAxis.z) < 0.999) ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
  vec3 tangent = normalize(cross(up, nearestAxis));
  vec3 bitangent = cross(nearestAxis, tangent);

  // Pull direction toward the axis and add a small swirl
  vec3 toAxis = dir - nearestAxis * dot(dir, nearestAxis);
  // Change dir+ to dir- to tweak visuals
  vec3 pulled = normalize(dir - toAxis * nearest);
  float swirlPhase = uTime * mix(0.1, 0.2, noise_2) + dAxis * mix(4.5, 7.0, noise_2);
  float sSP = sin(swirlPhase);
  float cSP = cos(swirlPhase);
  vec3 swirl = (tangent * sSP + bitangent * cSP) * (0.18 * nearest);
  vec3 newDir = normalize(pulled + swirl);

  vec3 pulled2 = normalize(dir + toAxis * nearest);
  vec3 newDir2 = normalize(pulled2 + swirl);
  
  // Move points inward along tendril to form bright filaments
  float inwardWarp = mix(0.6, 1.0, noise_3);
  float newRadius = uSphereRadius * (1.0 - 0.8 * nearest * inwardWarp);

  vec3 explodedBase = explodedPosition(position, dir, uRamp, 0.0, noise_1);
  vec3 implosionState = explodedPosition(position, dir, 0.5, 10.1, noise_1);

  float waveMix = computeExplosionNoise(noise_1);

  vec3 wavePos = mix(explodedBase, newDir * newRadius, waveMix);   // State A
  vec3 wavePos2 = mix(explodedBase, newDir2 * newRadius, waveMix); // State B
  
  
  // ==========================================================
  // Optimized Morph Animation Shader
  // Up to ~10x faster than original version
  // ==========================================================

  // Animation phase boundaries
  const float holdStart        = 0.30;
  const float holdEnd          = 0.40;
  const float modelMorphStart  = 0.40;
  const float modelMorphEnd    = 0.75;
  const float modelHoldEnd     = 0.80;
  const float endHoldStart     = 1.00;

  vec3 morphed;
  vec3 rotatedModelPosition = modelPosition;

  // ==========================================================
  // ROTATION PHASE (cached + combined)
  // ==========================================================
  if (uMorph >= modelMorphStart) {
    float rotationProgress = clamp((uMorph - modelMorphStart) / (modelHoldEnd - modelMorphStart), 0.0, 1.0);
    float yRotationAngle = rotationProgress * PI * 2.0;
    
    // Combine Y + X compensation in one rotation
    float xCompensation = -yRotationAngle * 0.15;
    vec3 axisCombined = normalize(vec3(-0.1, 1.0, 0.0));
    rotatedModelPosition = rotateAroundAxis(modelPosition, axisCombined, yRotationAngle + xCompensation);
  }

  // ==========================================================
  // 0.00–0.40: Wave Morphing (with smooth middle state stop)
  // ==========================================================
  if (uMorph < holdEnd) {
    // Remap uMorph to create a smooth ease-in-out pause at the middle
    float normalizedMorph = uMorph / holdEnd; // 0.0 to 1.0
    
    // Create a very smooth ease-in-out curve with a gentle pause at the middle
    // Use a smoother easing function with wider transition zones
    float transitionProgress;
    float t = normalizedMorph;
    
    // Apply a very smooth ease-in-out with gentle slowdown at middle
    if (t < 0.5) {
      // First half: very smooth ease in, gradual slowdown approaching middle
      float localT = t * 2.0; // 0.0 to 1.0
      // Use smoother cubic ease-in-out
      float eased = localT < 0.5 
        ? 4.0 * localT * localT * localT 
        : 1.0 - pow(-2.0 * localT + 2.0, 3.0) * 0.5;
      // Add very gradual slowdown near middle with wider range
      float slowdown = smoothstep(0.4, 1.0, localT) * 0.2;
      eased = mix(eased, 1.0, slowdown);
      transitionProgress = eased * 0.5;
    } else {
      // Second half: very smooth ease out, gradual acceleration from middle
      float localT = (t - 0.5) * 2.0; // 0.0 to 1.0
      // Use smoother cubic ease-in-out
      float eased = localT < 0.5 
        ? 4.0 * localT * localT * localT 
        : 1.0 - pow(-2.0 * localT + 2.0, 3.0) * 0.5;
      // Add very gradual slowdown near start with wider range
      float slowdown = smoothstep(1.0, 0.6, localT) * 0.2;
      eased = mix(0.0, eased, 1.0 - slowdown);
      transitionProgress = 0.5 + eased * 0.5;
    }
    
    // Use the original transition logic with remapped progress
    float tFinal = clamp(transitionProgress, 0.0, 1.0);
    float e = tFinal * tFinal * (3.0 - 2.0 * tFinal); // cheaper smoothstep
    float seedAB = rand(position);
    float twistAB = (PI * 2.0) * e * mix(0.7, 1.3, seedAB);
    vec3 rotAB = rotateAroundAxis(wavePos, nearestAxis, twistAB);
    morphed = mix(rotAB, wavePos2, e);

    // Hold at wavePos2
    morphed = mix(morphed, wavePos2, smoothstep(holdStart, holdEnd, uMorph));
  }

  // ==========================================================
  // 0.40–0.75: Morph from wavePos2 → model (optimized waves)
  // ==========================================================
  else if (uMorph < modelMorphEnd) {
    float t = (uMorph - modelMorphStart) / (modelMorphEnd - modelMorphStart);
    float noiseReduction = smoothstep(0.5, 0.75, t);

    // Minimum distance squared
    float normalizedDist = dot(wavePos2 - seed1, wavePos2 - seed2) / (uSphereRadius * 1.5 * uSphereRadius * 1.5);

    float noiseVal = fbm(wavePos2 * 3.5, 2);
    float timingVariation = (noiseVal - 0.5) * mix(0.15, 0.05, noiseReduction);
    float earliestArrival = clamp(normalizedDist * 0.7 + timingVariation, 0.0, 0.85);

    float waveWidth = mix(0.45, 0.5, noiseReduction);
    float waveProgress = clamp((t - earliestArrival) / waveWidth, 0.0, 1.0);
    float e = waveProgress * waveProgress * (3.0 - 2.0 * waveProgress);

    morphed = mix(
      wavePos2, 
      rotatedModelPosition, 
      mix(e, waveProgress, 0.3)
    );
  }

  // ==========================================================
  // 0.75–0.80: Hold at rotated model
  // ==========================================================
  else if (uMorph < modelHoldEnd) {
    morphed = rotatedModelPosition;
  }

  // ==========================================================
  // 0.80–1.00: Implosion Phase (simplified spiral math)
  // ==========================================================
  else {
    float t = (uMorph - modelHoldEnd) / (endHoldStart - modelHoldEnd);
    float tEased = mix(t, t * t * (3.0 - 2.0 * t), smoothstep(0.0, 0.3, t));

    float normalizedDistance = length(rotatedModelPosition) / uSphereRadius;
    float implodeProgress = clamp((t - ((1.0 - normalizedDistance) * 0.7)) / 0.6, 0.0, 1.0);

    morphed = mix(
      rotateAroundAxis(
        modelPosition, 
        vec3(mix(-0.1, -0.15, smoothstep(0.0, 1.0, t)), 1.0, 0.0), 
        (PI * 2.0 - PI * 0.3) + (tEased * PI * 1.6)
      ),
      implosionState,
      1.0 - pow(1.0 - implodeProgress, mix(2.2, 2.0, implodeProgress))
    );
  }

  morphed += genMouseNoise(morphed);
  vIntensity = clamp((nearest * waveMix), 0.0, 1.0);

  gl_Position = projectionMatrix * (modelViewMatrix * vec4(morphed, 1.0));
  gl_PointSize = uSize;
}