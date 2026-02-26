import * as THREE from 'three';

export interface GridItem {
    mesh: THREE.Mesh;
    mat: THREE.ShaderMaterial;
    baseSize: THREE.Vector2;   // world units
    baseCenter: THREE.Vector2; // world units
    geoScale: number;
    anchorDir: number;
    hoverValue: number;
    uvZoom: number;
    hoverUv: THREE.Vector2 | null;
    uvTilt: THREE.Vector2;     // radians per axis
}