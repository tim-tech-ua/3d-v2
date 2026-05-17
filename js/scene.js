// js/scene.js
// Управление 3D-сценой: рендерер, камера, освещение, быстрые сцены

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ===== Пресеты быстрых сцен =====
const SCENES = {
  studio: { bg: 0xf0f0f0, dirColor: 0xffffff, dirIntensity: 1.2, ambColor: 0xffffff, ambIntensity: 0.4, exposure: 1.0 },
  warm:   { bg: 0xefe4d4, dirColor: 0xffdcb0, dirIntensity: 1.5, ambColor: 0xffdcb0, ambIntensity: 0.6, exposure: 1.1 },
  cool:   { bg: 0xdde8f0, dirColor: 0xcfe2ff, dirIntensity: 1.3, ambColor: 0xcfe2ff, ambIntensity: 0.5, exposure: 1.0 },
  dark:   { bg: 0x1a1a1f, dirColor: 0xffffff, dirIntensity: 2.0, ambColor: 0x222230, ambIntensity: 0.15, exposure: 0.9 },
  sunset: { bg: 0xf2b78a, dirColor: 0xff9050, dirIntensity: 1.8, ambColor: 0x553322, ambIntensity: 0.4, exposure: 1.2 }
};

// ===== Состояние модуля =====
let renderer, scene, camera, controls;
let pmrem, defaultEnv;
let dirLight, ambLight, shadowFloor;
let modelHolder;

// ===== Инициализация =====
export function initScene(canvas, viewerWrap) {
  const getSize = () => ({ w: viewerWrap.clientWidth, h: viewerWrap.clientHeight });

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  const s = getSize();
  renderer.setSize(s.w, s.h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Scene и стандартное окружение (RoomEnvironment) для базовых отражений
  scene = new THREE.Scene();
  pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  defaultEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = defaultEnv;

  // Camera + Controls
  camera = new THREE.PerspectiveCamera(45, s.w / s.h, 0.1, 1000);
  camera.position.set(3, 2, 4);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  // Запрет смотреть на модель снизу: камера может вращаться от макушки до горизонта,
  // но не опускаться ниже уровня цели.
  controls.maxPolarAngle = Math.PI / 2;

  // Освещение
  dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(8, 12, 6);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 50;
  dirLight.shadow.bias = -0.0005;
  scene.add(dirLight);

  ambLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambLight);

  // Видимый пол: белый матовый, принимает тени
  shadowFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 })
  );
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.receiveShadow = true;
  scene.add(shadowFloor);

  // Контейнер для модели
  modelHolder = new THREE.Group();
  scene.add(modelHolder);

  // Применяем стартовую сцену
  applyScene('studio');

  // Ресайз
  window.addEventListener('resize', () => {
    const sz = getSize();
    camera.aspect = sz.w / sz.h;
    camera.updateProjectionMatrix();
    renderer.setSize(sz.w, sz.h, false);
  });

  // Цикл рендера
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return sceneApi;
}

// ===== Применить быструю сцену =====
function applyScene(name) {
  const s = SCENES[name];
  if (!s) return;
  scene.background = new THREE.Color(s.bg);
  dirLight.color.setHex(s.dirColor);
  dirLight.intensity = s.dirIntensity;
  ambLight.color.setHex(s.ambColor);
  ambLight.intensity = s.ambIntensity;
  renderer.toneMappingExposure = s.exposure;
}

// ===== Тень/пол =====
// Тоггл отключает отбрасывание теней от direct-света. Пол при этом остаётся виден.
function setShadowVisible(visible) {
  dirLight.castShadow = visible;
}

function setShadowFloorY(y) {
  shadowFloor.position.y = y;
}

// Подгоняет пол под низ всего содержимого modelHolder (база + компоненты)
function fitShadowFloorToModel() {
  if (!modelHolder) return;
  const box = new THREE.Box3().setFromObject(modelHolder);
  if (!isFinite(box.min.y)) return;
  shadowFloor.position.y = box.min.y;
}

// Адаптация камеры под размер модели после её загрузки
function fitCameraToModel(modelSizeDiagonal) {
  camera.position.set(modelSizeDiagonal / 2, modelSizeDiagonal / 3, modelSizeDiagonal / 1.2);
  camera.lookAt(0, 0, 0);
  controls.target.set(0, 0, 0);
  controls.minDistance = modelSizeDiagonal / 4;
  controls.maxDistance = modelSizeDiagonal * 5;
  controls.update();

  // Подгонка теневой камеры
  const sh = modelSizeDiagonal / 1.2;
  dirLight.shadow.camera.left = -sh;
  dirLight.shadow.camera.right = sh;
  dirLight.shadow.camera.top = sh;
  dirLight.shadow.camera.bottom = -sh;
  dirLight.shadow.camera.updateProjectionMatrix();
}

// ===== Отрисовка одного кадра (для скриншота) =====
function renderFrame() {
  renderer.render(scene, camera);
}

function getCanvas() {
  return renderer.domElement;
}

// ===== Публичный API =====
export const sceneApi = {
  get scene() { return scene; },
  get camera() { return camera; },
  get renderer() { return renderer; },
  get controls() { return controls; },
  get modelHolder() { return modelHolder; },

  applyScene,
  setShadowVisible,
  setShadowFloorY,
  fitShadowFloorToModel,
  fitCameraToModel,
  renderFrame,
  getCanvas
};
