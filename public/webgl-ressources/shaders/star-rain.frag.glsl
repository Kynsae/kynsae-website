precision mediump float;
varying float vOp;
varying vec3 vCol;

void main() {
  gl_FragColor = vec4(vCol, vOp);
}
