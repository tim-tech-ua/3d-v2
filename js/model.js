// js/model.js
// Загрузка моделей, автогенерация UV, разбиение на части, трансформация

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();

// ===== Состояние =====
let currentModel = null;
let modelInitialHalfHeight = 0;
let parts = new Map(); // key (имя материала) -> { name, meshes[], texture, color, textureUrl }
let originalMaterials = new Map(); // mesh -> material.clone()

// ===== Генерация UV, если их нет =====
// Простая планарная проекция: XZ → uv. Не идеально, но позволяет видеть текстуру.
// Для правильного результата лучше делать UV-развёртку в Blender (Smart UV Project).
function ensureUVs(mesh) {
  const geo = mesh.geometry;
  if (!geo) return;
  if (geo.attributes.uv) return; // UV уже есть

  console.warn('Mesh "' + mesh.name + '" не имеет UV — генерирую планарную проекцию (XZ)');

  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const size = new THREE.Vector3();
  bb.getSize(size);

  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);

  // Выбираем плоскость проекции по наибольшим размерам
  // Возьмём планарную XZ как универсальную для большинства мебели
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    uv[i * 2]     = size.x > 0 ? (x - bb.min.x) / size.x : 0;
    uv[i * 2 + 1] = size.z > 0 ? (z - bb.min.z) / size.z : 0;
  }

  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// ===== Очистка предыдущей модели =====
function disposeModel(holder) {
  if (!currentModel) return;
  holder.remove(currentModel);
  currentModel.traverse((c) => {
    if (c.isMesh) {
      c.geometry?.dispose();
      if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
      else c.material?.dispose();
    }
  });
  currentModel = null;
  parts.clear();
  originalMaterials.clear();
}

// ===== Загрузка модели =====
// onLoaded: (parts: Map, info: { size, halfHeight }) => void
// onProgress: (percent: number) => void
// onError: (err) => void
export function loadModel(path, holder, callbacks = {}) {
  const { onLoaded, onProgress, onError } = callbacks;

  disposeModel(holder);

  gltfLoader.load(path, (gltf) => {
    const model = gltf.scene;
    currentModel = model;

    console.log('=== Части модели (' + path + ') ===');
    model.traverse((c) => {
      if (c.isMesh) {
        console.log('Mesh:', c.name, '| Material:', c.material?.name, '| UV:', !!c.geometry.attributes.uv);
        ensureUVs(c);
        c.castShadow = true;
        c.receiveShadow = true;

        const matName = c.material?.name || c.name || 'default';
        originalMaterials.set(c, c.material.clone());

        if (!parts.has(matName)) {
          parts.set(matName, {
            name: matName,
            meshes: [],
            texture: null,
            color: new THREE.Color(0xffffff),
            textureUrl: null
          });
        }
        parts.get(matName).meshes.push(c);
      }
    });

    // Центрирование модели в её собственной системе координат
    const box = new THREE.Box3().setFromObject(model);
    const sizeDiagonal = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    modelInitialHalfHeight = (box.max.y - box.min.y) / 2;

    holder.add(model);

    if (onLoaded) onLoaded(parts, {
      sizeDiagonal,
      halfHeight: modelInitialHalfHeight
    });
  }, (xhr) => {
    if (xhr.total && onProgress) onProgress((xhr.loaded / xhr.total) * 100);
  }, (err) => {
    console.error('Ошибка загрузки модели:', err);
    if (onError) onError(err);
  });
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

// ===== Трансформация модели через holder =====
export function applyTransformToHolder(holder, transform) {
  const { scale, x, y, z, rotY } = transform;
  holder.scale.setScalar(scale);
  holder.position.set(x, y, z);
  holder.rotation.y = rotY;
}
