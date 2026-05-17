// js/materials.js
// Управление материалами: применение тканей, цветов, repeat-масштаба

import * as THREE from 'three';
import { getParts, getOriginalMaterials } from './model.js';

const textureLoader = new THREE.TextureLoader();

let activePartKey = null;
let textureRepeat = 2.0;

// ===== Колбэки наружу (для обновления UI) =====
let onActivePartChanged = null;

export function setOnActivePartChanged(callback) {
  onActivePartChanged = callback;
}

// ===== Активная часть =====
export function setActivePart(key) {
  activePartKey = key;
  if (onActivePartChanged) {
    const part = getParts().get(key);
    onActivePartChanged(key, part);
  }
}

export function getActivePart() {
  return activePartKey ? getParts().get(activePartKey) : null;
}

export function getActivePartKey() {
  return activePartKey;
}

export function resetActivePart() {
  activePartKey = null;
}

// ===== Масштаб повторения текстуры =====
export function setTextureRepeat(value) {
  textureRepeat = value;
  // Обновить уже применённые текстуры на всех частях
  for (const part of getParts().values()) {
    if (part.texture) {
      part.texture.repeat.set(textureRepeat, textureRepeat);
      part.texture.needsUpdate = true;
    }
  }
}

export function getTextureRepeat() {
  return textureRepeat;
}

// ===== Применить материал к активной части =====
function applyToActivePart() {
  if (!activePartKey) return;
  const part = getParts().get(activePartKey);
  if (!part) return;

  part.meshes.forEach((mesh) => {
    if (!mesh.material.isMeshStandardMaterial) {
      mesh.material = new THREE.MeshStandardMaterial();
    }
    mesh.material.map = part.texture || null;
    mesh.material.color = part.color;
    mesh.material.roughness = 0.8;
    mesh.material.metalness = 0.0;
    mesh.material.needsUpdate = true;
  });
}

// ===== Применить ткань (текстуру) к активной части =====
// callback вызывается после загрузки текстуры (например, чтобы подсветить кнопку)
export function applyFabric(url, callback) {
  if (!activePartKey) return false;

  textureLoader.load(url, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(textureRepeat, textureRepeat);

    const part = getParts().get(activePartKey);
    part.texture = tex;
    part.textureUrl = url;

    applyToActivePart();
    if (callback) callback();
  });

  return true;
}

// ===== Применить цвет к активной части =====
export function applyColor(hexString) {
  if (!activePartKey) return;
  const part = getParts().get(activePartKey);
  part.color = new THREE.Color(hexString);
  applyToActivePart();
}

// ===== Сброс всех частей к оригинальным материалам =====
export function resetAllMaterials() {
  const originals = getOriginalMaterials();
  for (const part of getParts().values()) {
    part.texture = null;
    part.textureUrl = null;
    part.color = new THREE.Color(0xffffff);
    part.meshes.forEach((mesh) => {
      const orig = originals.get(mesh);
      if (orig) mesh.material = orig.clone();
    });
  }
}
