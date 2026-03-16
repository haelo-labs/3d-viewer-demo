import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';

export type SupportedFormat = 'glb' | 'gltf' | 'stl' | 'obj' | 'fbx' | 'ply';

export const SUPPORTED_EXTENSIONS: SupportedFormat[] = ['glb', 'gltf', 'stl', 'obj', 'fbx', 'ply'];

export const ACCEPT_STRING = '.glb,.gltf,.stl,.obj,.fbx,.ply';

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

export function isSupportedFormat(filename: string): boolean {
  const ext = getFileExtension(filename);
  return SUPPORTED_EXTENSIONS.includes(ext as SupportedFormat);
}

export interface LoadedModel {
  group: THREE.Group;
  name: string;
  format: string;
  originalMaterials: boolean; // true if the format came with materials (GLTF, FBX)
}

/**
 * Load a 3D model file into a normalized THREE.Group.
 * The group is auto-centered and auto-scaled to fit within a ~2 unit radius.
 */
export async function loadModelFromFile(file: File): Promise<LoadedModel> {
  const ext = getFileExtension(file.name) as SupportedFormat;
  const buffer = await file.arrayBuffer();

  let group: THREE.Group;
  let originalMaterials = false;

  switch (ext) {
    case 'glb':
    case 'gltf': {
      group = await loadGLTF(buffer, file.name);
      originalMaterials = true;
      break;
    }
    case 'stl': {
      group = loadSTL(buffer);
      break;
    }
    case 'obj': {
      group = loadOBJ(buffer);
      break;
    }
    case 'fbx': {
      group = loadFBX(buffer);
      originalMaterials = true;
      break;
    }
    case 'ply': {
      group = loadPLY(buffer);
      break;
    }
    default:
      throw new Error(`Unsupported format: .${ext}`);
  }

  // Auto-center and auto-scale
  normalizeModel(group);

  // Enable shadows on all meshes
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return {
    group,
    name: file.name,
    format: ext.toUpperCase(),
    originalMaterials,
  };
}

// ─── Format-specific loaders ──────────────────────────────────────────────────

function loadGLTF(buffer: ArrayBuffer, filename: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    // GLTFLoader.parse expects (data, path, onLoad, onError)
    loader.parse(buffer, '', (gltf) => {
      const group = new THREE.Group();
      group.add(gltf.scene);
      resolve(group);
    }, (error) => {
      reject(new Error(`Failed to parse ${filename}: ${error}`));
    });
  });
}

function loadSTL(buffer: ArrayBuffer): THREE.Group {
  const loader = new STLLoader();
  const geometry = loader.parse(buffer);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry);
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}

function loadOBJ(buffer: ArrayBuffer): THREE.Group {
  const loader = new OBJLoader();
  const text = new TextDecoder().decode(buffer);
  const obj = loader.parse(text);
  const group = new THREE.Group();
  group.add(obj);
  return group;
}

function loadFBX(buffer: ArrayBuffer): THREE.Group {
  const loader = new FBXLoader();
  const fbx = loader.parse(buffer, '');
  const group = new THREE.Group();
  group.add(fbx);
  return group;
}

function loadPLY(buffer: ArrayBuffer): THREE.Group {
  const loader = new PLYLoader();
  const geometry = loader.parse(buffer);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry);
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}

// ─── Normalization ────────────────────────────────────────────────────────────

function normalizeModel(group: THREE.Group) {
  // Compute bounding box of entire group
  const bbox = new THREE.Box3().setFromObject(group);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  bbox.getCenter(center);
  bbox.getSize(size);

  // Wrap all children in an inner group so the outer group keeps scale=(1,1,1)
  const inner = new THREE.Group();
  while (group.children.length > 0) {
    inner.add(group.children[0]);
  }

  // Center the model at origin via the inner group
  inner.position.sub(center);

  // Scale to fit within a ~3 unit box via the inner group
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) {
    const targetSize = 3.0;
    const scale = targetSize / maxDim;
    inner.scale.setScalar(scale);
  }

  group.add(inner);

  // Update matrices so bounding box recalculation works
  group.updateMatrixWorld(true);
}

/**
 * Apply PBR material properties to all meshes in a group.
 * If `preserveOriginal` is false, replaces all materials with a single MeshStandardMaterial.
 * If true, only updates metalness/roughness/color on existing MeshStandardMaterials.
 */
export function applyMaterialToGroup(
  group: THREE.Group,
  color: string,
  metalness: number,
  roughness: number,
  envMap: THREE.Texture | null,
  preserveOriginal: boolean
) {
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    if (preserveOriginal) {
      // Update existing materials (only MeshStandardMaterial-compatible)
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) {
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.metalness = metalness;
          mat.roughness = roughness;
          mat.envMapIntensity = 2.0;
          if (envMap) mat.envMap = envMap;
          mat.needsUpdate = true;
        }
      }
    } else {
      // Replace with uniform PBR material
      const newMat = new THREE.MeshStandardMaterial({
        color,
        metalness,
        roughness,
        envMapIntensity: 2.0,
      });
      if (envMap) newMat.envMap = envMap;

      // Dispose old materials
      const oldMats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of oldMats) {
        if (m instanceof THREE.Material) m.dispose();
      }
      child.material = newMat;
    }
  });
}