// catalog/view/javascript/configurator3d/js/model.js
// База + подкомпоненты по слотам. Авто-выравнивание компонентов по bbox базы.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();

let currentModel = null;
const currentComponents = new Map();
let modelInitialHalfHeight = 0;
let baseBox = null;
const parts = new Map();
const originalMaterials = new Map();

function ensureUVs(mesh) {
  const geo = mesh.geometry;
  if (!geo || geo.attributes.uv) return;
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const size = new THREE.Vector3();
  bb.getSize(size);
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    uv[i * 2]     = size.x > 0 ? (x - bb.min.x) / size.x : 0;
    uv[i * 2 + 1] = size.z > 0 ? (z - bb.min.z) / size.z : 0;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function registerMeshInParts(mesh, source) {
  ensureUVs(mesh);
  originalMaterials.set(mesh, mesh.material.clone());
  const matName = mesh.material?.name || mesh.name || 'default';
  const partKey = source ? source + ':' + matName : matName;
  if (!parts.has(partKey)) {
    parts.set(partKey, {
      name: source ? source + ': ' + matName : matName,
      meshes: [],
      texture: null,
      color: new THREE.Color(0xffffff),
      textureUrl: null,
      source: source
    });
  }
  parts.get(partKey).meshes.push(mesh);
}

function disposeObject(obj) {
  obj.traverse((c) => {
    if (c.isMesh) {
      c.geometry?.dispose();
      if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
      else c.material?.dispose();
      originalMaterials.delete(c);
    }
  });
}

function disposeComponent(slotName, holder) {
  const comp = currentComponents.get(slotName);
  if (!comp) return;
  holder.remove(comp);
  disposeObject(comp);
  for (const [key, part] of parts) {
    if (part.source === slotName) parts.delete(key);
  }
  currentComponents.delete(slotName);
}

function disposeBase(holder) {
  for (const slot of [...currentComponents.keys()]) disposeComponent(slot, holder);
  if (!currentModel) return;
  holder.remove(currentModel);
  disposeObject(currentModel);
  currentModel = null;
  parts.clear();
  originalMaterials.clear();
  baseBox = null;
  holder.position.set(0, 0, 0);
}

export function loadModel(path, holder, callbacks = {}) {
  const { onLoaded, onProgress, onError } = callbacks;
  disposeBase(holder);
  gltfLoader.load(path, (gltf) => {
    const model = gltf.scene;
    currentModel = model;
    model.traverse((c) => { if (c.isMesh) registerMeshInParts(c, null); });
    const box = new THREE.Box3().setFromObject(model);
    baseBox = box.clone();
    const sizeDiagonal = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    holder.position.set(-center.x, -center.y, -center.z);
    modelInitialHalfHeight = (box.max.y - box.min.y) / 2;
    holder.add(model);
    if (onLoaded) onLoaded(parts, { sizeDiagonal, halfHeight: modelInitialHalfHeight });
  }, (xhr) => {
    if (xhr.total && onProgress) onProgress((xhr.loaded / xhr.total) * 100);
  }, (err) => {
    console.error('Помилка завантаження моделі:', err);
    if (onError) onError(err);
  });
}

export function loadComponent(path, slotName, holder, callbacks = {}) {
  const { onLoaded, onError, align = 'auto' } = callbacks;
  disposeComponent(slotName, holder);
  gltfLoader.load(path, (gltf) => {
    const model = gltf.scene;
    model.traverse((c) => { if (c.isMesh) registerMeshInParts(c, slotName); });
    if (align === 'auto' && baseBox) {
      const compBox = new THREE.Box3().setFromObject(model);
      const baseCenter = baseBox.getCenter(new THREE.Vector3());
      const compCenter = compBox.getCenter(new THREE.Vector3());
      model.position.set(
        baseCenter.x - compCenter.x,
        baseBox.min.y - compBox.max.y,
        baseCenter.z - compCenter.z
      );
    }
    currentComponents.set(slotName, model);
    holder.add(model);
    if (onLoaded) onLoaded(parts);
  }, undefined, (err) => {
    console.error('Помилка завантаження компонента:', err);
    if (onError) onError(err);
  });
}

export function removeComponent(slotName, holder, callback) {
  disposeComponent(slotName, holder);
  if (callback) callback(parts);
}

export function getParts() { return parts; }
export function getOriginalMaterials() { return originalMaterials; }
export function getInitialHalfHeight() { return modelInitialHalfHeight; }
