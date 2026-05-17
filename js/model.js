// js/model.js
// Загрузка моделей: база + подкомпоненты по слотам (например, разные ножки)

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();

// ===== Состояние =====
let currentModel = null;                  // базовая модель
const currentComponents = new Map();      // slotName -> Object3D
let modelInitialHalfHeight = 0;
let baseBox = null;                       // bbox базы в её локальных координатах (для авто-выравнивания компонентов)
const parts = new Map();                  // partKey -> { name, meshes[], texture, color, textureUrl, source }
const originalMaterials = new Map();      // mesh -> material.clone()

// ===== Генерация UV, если их нет =====
// Простая планарная проекция XZ → uv. Не идеально, но позволяет видеть текстуру.
function ensureUVs(mesh) {
  const geo = mesh.geometry;
  if (!geo) return;
  if (geo.attributes.uv) return;

  console.warn('Mesh "' + mesh.name + '" не имеет UV — генерирую планарную проекцию (XZ)');

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

// ===== Регистрация mesh в общей мапе частей =====
// source = null для базы, slotName для подкомпонента (нужно при удалении слота)
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

// ===== Утилита: освободить ресурсы под-дерева =====
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

// ===== Удаление подкомпонента из слота =====
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

// ===== Удаление базы (вместе со всеми компонентами) =====
function disposeBase(holder) {
  for (const slot of [...currentComponents.keys()]) {
    disposeComponent(slot, holder);
  }
  if (!currentModel) return;
  holder.remove(currentModel);
  disposeObject(currentModel);
  currentModel = null;
  parts.clear();
  originalMaterials.clear();
  baseBox = null;
  holder.position.set(0, 0, 0);
}

// ===== Загрузка базовой модели =====
export function loadModel(path, holder, callbacks = {}) {
  const { onLoaded, onProgress, onError } = callbacks;

  disposeBase(holder);

  gltfLoader.load(path, (gltf) => {
    const model = gltf.scene;
    currentModel = model;

    console.log('=== Базовая модель (' + path + ') ===');
    model.traverse((c) => {
      if (c.isMesh) {
        console.log('Mesh:', c.name, '| Material:', c.material?.name, '| UV:', !!c.geometry.attributes.uv);
        registerMeshInParts(c, null);
      }
    });

    // Сдвигаем holder, а не саму модель, чтобы добавляемые позже компоненты
    // сохраняли своё естественное положение относительно базы.
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
    console.error('Ошибка загрузки модели:', err);
    if (onError) onError(err);
  });
}

// ===== Загрузка подкомпонента в слот =====
// Авто-выравнивание (по умолчанию): top компонента → bottom базы, X/Z центрирование.
// Чтобы загрузить компонент "как есть" (без выравнивания), передайте { align: 'none' }.
export function loadComponent(path, slotName, holder, callbacks = {}) {
  const { onLoaded, onError, align = 'auto' } = callbacks;

  disposeComponent(slotName, holder);

  gltfLoader.load(path, (gltf) => {
    const model = gltf.scene;

    console.log('=== Компонент "' + slotName + '" (' + path + ') ===');
    model.traverse((c) => {
      if (c.isMesh) {
        console.log('Mesh:', c.name, '| Material:', c.material?.name);
        registerMeshInParts(c, slotName);
      }
    });

    // Авто-выравнивание относительно базы по bbox-у
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
    console.error('Ошибка загрузки компонента:', err);
    if (onError) onError(err);
  });
}

// ===== Снять подкомпонент со слота =====
export function removeComponent(slotName, holder, callback) {
  disposeComponent(slotName, holder);
  if (callback) callback(parts);
}

// ===== Доступ к состоянию =====
export function getParts() {
  return parts;
}

export function getOriginalMaterials() {
  return originalMaterials;
}

export function getInitialHalfHeight() {
  return modelInitialHalfHeight;
}
