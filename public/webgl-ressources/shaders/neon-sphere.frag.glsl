uniform vec3 uColor;
varying float vAlpha;

#include <clipping_planes_pars_fragment>

void main(){
  // Gaussian-like soft falloff for less crispy points.
  vec2 p=gl_PointCoord*2.0-1.0;
  float r2=dot(p,p);
  float edge=exp(-2.2*r2);
  float alpha=vAlpha*edge;
  if(alpha<=0.0005) discard;
  gl_FragColor=vec4(uColor,alpha);
  #include <clipping_planes_fragment>
}