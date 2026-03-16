import { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Move, Maximize, X } from 'lucide-react';
import type { GearState } from '../hooks/useGearState';
import {
  loadModelFromFile,
  applyMaterialToGroup,
  ACCEPT_STRING,
} from '../lib/modelLoader';

export interface ModelInfo {
  name: string;
  format: string;
  originalMaterials: boolean;
}

interface GearSceneProps {
  gearState: GearState;
  onStatsUpdate: (stats: { vertices: number; triangles: number }) => void;
  onUpdate: (partial: Partial<GearState>) => void;
  onModelLoaded?: (info: ModelInfo | null) => void;
}

// ─── Simplified Industrial Gear Geometry ──────────────────────────────────────

/**
 * Creates a clean industrial spur gear using only CylinderGeometry and BoxGeometry.
 * Three parts: central hub cylinder, flat web disc, and trapezoidal box teeth.
 * No curves, no ExtrudeGeometry, no Shape — artifact-free.
 */
function createGearGroup(
  teethCount: number,
  color: string,
  metalness: number,
  roughness: number,
  width: number,
  height: number,
  envMap: THREE.Texture | null
): THREE.Group {
  const group = new THREE.Group();

  // Scale all radii proportionally to the width parameter (width = overall diameter)
  const scale = width / 4.0; // base design targets width=4.0 (outer tooth tip ~2.0 radius)
  const hubRadius = 0.5 * scale;
  const webOuterRadius = 1.6 * scale;
  const toothPlacementRadius = 1.8 * scale;
  const bodyHeight = 0.4 * scale;
  const toothWidth = 0.35 * scale;
  const toothDepth = 0.4 * scale;
  const toothHeight = bodyHeight; // same height as body

  // Shared material
  const matProps: THREE.MeshStandardMaterialParameters = {
    color,
    metalness,
    roughness,
    envMapIntensity: 2.0,
  };
  if (envMap) matProps.envMap = envMap;
  const sharedMat = new THREE.MeshStandardMaterial(matProps);

  // ── Hub: solid cylinder at center ──
  const hubGeo = new THREE.CylinderGeometry(hubRadius, hubRadius, bodyHeight, 48);
  const hubMesh = new THREE.Mesh(hubGeo, sharedMat);
  hubMesh.castShadow = true;
  hubMesh.receiveShadow = true;
  group.add(hubMesh);

  // ── Bore hole (dark inner cylinder to fake a through-hole) ──
  const boreRadius = hubRadius * 0.45;
  const boreGeo = new THREE.CylinderGeometry(boreRadius, boreRadius, bodyHeight + 0.02, 32);
  const boreMat = new THREE.MeshStandardMaterial({
    color: '#0a0a0a',
    metalness: 0.2,
    roughness: 0.9,
  });
  if (envMap) boreMat.envMap = envMap;
  const boreMesh = new THREE.Mesh(boreGeo, boreMat);
  group.add(boreMesh);

  // ── Web: solid disc from hub to outer ring ──
  const webGeo = new THREE.CylinderGeometry(webOuterRadius, webOuterRadius, bodyHeight, 64);
  const webMesh = new THREE.Mesh(webGeo, sharedMat);
  webMesh.castShadow = true;
  webMesh.receiveShadow = true;
  group.add(webMesh);

  // ── Teeth: box blocks arranged in a circle ──
  const toothGeo = new THREE.BoxGeometry(toothWidth, toothHeight, toothDepth);

  for (let i = 0; i < teethCount; i++) {
    const angle = (i / teethCount) * Math.PI * 2;
    const toothMesh = new THREE.Mesh(toothGeo, sharedMat);

    // Position each tooth at the placement radius
    toothMesh.position.x = Math.cos(angle) * toothPlacementRadius;
    toothMesh.position.z = Math.sin(angle) * toothPlacementRadius;
    toothMesh.position.y = 0;

    // Rotate to face outward (radially)
    toothMesh.rotation.y = -angle + Math.PI / 2;

    toothMesh.castShadow = true;
    toothMesh.receiveShadow = true;
    group.add(toothMesh);
  }

  return group;
}

// ─── Environment Map Generator ────────────────────────────────────────────────

function createWarehouseEnvMap(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#111111');

  // Warehouse ceiling lights (emissive panels)
  const panelGeo = new THREE.PlaneGeometry(6, 2);
  const panelMat = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    side: THREE.DoubleSide,
  });

  // Row of ceiling lights
  for (let i = -2; i <= 2; i++) {
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(i * 8, 12, 0);
    panel.rotation.x = Math.PI / 2;
    envScene.add(panel);

    const panel2 = panel.clone();
    panel2.position.set(i * 8, 12, 8);
    envScene.add(panel2);

    const panel3 = panel.clone();
    panel3.position.set(i * 8, 12, -8);
    envScene.add(panel3);
  }

  // Warm side walls
  const wallGeo = new THREE.PlaneGeometry(40, 14);
  const wallMatWarm = new THREE.MeshBasicMaterial({
    color: '#2a2018',
    side: THREE.DoubleSide,
  });
  const wallLeft = new THREE.Mesh(wallGeo, wallMatWarm);
  wallLeft.position.set(-20, 5, 0);
  wallLeft.rotation.y = Math.PI / 2;
  envScene.add(wallLeft);

  const wallRight = wallLeft.clone();
  wallRight.position.set(20, 5, 0);
  envScene.add(wallRight);

  // Floor (dark)
  const floorGeo = new THREE.PlaneGeometry(40, 40);
  const floorMat = new THREE.MeshBasicMaterial({ color: '#0c0c0c', side: THREE.DoubleSide });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = Math.PI / 2;
  floor.position.y = -2;
  envScene.add(floor);

  // Ambient fill
  envScene.add(new THREE.AmbientLight(0x333333, 1));

  const envMap = pmrem.fromScene(envScene, 0, 0.1, 100).texture;
  pmrem.dispose();

  // Dispose env scene geometry
  envScene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (child.material instanceof THREE.Material) child.material.dispose();
    }
  });

  return envMap;
}

// ─── Contact Shadow Plane ─────────────────────────────────────────────────────

function createContactShadowPlane(): THREE.Mesh {
  const size = 6;
  const res = 256;
  const canvas = document.createElement('canvas');
  canvas.width = res;
  canvas.height = res;
  const ctx = canvas.getContext('2d')!;

  // Radial gradient for soft shadow
  const gradient = ctx.createRadialGradient(res / 2, res / 2, 0, res / 2, res / 2, res / 2);
  gradient.addColorStop(0, 'rgba(0,0,0,0.45)');
  gradient.addColorStop(0.4, 'rgba(0,0,0,0.2)');
  gradient.addColorStop(0.7, 'rgba(0,0,0,0.05)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, res, res);

  const texture = new THREE.CanvasTexture(canvas);
  const geo = new THREE.PlaneGeometry(size, size);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity: 0.8,
  });
  const plane = new THREE.Mesh(geo, mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -0.02; // just above the grid
  return plane;
}

// ─── Outline Group ────────────────────────────────────────────────────────────

function createOutlineGroup(sourceGroup: THREE.Group): THREE.Group {
  const outline = new THREE.Group();
  outline.userData.isOutline = true;

  // Make sure world matrices are up-to-date
  sourceGroup.updateMatrixWorld(true);

  // Compute the inverse of the sourceGroup's world matrix so we can
  // express each child mesh's world transform relative to the group root.
  const groupInverse = new THREE.Matrix4().copy(sourceGroup.matrixWorld).invert();
  const relativeMatrix = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();

  const outlineMat = new THREE.MeshBasicMaterial({
    color: '#3b82f6',
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.45,
  });

  sourceGroup.traverse((child) => {
    if (child instanceof THREE.Mesh && !child.parent?.userData.isOutline) {
      const outlineMesh = new THREE.Mesh(child.geometry, outlineMat);

      // Compute this mesh's transform relative to the sourceGroup
      relativeMatrix.multiplyMatrices(groupInverse, child.matrixWorld);
      relativeMatrix.decompose(pos, quat, scl);

      outlineMesh.position.copy(pos);
      outlineMesh.quaternion.copy(quat);
      // Inflate by 2% for a subtle outline
      outlineMesh.scale.set(scl.x * 1.02, scl.y * 1.02, scl.z * 1.02);

      outline.add(outlineMesh);
    }
  });
  return outline;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function getGroupStats(group: THREE.Object3D): { vertices: number; triangles: number } {
  let vertices = 0;
  let triangles = 0;
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry && !child.parent?.userData.isOutline) {
      const geo = child.geometry as THREE.BufferGeometry;
      const pos = geo.getAttribute('position');
      if (pos) vertices += pos.count;
      const idx = geo.getIndex();
      if (idx) triangles += idx.count / 3;
      else if (pos) triangles += pos.count / 3;
    }
  });
  return { vertices, triangles: Math.floor(triangles) };
}

// ─── Axis Gizmo ───────────────────────────────────────────────────────────────

function createAxisGizmo(): THREE.Group {
  const gizmo = new THREE.Group();
  gizmo.userData.isGizmo = true;
  gizmo.renderOrder = 999;

  const axisLength = 0.8;
  const colors = { x: 0xff4444, y: 0x44ff44, z: 0x4488ff };
  const dirs = {
    x: new THREE.Vector3(1, 0, 0),
    y: new THREE.Vector3(0, 1, 0),
    z: new THREE.Vector3(0, 0, 1),
  };

  for (const [axis, _dir] of Object.entries(dirs)) {
    const color = colors[axis as keyof typeof colors];

    const shaftGeo = new THREE.CylinderGeometry(0.012, 0.012, axisLength, 6);
    const shaftMat = new THREE.MeshBasicMaterial({
      color,
      depthTest: false,
      transparent: true,
      opacity: 0.9,
    });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);

    const coneGeo = new THREE.ConeGeometry(0.045, 0.12, 8);
    const coneMat = new THREE.MeshBasicMaterial({
      color,
      depthTest: false,
      transparent: true,
      opacity: 0.9,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.y = axisLength / 2 + 0.06;

    const axisGroup = new THREE.Group();
    axisGroup.add(shaft);
    axisGroup.add(cone);

    if (axis === 'x') {
      axisGroup.rotation.z = -Math.PI / 2;
      axisGroup.position.x = axisLength / 2;
    } else if (axis === 'y') {
      axisGroup.position.y = axisLength / 2;
    } else {
      axisGroup.rotation.x = Math.PI / 2;
      axisGroup.position.z = axisLength / 2;
    }

    axisGroup.name = axis;
    gizmo.add(axisGroup);
  }

  const centerGeo = new THREE.SphereGeometry(0.04, 8, 8);
  const centerMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    depthTest: false,
    transparent: true,
    opacity: 0.9,
  });
  const center = new THREE.Mesh(centerGeo, centerMat);
  center.name = 'center';
  gizmo.add(center);

  return gizmo;
}

// ─── Scale Cage ───────────────────────────────────────────────────────────────

function createScaleCage(): THREE.Group {
  const cage = new THREE.Group();
  cage.userData.isCage = true;
  cage.renderOrder = 998;

  const edgeGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(24 * 3);
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0x3b82f6,
    transparent: true,
    opacity: 0.6,
    depthTest: false,
  });
  const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
  edgeLines.renderOrder = 998;
  edgeLines.name = 'cageEdges';
  cage.add(edgeLines);

  const handleSize = 0.06;
  const handleGeo = new THREE.BoxGeometry(handleSize, handleSize, handleSize);
  for (let i = 0; i < 8; i++) {
    const handleMat = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      depthTest: false,
      transparent: true,
      opacity: 0.9,
    });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.renderOrder = 999;
    handle.name = `handle_${i}`;
    handle.userData.isHandle = true;
    cage.add(handle);
  }

  const faceDotGeo = new THREE.SphereGeometry(0.035, 6, 6);
  for (let i = 0; i < 6; i++) {
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      depthTest: false,
      transparent: true,
      opacity: 0.7,
    });
    const dot = new THREE.Mesh(faceDotGeo, dotMat);
    dot.renderOrder = 999;
    dot.name = `faceDot_${i}`;
    dot.userData.isHandle = true;
    cage.add(dot);
  }

  return cage;
}

function updateScaleCage(cage: THREE.Group, bbox: THREE.Box3) {
  const min = bbox.min;
  const max = bbox.max;
  const pad = 0.08;
  const pMin = new THREE.Vector3(min.x - pad, min.y - pad, min.z - pad);
  const pMax = new THREE.Vector3(max.x + pad, max.y + pad, max.z + pad);

  const corners = [
    new THREE.Vector3(pMin.x, pMin.y, pMin.z),
    new THREE.Vector3(pMax.x, pMin.y, pMin.z),
    new THREE.Vector3(pMax.x, pMax.y, pMin.z),
    new THREE.Vector3(pMin.x, pMax.y, pMin.z),
    new THREE.Vector3(pMin.x, pMin.y, pMax.z),
    new THREE.Vector3(pMax.x, pMin.y, pMax.z),
    new THREE.Vector3(pMax.x, pMax.y, pMax.z),
    new THREE.Vector3(pMin.x, pMax.y, pMax.z),
  ];

  const edgeLines = cage.getObjectByName('cageEdges') as THREE.LineSegments;
  if (edgeLines) {
    const pos = edgeLines.geometry.getAttribute('position') as THREE.BufferAttribute;
    const edgeIndices = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];
    for (let i = 0; i < edgeIndices.length; i++) {
      const [a, b] = edgeIndices[i];
      pos.setXYZ(i * 2, corners[a].x, corners[a].y, corners[a].z);
      pos.setXYZ(i * 2 + 1, corners[b].x, corners[b].y, corners[b].z);
    }
    pos.needsUpdate = true;
  }

  for (let i = 0; i < 8; i++) {
    const handle = cage.getObjectByName(`handle_${i}`);
    if (handle) handle.position.copy(corners[i]);
  }

  const faceCenters = [
    new THREE.Vector3((pMin.x + pMax.x) / 2, (pMin.y + pMax.y) / 2, pMin.z),
    new THREE.Vector3((pMin.x + pMax.x) / 2, (pMin.y + pMax.y) / 2, pMax.z),
    new THREE.Vector3(pMin.x, (pMin.y + pMax.y) / 2, (pMin.z + pMax.z) / 2),
    new THREE.Vector3(pMax.x, (pMin.y + pMax.y) / 2, (pMin.z + pMax.z) / 2),
    new THREE.Vector3((pMin.x + pMax.x) / 2, pMin.y, (pMin.z + pMax.z) / 2),
    new THREE.Vector3((pMin.x + pMax.x) / 2, pMax.y, (pMin.z + pMax.z) / 2),
  ];
  for (let i = 0; i < 6; i++) {
    const dot = cage.getObjectByName(`faceDot_${i}`);
    if (dot) dot.position.copy(faceCenters[i]);
  }
}

// ─── Orbit Controls with Auto-Rotation ────────────────────────────────────────

class SimpleOrbitControls {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private spherical = new THREE.Spherical();
  private target = new THREE.Vector3(0, 0, 0);
  private isPointerDown = false;
  private isPanning = false;
  private prevPointer = { x: 0, y: 0 };
  private damping = { theta: 0, phi: 0 };
  public enabled = true;

  // Auto-rotation
  public autoRotate = false;
  public autoRotateSpeed = 0.15; // radians per second (slow cinematic)
  private lastInteractionTime = 0;
  private autoRotateDelay = 2000; // ms after last interaction before auto-rotate resumes

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;
    const offset = camera.position.clone().sub(this.target);
    this.spherical.setFromVector3(offset);

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onContextMenu = this.onContextMenu.bind(this);

    domElement.addEventListener('pointerdown', this.onPointerDown);
    domElement.addEventListener('pointermove', this.onPointerMove);
    domElement.addEventListener('pointerup', this.onPointerUp);
    domElement.addEventListener('pointerleave', this.onPointerUp);
    domElement.addEventListener('wheel', this.onWheel, { passive: false });
    domElement.addEventListener('contextmenu', this.onContextMenu);
  }

  private onContextMenu(e: Event) { e.preventDefault(); }

  private onPointerDown(e: PointerEvent) {
    if (!this.enabled) return;
    this.isPointerDown = true;
    this.isPanning = e.button === 2 || e.ctrlKey;
    this.prevPointer = { x: e.clientX, y: e.clientY };
    this.domElement.setPointerCapture(e.pointerId);
    this.lastInteractionTime = Date.now();
  }

  private onPointerMove(e: PointerEvent) {
    if (!this.enabled || !this.isPointerDown) return;
    const dx = e.clientX - this.prevPointer.x;
    const dy = e.clientY - this.prevPointer.y;
    this.prevPointer = { x: e.clientX, y: e.clientY };
    this.lastInteractionTime = Date.now();

    if (this.isPanning) {
      const panSpeed = 0.005 * this.spherical.radius;
      const right = new THREE.Vector3();
      const up = new THREE.Vector3();
      right.setFromMatrixColumn(this.camera.matrix, 0);
      up.setFromMatrixColumn(this.camera.matrix, 1);
      this.target.addScaledVector(right, -dx * panSpeed);
      this.target.addScaledVector(up, dy * panSpeed);
    } else {
      this.damping.theta -= dx * 0.005;
      this.damping.phi -= dy * 0.005;
    }
  }

  private onPointerUp(e: PointerEvent) {
    this.isPointerDown = false;
    this.isPanning = false;
    try { this.domElement.releasePointerCapture(e.pointerId); } catch {}
  }

  private onWheel(e: WheelEvent) {
    if (!this.enabled) return;
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    this.spherical.radius = Math.max(2, Math.min(15, this.spherical.radius * factor));
    this.lastInteractionTime = Date.now();
  }

  update(deltaTime: number) {
    // Apply auto-rotation if idle
    if (
      this.autoRotate &&
      !this.isPointerDown &&
      Date.now() - this.lastInteractionTime > this.autoRotateDelay
    ) {
      this.spherical.theta += this.autoRotateSpeed * deltaTime;
    }

    this.spherical.theta += this.damping.theta;
    this.spherical.phi += this.damping.phi;
    this.damping.theta *= 0.85;
    this.damping.phi *= 0.85;
    this.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.spherical.phi));
    const offset = new THREE.Vector3().setFromSpherical(this.spherical);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
  }

  dispose() {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.domElement.removeEventListener('pointerleave', this.onPointerUp);
    this.domElement.removeEventListener('wheel', this.onWheel);
    this.domElement.removeEventListener('contextmenu', this.onContextMenu);
  }
}

// ─── Drag Transform ───────────────────────────────────────────────────────────

interface DragTransformState {
  active: boolean;
  startPointer: { x: number; y: number };
  startPosition: THREE.Vector3;
  startScale: number;
  startBBoxCenter: THREE.Vector2;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function GearScene({ gearState, onStatsUpdate, onUpdate, onModelLoaded }: GearSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<SimpleOrbitControls | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const mainGearRef = useRef<THREE.Group | null>(null);
  const outlineRef = useRef<THREE.Group | null>(null);
  const gizmoRef = useRef<THREE.Group | null>(null);
  const cageRef = useRef<THREE.Group | null>(null);
  const contactShadowRef = useRef<THREE.Mesh | null>(null);
  const envMapRef = useRef<THREE.Texture | null>(null);
  const animIdRef = useRef<number>(0);
  const gearStateRef = useRef(gearState);
  const onUpdateRef = useRef(onUpdate);
  const transformModeRef = useRef<'translate' | 'scale'>('translate');
  const dragStateRef = useRef<DragTransformState>({
    active: false,
    startPointer: { x: 0, y: 0 },
    startPosition: new THREE.Vector3(),
    startScale: 1,
    startBBoxCenter: new THREE.Vector2(),
  });

  const [isSelected, setIsSelected] = useState(false);
  const [transformMode, setTransformMode] = useState<'translate' | 'scale'>('translate');
  const toolbarRef = useRef<HTMLDivElement>(null);
  const isSelectedRef = useRef(false);
  const isImportedModelRef = useRef(false);
  const importedModelHasOriginalMatsRef = useRef(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasModel, setHasModel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onModelLoadedRef = useRef(onModelLoaded);

  useEffect(() => {
    gearStateRef.current = gearState;
  }, [gearState]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    onModelLoadedRef.current = onModelLoaded;
  }, [onModelLoaded]);

  useEffect(() => {
    transformModeRef.current = transformMode;
    if (isSelectedRef.current) {
      if (gizmoRef.current) {
        gizmoRef.current.visible = transformMode === 'translate';
      }
      if (cageRef.current) {
        cageRef.current.visible = transformMode === 'scale';
        if (transformMode === 'scale' && mainGearRef.current) {
          const bbox = new THREE.Box3().setFromObject(mainGearRef.current);
          updateScaleCage(cageRef.current, bbox);
        }
      }
    }
  }, [transformMode]);

  // ─── Initialize Scene ───────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#09090b');
    sceneRef.current = scene;

    // Camera — cinematic position per spec
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(3, 2, 5);
    cameraRef.current = camera;

    // Renderer — high quality
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Environment Map ──
    const envMap = createWarehouseEnvMap(renderer);
    envMapRef.current = envMap;
    scene.environment = envMap;

    // ── Post-Processing ──
    let composer: EffectComposer | null = null;
    try {
      composer = new EffectComposer(renderer);

      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      // SSAO
      const ssaoPass = new SSAOPass(scene, camera, container.clientWidth, container.clientHeight);
      ssaoPass.kernelRadius = 0.3;
      ssaoPass.minDistance = 0.001;
      ssaoPass.maxDistance = 0.1;
      (ssaoPass as any).output = (SSAOPass as any).OUTPUT?.Default ?? 0;
      composer.addPass(ssaoPass);

      // Bloom
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(container.clientWidth, container.clientHeight),
        0.4,  // intensity
        0.4,  // radius
        0.8   // luminance threshold
      );
      composer.addPass(bloomPass);

      // Output (tone mapping)
      const outputPass = new OutputPass();
      composer.addPass(outputPass);

      composerRef.current = composer;
    } catch (e) {
      // Fallback: render without post-processing
      console.warn('Post-processing setup failed, rendering without effects:', e);
      composerRef.current = null;
    }

    // ── Orbit Controls ──
    const orbitControls = new SimpleOrbitControls(camera, renderer.domElement);
    controlsRef.current = orbitControls;

    // ── Lighting Setup ──
    // Main directional light (key light)
    const mainLight = new THREE.DirectionalLight(0xffffff, 4.0);
    mainLight.position.set(5, 8, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 30;
    mainLight.shadow.camera.left = -5;
    mainLight.shadow.camera.right = 5;
    mainLight.shadow.camera.top = 5;
    mainLight.shadow.camera.bottom = -5;
    mainLight.shadow.bias = -0.001;
    mainLight.shadow.normalBias = 0.02;
    scene.add(mainLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0xcce0ff, 1.5);
    fillLight.position.set(-5, 2, -5);
    scene.add(fillLight);

    // Rim light (back light for edge definition)
    const rimLight = new THREE.DirectionalLight(0xffeedd, 2.0);
    rimLight.position.set(0, -3, -8);
    scene.add(rimLight);

    // Ambient fill
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(ambientLight);

    // Hemisphere (sky/ground)
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1a1a2e, 0.3);
    scene.add(hemiLight);

    // ── Grid ──
    const grid = new THREE.GridHelper(50, 100, '#27272a', '#1a1a1a');
    grid.position.y = -1.2;
    if (Array.isArray(grid.material)) {
      grid.material.forEach((m) => { m.transparent = true; m.opacity = 0.4; });
    } else {
      grid.material.transparent = true;
      grid.material.opacity = 0.4;
    }
    scene.add(grid);

    // ── Contact Shadow ──
    const contactShadow = createContactShadowPlane();
    contactShadow.position.y = -1.18;
    scene.add(contactShadow);
    contactShadowRef.current = contactShadow;

    // ── Shadow-receiving ground ──
    const groundGeo = new THREE.PlaneGeometry(50, 50);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.25 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.2;
    ground.receiveShadow = true;
    scene.add(ground);

    // ── No default model — start with empty canvas ──
    mainGearRef.current = null;

    // ── Gizmo & Cage ──
    const gizmo = createAxisGizmo();
    gizmo.visible = false;
    scene.add(gizmo);
    gizmoRef.current = gizmo;

    const cage = createScaleCage();
    cage.visible = false;
    scene.add(cage);
    cageRef.current = cage;

    // ── Raycasting & Interaction ──
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let pointerDownTime = 0;

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      pointerDownTime = Date.now();

      if (isSelectedRef.current && mainGearRef.current && e.button === 0 && !e.ctrlKey) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        // Use recursive intersect for imported models with deep hierarchies
        const intersects = raycaster.intersectObjects([mainGearRef.current], true)
          .filter(hit => !hit.object.parent?.userData.isOutline);

        let hitCageHandle = false;
        if (transformModeRef.current === 'scale' && cageRef.current && cageRef.current.visible) {
          const cageHandles: THREE.Object3D[] = [];
          cageRef.current.traverse((child) => {
            if (child instanceof THREE.Mesh && child.userData.isHandle) {
              cageHandles.push(child);
            }
          });
          const cageIntersects = raycaster.intersectObjects(cageHandles, false);
          if (cageIntersects.length > 0) hitCageHandle = true;
        }

        if (intersects.length > 0 || hitCageHandle) {
          dragStateRef.current = {
            active: true,
            startPointer: { x: e.clientX, y: e.clientY },
            startPosition: mainGearRef.current.position.clone(),
            startScale: mainGearRef.current.scale.x,
            startBBoxCenter: new THREE.Vector2(),
          };
          orbitControls.enabled = false;
          renderer.domElement.setPointerCapture(e.pointerId);
          return;
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragStateRef.current.active || !mainGearRef.current) return;

      const dx = e.clientX - dragStateRef.current.startPointer.x;
      const dy = e.clientY - dragStateRef.current.startPointer.y;
      const mode = transformModeRef.current;

      if (mode === 'translate') {
        const right = new THREE.Vector3();
        const forward = new THREE.Vector3();
        right.setFromMatrixColumn(camera.matrix, 0);
        forward.crossVectors(new THREE.Vector3(0, 1, 0), right).normalize();

        const speed = 0.005 * camera.position.length() * 0.5;
        const newPos = dragStateRef.current.startPosition.clone();
        newPos.addScaledVector(right, dx * speed);
        newPos.addScaledVector(forward, -dy * speed);

        if (e.shiftKey) {
          newPos.copy(dragStateRef.current.startPosition);
          newPos.y += -dy * speed;
        }

        mainGearRef.current.position.copy(newPos);
      } else if (mode === 'scale') {
        const scaleDelta = 1 + dx * 0.005;
        const newScale = Math.max(0.2, Math.min(5, dragStateRef.current.startScale * scaleDelta));
        mainGearRef.current.scale.setScalar(newScale);
      }

      if (gizmoRef.current) {
        gizmoRef.current.position.copy(mainGearRef.current.position);
      }

      if (cageRef.current && mainGearRef.current) {
        const bbox = new THREE.Box3().setFromObject(mainGearRef.current);
        updateScaleCage(cageRef.current, bbox);
      }

      // Update contact shadow position
      if (contactShadowRef.current && mainGearRef.current) {
        contactShadowRef.current.position.x = mainGearRef.current.position.x;
        contactShadowRef.current.position.z = mainGearRef.current.position.z;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const wasDragging = dragStateRef.current.active;
      const dragDx = Math.abs(e.clientX - pointerDownPos.x);
      const dragDy = Math.abs(e.clientY - pointerDownPos.y);
      const elapsed = Date.now() - pointerDownTime;

      if (wasDragging) {
        orbitControls.enabled = true;

        // For imported models, just keep the visual scale (no dimension baking)
        // For procedural gears, commit scale to width/height dimensions
        if (transformModeRef.current === 'scale' && mainGearRef.current && !isImportedModelRef.current) {
          const scaleFactor = mainGearRef.current.scale.x;
          if (Math.abs(scaleFactor - 1) > 0.001) {
            const gs = gearStateRef.current;
            const newWidth = Math.round(gs.width * scaleFactor * 100) / 100;
            const newHeight = Math.round(gs.height * scaleFactor * 100) / 100;
            const clampedWidth = Math.max(0.5, Math.min(5, newWidth));
            const clampedHeight = Math.max(0.1, Math.min(2, newHeight));
            mainGearRef.current.scale.setScalar(1);
            onUpdateRef.current({ width: clampedWidth, height: clampedHeight });
          }
        }

        dragStateRef.current.active = false;
        try { renderer.domElement.releasePointerCapture(e.pointerId); } catch {}

        if (dragDx > 5 || dragDy > 5) return;
      }

      if (dragDx > 5 || dragDy > 5 || elapsed > 300) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      if (mainGearRef.current) {
        // Use recursive intersect for imported models with deep hierarchies
        const intersects = raycaster.intersectObjects([mainGearRef.current], true)
          .filter(hit => !hit.object.parent?.userData.isOutline);
        if (intersects.length > 0) {
          setIsSelected(true);
          isSelectedRef.current = true;

          if (gizmoRef.current) {
            gizmoRef.current.visible = transformModeRef.current === 'translate';
            gizmoRef.current.position.copy(mainGearRef.current.position);
          }

          if (outlineRef.current && outlineRef.current.parent) {
            outlineRef.current.parent.remove(outlineRef.current);
          }
          const outline = createOutlineGroup(mainGearRef.current);
          mainGearRef.current.add(outline);
          outlineRef.current = outline;

          if (cageRef.current && mainGearRef.current) {
            const bbox = new THREE.Box3().setFromObject(mainGearRef.current);
            updateScaleCage(cageRef.current, bbox);
            cageRef.current.visible = transformModeRef.current === 'scale';
          }
        } else {
          setIsSelected(false);
          isSelectedRef.current = false;
          if (gizmoRef.current) gizmoRef.current.visible = false;
          if (outlineRef.current && outlineRef.current.parent) {
            outlineRef.current.parent.remove(outlineRef.current);
            outlineRef.current = null;
          }
          if (cageRef.current) cageRef.current.visible = false;
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // ── Animation Loop ──
    const bbHelper = new THREE.Box3();
    const projVec = new THREE.Vector3();
    const clock = new THREE.Clock();

    const animate = () => {
      animIdRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      orbitControls.update(delta);

      // Keep gizmo in sync
      if (gizmoRef.current && gizmoRef.current.visible && mainGearRef.current) {
        gizmoRef.current.position.copy(mainGearRef.current.position);
        const dist = camera.position.distanceTo(mainGearRef.current.position);
        const gizmoScale = dist * 0.15;
        gizmoRef.current.scale.setScalar(gizmoScale);
      }

      // Render with post-processing or fallback
      if (composerRef.current) {
        composerRef.current.render();
      } else {
        renderer.render(scene, camera);
      }

      // Update toolbar position
      if (isSelectedRef.current && mainGearRef.current && toolbarRef.current && container) {
        bbHelper.setFromObject(mainGearRef.current);
        const centerX = (bbHelper.min.x + bbHelper.max.x) / 2;
        const centerZ = (bbHelper.min.z + bbHelper.max.z) / 2;
        const bottomY = bbHelper.min.y;

        projVec.set(centerX, bottomY, centerZ);
        projVec.project(camera);

        const hw = container.clientWidth / 2;
        const hh = container.clientHeight / 2;
        const screenX = projVec.x * hw + hw;
        const screenY = -(projVec.y * hh) + hh;

        const toolbarW = toolbarRef.current.offsetWidth;
        const toolbarH = toolbarRef.current.offsetHeight;
        const margin = 16;

        const left = Math.max(8, Math.min(screenX - toolbarW / 2, container.clientWidth - toolbarW - 8));
        const maxTop = container.clientHeight - toolbarH - 12;
        const top = Math.min(screenY + margin, maxTop);

        toolbarRef.current.style.left = `${left}px`;
        toolbarRef.current.style.top = `${Math.max(8, top)}px`;
      }
    };
    animate();

    // ── Resize ──
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      if (composerRef.current) {
        composerRef.current.setSize(container.clientWidth, container.clientHeight);
      }
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animIdRef.current);
      resizeObserver.disconnect();
      orbitControls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      if (composerRef.current) {
        composerRef.current.dispose();
      }
      renderer.dispose();
      if (envMapRef.current) {
        envMapRef.current.dispose();
      }
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Rebuild / Update on Parameter Changes ──
  const rebuildGear = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // If no model loaded yet, nothing to do
    if (!mainGearRef.current) return;

    // For imported models, just update materials (don't rebuild geometry)
    if (isImportedModelRef.current && mainGearRef.current) {
      const gs = gearStateRef.current;
      applyMaterialToGroup(
        mainGearRef.current,
        gs.color,
        gs.metalness,
        gs.roughness,
        envMapRef.current,
        importedModelHasOriginalMatsRef.current
      );
      onStatsUpdate(getGroupStats(mainGearRef.current));

      // Refresh outline if selected
      if (outlineRef.current && outlineRef.current.parent) {
        outlineRef.current.parent.remove(outlineRef.current);
        const outline = createOutlineGroup(mainGearRef.current);
        mainGearRef.current.add(outline);
        outlineRef.current = outline;
      }
      return;
    }

    const wasSelected = !!outlineRef.current;

    let savedPos: THREE.Vector3 | null = null;
    let savedRot: THREE.Euler | null = null;
    if (mainGearRef.current) {
      savedPos = mainGearRef.current.position.clone();
      savedRot = mainGearRef.current.rotation.clone();
    }

    if (mainGearRef.current) {
      scene.remove(mainGearRef.current);
      mainGearRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) child.material.dispose();
        }
      });
    }
    outlineRef.current = null;

    const gs = gearStateRef.current;
    const newGear = createGearGroup(
      gs.teeth, gs.color, gs.metalness, gs.roughness,
      gs.width, gs.height, envMapRef.current
    );
    newGear.userData.isMainGear = true;

    if (savedPos) newGear.position.copy(savedPos);
    if (savedRot) newGear.rotation.copy(savedRot);

    scene.add(newGear);
    mainGearRef.current = newGear;
    onStatsUpdate(getGroupStats(newGear));

    if (wasSelected) {
      const outline = createOutlineGroup(newGear);
      newGear.add(outline);
      outlineRef.current = outline;

      if (gizmoRef.current) {
        gizmoRef.current.visible = transformModeRef.current === 'translate';
        gizmoRef.current.position.copy(newGear.position);
      }

      if (cageRef.current && newGear) {
        const bbox = new THREE.Box3().setFromObject(newGear);
        updateScaleCage(cageRef.current, bbox);
        cageRef.current.visible = transformModeRef.current === 'scale';
      }
    }
  }, [onStatsUpdate]);

  const prevRef = useRef({
    teeth: gearState.teeth,
    color: gearState.color,
    metalness: gearState.metalness,
    roughness: gearState.roughness,
    width: gearState.width,
    height: gearState.height,
  });

  useEffect(() => {
    const prev = prevRef.current;
    if (
      gearState.teeth !== prev.teeth ||
      gearState.color !== prev.color ||
      gearState.metalness !== prev.metalness ||
      gearState.roughness !== prev.roughness ||
      gearState.width !== prev.width ||
      gearState.height !== prev.height
    ) {
      prevRef.current = {
        teeth: gearState.teeth,
        color: gearState.color,
        metalness: gearState.metalness,
        roughness: gearState.roughness,
        width: gearState.width,
        height: gearState.height,
      };
      rebuildGear();
    }
  }, [gearState.teeth, gearState.color, gearState.metalness, gearState.roughness, gearState.width, gearState.height, rebuildGear]);

  const handleDeselect = useCallback(() => {
    setIsSelected(false);
    isSelectedRef.current = false;
    if (gizmoRef.current) gizmoRef.current.visible = false;
    if (outlineRef.current && outlineRef.current.parent) {
      outlineRef.current.parent.remove(outlineRef.current);
      outlineRef.current = null;
    }
    if (cageRef.current) cageRef.current.visible = false;
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setLoadError(null);

    try {
      const model = await loadModelFromFile(file);
      if (!model) throw new Error('Failed to load model');

      const scene = sceneRef.current;
      if (!scene) return;

      const wasSelected = !!outlineRef.current;

      let savedPos: THREE.Vector3 | null = null;
      let savedRot: THREE.Euler | null = null;
      if (mainGearRef.current) {
        savedPos = mainGearRef.current.position.clone();
        savedRot = mainGearRef.current.rotation.clone();
      }

      if (mainGearRef.current) {
        scene.remove(mainGearRef.current);
        mainGearRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (child.material instanceof THREE.Material) child.material.dispose();
          }
        });
      }
      outlineRef.current = null;

      const newGear = model.group;
      newGear.userData.isMainGear = true;

      if (savedPos) newGear.position.copy(savedPos);
      if (savedRot) newGear.rotation.copy(savedRot);

      scene.add(newGear);
      mainGearRef.current = newGear;
      onStatsUpdate(getGroupStats(newGear));

      if (wasSelected) {
        const outline = createOutlineGroup(newGear);
        newGear.add(outline);
        outlineRef.current = outline;

        if (gizmoRef.current) {
          gizmoRef.current.visible = transformModeRef.current === 'translate';
          gizmoRef.current.position.copy(newGear.position);
        }

        if (cageRef.current && newGear) {
          const bbox = new THREE.Box3().setFromObject(newGear);
          updateScaleCage(cageRef.current, bbox);
          cageRef.current.visible = transformModeRef.current === 'scale';
        }
      }

      isImportedModelRef.current = true;
      importedModelHasOriginalMatsRef.current = model.originalMaterials;
      onModelLoadedRef.current?.({
        name: file.name,
        format: model.format,
        originalMaterials: model.originalMaterials,
      });
      setHasModel(true);
    } catch (error) {
      setLoadError((error as Error).message);
    } finally {
      setIsLoading(false);
      // Reset input so the same file can be re-loaded
      if (e.target) e.target.value = '';
    }
  }, [onStatsUpdate]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setLoadError(null);

    try {
      const model = await loadModelFromFile(file);
      if (!model) throw new Error('Failed to load model');

      const scene = sceneRef.current;
      if (!scene) return;

      const wasSelected = !!outlineRef.current;

      let savedPos: THREE.Vector3 | null = null;
      let savedRot: THREE.Euler | null = null;
      if (mainGearRef.current) {
        savedPos = mainGearRef.current.position.clone();
        savedRot = mainGearRef.current.rotation.clone();
      }

      if (mainGearRef.current) {
        scene.remove(mainGearRef.current);
        mainGearRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (child.material instanceof THREE.Material) child.material.dispose();
          }
        });
      }
      outlineRef.current = null;

      const newGear = model.group;
      newGear.userData.isMainGear = true;

      if (savedPos) newGear.position.copy(savedPos);
      if (savedRot) newGear.rotation.copy(savedRot);

      scene.add(newGear);
      mainGearRef.current = newGear;
      onStatsUpdate(getGroupStats(newGear));

      if (wasSelected) {
        const outline = createOutlineGroup(newGear);
        newGear.add(outline);
        outlineRef.current = outline;

        if (gizmoRef.current) {
          gizmoRef.current.visible = transformModeRef.current === 'translate';
          gizmoRef.current.position.copy(newGear.position);
        }

        if (cageRef.current && newGear) {
          const bbox = new THREE.Box3().setFromObject(newGear);
          updateScaleCage(cageRef.current, bbox);
          cageRef.current.visible = transformModeRef.current === 'scale';
        }
      }

      isImportedModelRef.current = true;
      importedModelHasOriginalMatsRef.current = model.originalMaterials;
      onModelLoadedRef.current?.({
        name: file.name,
        format: model.format,
        originalMaterials: model.originalMaterials,
      });
      setHasModel(true);
    } catch (error) {
      setLoadError((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [onStatsUpdate]);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="3D gear viewport — click to select gear, use mouse to orbit, scroll to zoom"
      aria-roledescription="3D viewport"
      className="relative h-full w-full"
      style={{ background: '#09090b' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Floating toolbar on selection */}
      {isSelected && (
        <div
          ref={toolbarRef}
          role="toolbar"
          aria-label="Transform tools"
          aria-orientation="horizontal"
          className="pointer-events-auto absolute z-50 flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900/95 px-2 py-1.5 shadow-xl backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => setTransformMode('translate')}
            aria-pressed={transformMode === 'translate'}
            aria-label="Translate mode — drag to move"
            title="Translate (drag to move)"
            className={`flex h-7 w-7 items-center justify-center rounded-md p-0 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${transformMode === 'translate' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
          >
            <Move size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setTransformMode('scale')}
            aria-pressed={transformMode === 'scale'}
            aria-label="Scale mode — drag to resize"
            title="Scale (drag to resize)"
            className={`flex h-7 w-7 items-center justify-center rounded-md p-0 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${transformMode === 'scale' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
          >
            <Maximize size={14} aria-hidden="true" />
          </button>
          <div role="separator" aria-orientation="vertical" className="mx-1 h-4 w-px bg-zinc-700" />
          <button
            type="button"
            onClick={handleDeselect}
            aria-label="Deselect gear"
            title="Deselect"
            className="flex h-7 w-7 items-center justify-center rounded-md p-0 cursor-pointer text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}
      {/* File input for model loading */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_STRING}
        className="hidden"
        onChange={handleFileChange}
      />
      {/* Load error message */}
      {loadError && (
        <div
          className="absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg border border-red-800 bg-red-950/95 px-4 py-2 shadow-xl"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-xs text-red-400" style={{ fontFamily: 'monospace' }}>{loadError}</p>
          <button
            type="button"
            onClick={() => setLoadError(null)}
            className="mt-1 text-[10px] text-red-500 hover:text-red-300 cursor-pointer"
            style={{ fontFamily: 'monospace' }}
          >
            Dismiss
          </button>
        </div>
      )}
      {/* Loading indicator */}
      {isLoading && (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-blue-500/90 px-4 py-2 text-sm text-white shadow-xl"
          role="status"
          aria-live="assertive"
        >
          Loading...
        </div>
      )}
      {/* Drag and drop overlay */}
      {isDragOver && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center bg-blue-500/10 backdrop-blur-[2px]"
          role="status"
          aria-live="assertive"
        >
          <div className="rounded-xl border-2 border-dashed border-blue-500/50 bg-zinc-900/80 px-8 py-6 text-center">
            <p className="text-sm text-blue-400" style={{ fontFamily: 'monospace' }}>Drop model file here</p>
          </div>
        </div>
      )}
      {/* Empty state prompt */}
      {!hasModel && !isLoading && !loadError && (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-4"
          aria-hidden="true"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-700/50 bg-zinc-800/50">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm text-zinc-400" style={{ fontFamily: 'monospace' }}>
              Drop your 3D file to view it
            </p>
            <p className="mt-1 text-[11px] text-zinc-600" style={{ fontFamily: 'monospace' }}>
              GLB / GLTF / STL / OBJ / FBX / PLY
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="pointer-events-auto mt-2 rounded-md border border-zinc-700 bg-zinc-800/80 px-4 py-1.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-white cursor-pointer transition-colors"
            style={{ fontFamily: 'monospace' }}
          >
            or browse files
          </button>
        </div>
      )}
    </div>
  );
}