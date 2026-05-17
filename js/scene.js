// js/scene.js
// Управление 3D-сценой: рендерер, камера, освещение, HDRI, быстрые сцены

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// ===== Пресеты быстрых сцен (без HDRI) =====
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
let modelHolder; // Group, в который кладётся загруженная модель

let currentSceneName = 'studio';
let currentHDRI = null;            // PMREM-текстура для environment
let currentHDRIBackground = null;  // оригинал для фона
let showHdriBackground = false;
let envRotationRad = 0;

const rgbeLoader = new RGBELoader();

// ===== Инициализация =====
export function initScene(canvas, viewerWrap, loadingEl) {
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

  // Теневой пол
  shadowFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.ShadowMaterial({ opacity: 0.3 })
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

  // Сохраняем ссылку на loadingEl для HDRI
  sceneApi._loadingEl = loadingEl;

  return sceneApi;
}

// ===== Применить быструю сцену =====
function applyScene(name) {
  const s = SCENES[name];
  if (!s) return;
  currentSceneName = name;
  if (!currentHDRI || !showHdriBackground) {
    scene.background = new THREE.Color(s.bg);
  }
  dirLight.color.setHex(s.dirColor);
  dirLight.intensity = s.dirIntensity;
  ambLight.color.setHex(s.ambColor);
  ambLight.intensity = s.ambIntensity;
  renderer.toneMappingExposure = s.exposure;
}

// ===== Загрузить HDRI =====
function applyHDRI(path, name) {
  const loadingEl = sceneApi._loadingEl;
  if (loadingEl) {
    loadingEl.style.display = 'block';
    loadingEl.textContent = 'Загрузка HDRI: ' + name + '...';
  }
  rgbeLoader.load(path, (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    currentHDRIBackground = texture;
    const pmremTexture = pmrem.fromEquirectangular(texture).texture;
    currentHDRI = pmremTexture;
    scene.environment = pmremTexture;
    if (showHdriBackground) scene.background = texture;
    applyEnvRotation(envRotationRad);
    if (loadingEl) loadingEl.style.display = 'none';
  }, undefined, (err) => {
    console.error('Ошибка загрузки HDRI:', err);
    if (loadingEl) loadingEl.style.display = 'none';
    alert('Не удалось загрузить HDRI: ' + path);
  });
}

function clearHDRI() {
  scene.environment = defaultEnv;
  currentHDRI = null;
  currentHDRIBackground = null;
  applyScene(currentSceneName);
}

// ===== Управление фоном HDRI =====
function setHdriBackgroundVisible(visible) {
  showHdriBackground = visible;
  if (showHdriBackground && currentHDRIBackground) {
    scene.background = currentHDRIBackground;
  } else {
    const s = SCENES[currentSceneName];
    scene.background = new THREE.Color(s.bg);
  }
}

// ===== Поворот HDRI =====
function applyEnvRotation(rad) {
  envRotationRad = rad;
  // Поддерживается с three.js r163+, но не критично в r160 — используем безопасное присваивание
  if ('environmentRotation' in scene) scene.environmentRotation = new THREE.Euler(0, rad, 0);
  if ('backgroundRotation' in scene)  scene.backgroundRotation  = new THREE.Euler(0, rad, 0);
}

// ===== Тень на полу =====
function setShadowVisible(visible) {
  shadowFloor.visible = visible;
}

function setShadowFloorY(y) {
  shadowFloor.position.y = y;
}

// ===== Камера =====
function setCameraFOV(fovDeg) {
  camera.fov = fovDeg;
  camera.updateProjectionMatrix();
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
  // объекты
  get scene() { return scene; },
  get camera() { return camera; },
  get renderer() { return renderer; },
  get controls() { return controls; },
  get modelHolder() { return modelHolder; },

  // методы
  applyScene,
  applyHDRI,
  clearHDRI,
  setHdriBackgroundVisible,
  applyEnvRotation,
  setShadowVisible,
  setShadowFloorY,
  setCameraFOV,
  fitCameraToModel,
  renderFrame,
  getCanvas,

  // внутреннее (loading element для HDRI)
  _loadingEl: null
};
