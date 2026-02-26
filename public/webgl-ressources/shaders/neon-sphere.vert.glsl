uniform float uProgress,uIntroProgress,uCosRot,uSinRot,uIntroDone;
uniform float uPointSize;

attribute vec3 aSeg0; // baseY, sliceR, mid
attribute float aSeed;

varying float vAlpha;

#include <clipping_planes_pars_vertex>

const float TWO_PI=6.283185307179586;
const float PI=3.141592653589793;

// Ejection constants (previously CPU-side uniforms)
const float EJECT_DISTANCE=25.0;
const float EJECT_SPEED_MIN=1.9;
const float EJECT_SPEED_MAX=3.6;
const float MAX_SPREAD_DIST=9.0;
const float SPREAD_MIN=0.3;
const float SPREAD_MAX=1.5;
const float FADE_EXP=0.7;
const float LOCAL_EPS=0.1;

// Intro constants
const float INTRO_SCALE=0.7;
const float WAVE_AMP=0.1;
const float INTRO_STAGGER=0.3;
const float INTRO_TURNS=1.1;
const float INTRO_RAD=3.0;
const float SCENE_R=1.4;

// GPU hash – derives 3 pseudo-random floats from a single seed
vec3 hash31(float p){
  vec3 p3=fract(vec3(p)*vec3(.1031,.1030,.0973));
  p3+=dot(p3,p3.yzx+33.33);
  return fract((p3.xxy+p3.yzz)*p3.zyx);
}

vec3 randDir(float s){
  vec3 h=hash31(s)*2.0-1.0;
  return h*inversesqrt(max(1e-12,dot(h,h)));
}

float sat(float x){return clamp(x,0.0,1.0);}
float smootherstep(float t){return t*t*t*(t*(t*6.0-15.0)+10.0);}
float smoothPulse01(float t){return sin(clamp(t,0.0,1.0)*PI);}

void main(){
  float baseY=aSeg0.x, sliceR=aSeg0.y, mid=aSeg0.z;
  float cA=cos(mid), sA=sin(mid);

  // Per-point randoms (wobble directions, spread factor)
  vec3 dir1=randDir(aSeed);
  vec3 dir2=randDir(aSeed+111.0);
  float mult=mix(SPREAD_MIN,SPREAD_MAX,hash31(aSeed+222.0).x);

  // Per-segment randoms (all points in a segment share mid & baseY)
  vec3 segR=hash31(mid*159.73+baseY*237.31);
  float speedExp=mix(EJECT_SPEED_MIN,EJECT_SPEED_MAX,segR.x);
  float fadeR=mix(0.3,0.8,segR.y);

  // Ejection start threshold (deterministic per segment)
  float normY=(baseY+SCENE_R)/(2.0*SCENE_R);
  float na=mid/TWO_PI; na-=floor(na);
  float start=clamp(normY*INTRO_SCALE+sin(na*TWO_PI)*WAVE_AMP,0.0,1.0);

  float lp=clamp((uProgress-start)/(1.0-start+LOCAL_EPS),0.0,1.0);
  float eased=pow(lp,speedExp);

  float cC=cA*uCosRot+sA*uSinRot;
  float sC=sA*uCosRot-cA*uSinRot;

  float invLen=inversesqrt(sliceR*sliceR+baseY*baseY);
  vec3 dir=vec3(cC*sliceR,baseY,sC*sliceR)*invLen;

  vec3 basePos=vec3(0.0,baseY,0.0);
  vec3 eject=dir*(eased*EJECT_DISTANCE);

  float pw=sin(eased*TWO_PI+aSeed);
  vec3 comb=dir1*pw+dir2*(1.0-pw);
  vec3 nd=comb*inversesqrt(max(1e-12,dot(comb,comb)));

  vec3 p0=position+nd*(eased*MAX_SPREAD_DIST*mult);
  float sE=sin(eased),cE=cos(eased);
  vec3 rx=vec3(p0.x,cE*p0.y-sE*p0.z,sE*p0.y+cE*p0.z);

  vec3 finalPos=basePos+eject+rx;

  float local=1.0;
  vec3 introPos=finalPos;
  if(uIntroDone<0.5){
    float introOffset=clamp(INTRO_STAGGER*normY,0.0,0.88);
    float localRaw=sat((uIntroProgress-introOffset)/(1.0-introOffset));
    local=smootherstep(localRaw);
    float spiralT=1.0-local;
    float pulse=smoothPulse01(local);
    float phase=mid+spiralT*TWO_PI*INTRO_TURNS;
    float helixR=
      INTRO_RAD*
      (0.25+0.75*pulse)*
      spiralT*
      (0.75+0.25*clamp(sliceR/SCENE_R,0.0,1.0));

    vec3 spawnDir=randDir(aSeed+333.0);
    vec3 r4=hash31(aSeed+444.0);
    float spawnR=0.01+0.8*r4.x*r4.x;

    vec3 vortex=vec3(cos(phase),0.0,sin(phase))*helixR*0.3;
    introPos=mix(spawnDir*spawnR,finalPos,local)+vortex;
  }

  float np=min(1.0,lp/max(1e-4,fadeR));
  float ejectAlpha=clamp(1.0-pow(np,FADE_EXP),0.0,1.0);
  vAlpha=ejectAlpha*local;

  vec4 mvPosition=modelViewMatrix*vec4(introPos,1.0);
  gl_Position=projectionMatrix*mvPosition;
  gl_PointSize=uPointSize;

  #include <clipping_planes_vertex>
}
