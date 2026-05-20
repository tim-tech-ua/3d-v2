// js/materials.js
// Применение тканей и цветов к частям модели — по источнику (база / слот).
// Загруженные текстуры проходят «realism pass»: анизотропная фильтрация,
// мипмапы, корректный colorSpace. Для тканей-вельветов — отдельный пресет
// материала (более низкий roughness, лёгкая ширь от env-map).

import * as THREE from 'three';
import { getParts, getOriginalMaterials } from './model.js';

const textureLoader = new THREE.TextureLoader();

let textureRepeat = 2.0;
let maxAnisotropy = 16; // обновляется из scene.js при первой загрузке

// ===== Realism: настройки материалов по типу ткани =====
const FABRIC_PRESETS = {
  // Обычная плотная ткань (большинство)
  standard: { roughness: 0.85, metalness: 0.0, envMapIntensity: 1.0 },
  // Велюр / вельвет — лёгкая шёлковистость и пониженный roughness
  velvet:   { roughness: 0.55, metalness: 0.05, envMapIntensity: 1.4 },
  // Гладкие фабрики (микрофибра, шёлк-подобные)
  smooth:   { roughness: 0.65, metalness: 0.02, envMapIntensity: 1.2 }
};

// ===== Realism: применить к свежезагруженной текстуре =====
function tuneTextureForRealism(tex) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;            // острые края на углах
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.repeat.set(textureRepeat, textureRepeat);
}

// ===== Максимальная анизотропия = capabilities.getMaxAnisotropy() =====
// Вызывается из scene.js после инициализации рендерера, чтобы текстуры
// получили реально доступный максимум GPU (обычно 16, на слабых картах меньше).
export function setMaxAnisotropy(value) {
  maxAnisotropy = value || 16;
}

// ===== Применить материал к mesh-ам part =====
function applyPartMaterial(part) {
  const preset = FABRIC_PRESETS[part.type || 'standard'] || FABRIC_PRESETS.standard;
  part.meshes.forEach((mesh) => {
    if (!mesh.material.isMeshStandardMaterial) {
      mesh.material = new THREE.MeshStandardMaterial();
    }
    mesh.material.map = part.texture || null;
    mesh.material.color = part.color;
    mesh.material.roughness = preset.roughness;
    mesh.material.metalness = preset.metalness;
    mesh.material.envMapIntensity = preset.envMapIntensity;
    mesh.material.needsUpdate = true;
  });
}

// ===== Применить ткань ко всем частям источника =====
// type: 'standard' | 'velvet' | 'smooth' — определяет пресет материала
export function applyFabricToSource(source, url, type, callback) {
  textureLoader.load(url, (tex) => {
    tuneTextureForRealism(tex);
    for (const part of getParts().values()) {
      if (part.source !== source) continue;
      part.texture = tex;
      part.textureUrl = url;
      part.type = type || 'standard';
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
    part.type = null;
    part.color = new THREE.Color(0xffffff);
    part.meshes.forEach((mesh) => {
      const orig = originals.get(mesh);
      if (orig) mesh.material = orig.clone();
    });
  }
}
