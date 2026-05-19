// catalog/view/javascript/configurator3d/js/scene.js
// Управление 3D-сценой: рендерер, камера, освещение, пресет «студия».

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const SCENE_STUDIO = {
  bg: 0xffffff,
  dirColor: 0xffffff, dirIntensity: 1.2,
  ambColor: 0xffffff, ambIntensity: 0.4,
  exposure: 1.0
};

let renderer, scene, camera, controls;
let pmrem, defaultEnv;
let dirLight, ambLight;
let modelHolder;

export function initScene(canvas, viewerWrap) {
  const getSize = () => ({ w: viewerWrap.clientWidth || 600, h: viewerWrap.clientHeight || 450 });

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  const s = getSize();
  renderer.setSize(s.w, s.h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = SCENE_STUDIO.exposure;

  scene = new THREE.Scene();
  pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  defaultEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = defaultEnv;
  scene.background = new THREE.Color(SCENE_STUDIO.bg);

  camera = new THREE.PerspectiveCamera(45, s.w / s.h, 0.1, 1000);
  camera.position.set(3, 2, 4);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2;

  dirLight = new THREE.DirectionalLight(SCENE_STUDIO.dirColor, SCENE_STUDIO.dirIntensity);
  dirLight.position.set(8, 12, 6);
  scene.add(dirLight);

  ambLight = new THREE.AmbientLight(SCENE_STUDIO.ambColor, SCENE_STUDIO.ambIntensity);
  scene.add(ambLight);

  modelHolder = new THREE.Group();
  scene.add(modelHolder);

  window.addEventListener('resize', () => {
    const sz = getSize();
    camera.aspect = sz.w / sz.h;
    camera.updateProjectionMatrix();
    renderer.setSize(sz.w, sz.h, false);
  });

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return sceneApi;
}

function fitCameraToModel(modelSizeDiagonal) {
  camera.position.set(modelSizeDiagonal / 2, modelSizeDiagonal / 3, modelSizeDiagonal / 1.2);
  camera.lookAt(0, 0, 0);
  controls.target.set(0, 0, 0);
  controls.minDistance = modelSizeDiagonal / 4;
  controls.maxDistance = modelSizeDiagonal * 5;
  controls.update();
}

function renderFrame() { renderer.render(scene, camera); }
function getCanvas() { return renderer.domElement; }

export const sceneApi = {
  get scene() { return scene; },
  get camera() { return camera; },
  get renderer() { return renderer; },
  get controls() { return controls; },
  get modelHolder() { return modelHolder; },
  fitCameraToModel,
  renderFrame,
  getCanvas
};
