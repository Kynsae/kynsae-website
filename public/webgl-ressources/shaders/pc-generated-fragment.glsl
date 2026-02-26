precision lowp float;
uniform float uOpacity, uMorph;
varying float vIntensity;
varying float vMouseInfluence;

// Color palette constants
const vec3 COLOR_LOW_INTENSITY_START = vec3(0.05, 0.35, 1.0);   // Bright blue
const vec3 COLOR_LOW_INTENSITY_END = vec3(0.04, 0.08, 0.45);     // Dark blue
const vec3 COLOR_HIGH_INTENSITY_START = vec3(0.8, 0.9, 1.0);    // Light blue/white
const vec3 COLOR_HIGH_INTENSITY_END = vec3(0.15, 0.25, 0.9);     // Medium blue
const vec3 COLOR_MOUSE_PURPLE = vec3(0.3, 0.4, 0.9);            // Bright purple

void main() {
  float ex = smoothstep(0.5, 0.8, uMorph);

  // Color interpolation: first by morph (ex), then by intensity
  vec3 lowIntensityColor = mix(COLOR_LOW_INTENSITY_START, COLOR_LOW_INTENSITY_END, ex);
  vec3 highIntensityColor = mix(COLOR_HIGH_INTENSITY_START, COLOR_HIGH_INTENSITY_END, ex);
  
  // Base color based on intensity
  vec3 baseColor = mix(lowIntensityColor, highIntensityColor, vIntensity);
  
  // Calculate alpha
  float alpha = uOpacity * (0.1 + 0.7 * vIntensity) * (1.0 - 0.6 * ex);
  
  // Discard fragment if alpha is too low
  if (alpha < 0.05) {
    discard;
  }
  
  gl_FragColor = vec4(
    mix(baseColor, COLOR_MOUSE_PURPLE, vMouseInfluence), 
    alpha
  );
}