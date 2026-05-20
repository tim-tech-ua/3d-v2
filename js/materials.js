// js/materials.js
// Применение тканей и цветов к частям модели. Категоризация по имени материала:
// material name содержит legs/frame/metal/support → категория "legs", иначе "body".
// Это работает и когда ножки приходят отдельным компонентом (source='legs'),
// и когда они «вшиты» в базовый GLB как отдельный материал.

import * as THREE from 'three';
import { getParts, getOriginalMaterials } from './model.js';

const textureLoader = new THREE.TextureLoader();

let textureRepeat = 2.0;
let maxAnisotropy = 16;

const FABRIC_PRESETS = {
  standard: { roughness: 0.85, metalness: 0.0,  envMapIntensity: 1.0 },
  velvet:   { roughness: 0.55, metalness: 0.05, envMapIntensity: 1.4 },
  smooth:   { roughness: 0.65, metalness: 0.02, envMapIntensity: 1.2 }
};

const LEGS_NAME_RE = /legs?|frame|metal|support|опор|ножк/i;

function isLegsPart(part) {
  if (part.source === 'legs') return true;            // отдельный компонент
  if (LEGS_NAME_RE.test(part.name || '')) return true; // материал назван legs/frame и т.п.
  return false;
}

function tuneTextureForRealism(tex) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.repeat.set(textureRepeat, textureRepeat);
}

export function setMaxAnisotropy(value) {
  maxAnisotropy = value || 16;
}

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

// ===== Ткань — только обивка (body) =====
export function applyFabricToBody(url, type, callback) {
  textureLoader.load(url, (tex) => {
    tuneTextureForRealism(tex);
    for (const part of getParts().values()) {
      if (isLegsPart(part)) continue;
      part.texture = tex;
      part.textureUrl = url;
      part.type = type || 'standard';
      applyPartMaterial(part);
    }
    if (callback) callback();
  });
}

// ===== Цвет — только обивка =====
export function applyColorToBody(hexString) {
  const c = new THREE.Color(hexString);
  for (const part of getParts().values()) {
    if (isLegsPart(part)) continue;
    part.color = c.clone();
    applyPartMaterial(part);
  }
}

// ===== Цвет — только ножки =====
export function applyColorToLegs(hexString) {
  const c = new THREE.Color(hexString);
  for (const part of getParts().values()) {
    if (!isLegsPart(part)) continue;
    part.color = c.clone();
    applyPartMaterial(part);
  }
}

export function setTextureRepeat(value) {
  textureRepeat = value;
  for (const part of getParts().values()) {
    if (part.texture) {
      part.texture.repeat.set(textureRepeat, textureRepeat);
      part.texture.needsUpdate = true;
    }
  }
}

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
