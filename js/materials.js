// js/materials.js
// Применение тканей и цветов к частям модели — по источнику (база / слот).
// Активная часть больше не используется — UI выбирает по типу источника напрямую.

import * as THREE from 'three';
import { getParts, getOriginalMaterials } from './model.js';

const textureLoader = new THREE.TextureLoader();

let textureRepeat = 2.0;

// ===== Внутреннее: применить текущее состояние part к mesh-ам =====
function applyPartMaterial(part) {
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

// ===== Применить ткань ко всем частям источника =====
// source: null для базы, slotName ('legs', ...) для подкомпонента
export function applyFabricToSource(source, url, callback) {
  textureLoader.load(url, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(textureRepeat, textureRepeat);
    for (const part of getParts().values()) {
      if (part.source !== source) continue;
      part.texture = tex;
      part.textureUrl = url;
      applyPartMaterial(part);
    }
    if (callback) callback();
  });
}

// ===== Применить цвет ко всем частям источника =====
export function applyColorToSource(source, hexString) {
  const baseColor = new THREE.Color(hexString);
  for (const part of getParts().values()) {
    if (part.source !== source) continue;
    part.color = baseColor.clone();
    applyPartMaterial(part);
  }
}

// ===== Масштаб повторения текстуры =====
export function setTextureRepeat(value) {
  textureRepeat = value;
  for (const part of getParts().values()) {
    if (part.texture) {
      part.texture.repeat.set(textureRepeat, textureRepeat);
      part.texture.needsUpdate = true;
    }
  }
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
