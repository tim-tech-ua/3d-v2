// js/ui.js
// Связывание интерфейса с логикой: обработчики кнопок, слайдеров, toggle

import { sceneApi } from './scene.js';
import { loadModel, applyTransformToHolder, getInitialHalfHeight } from './model.js';
import {
  setActivePart, getActivePartKey, resetActivePart,
  setOnActivePartChanged,
  applyFabric, applyColor,
  setTextureRepeat,
  resetAllMaterials
} from './materials.js';

// ===== DOM-элементы =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const partsListEl = $('#partsList');
const activePartLabel = $('#activePartLabel');
const colorPicker = $('#colorPicker');
const colorValueEl = $('#colorValue');
const loadingEl = $('#loading');

// ===== Состояние трансформации модели =====
const transform = { scale: 1, x: 0, y: 0, z: 0, rotY: 0 };

function applyTransform() {
  applyTransformToHolder(sceneApi.modelHolder, transform);
  // Двигаем теневой пол под низ модели
  sceneApi.setShadowFloorY(transform.y - getInitialHalfHeight() * transform.scale);
}

// ===== Построение списка частей модели =====
function buildPartsUI(parts) {
  partsListEl.innerHTML = '';
  let index = 1;
  for (const [key] of parts.entries()) {
    const btn = document.createElement('button');
    btn.className = 'btn full';
    btn.textContent = 'Часть ' + index;
    btn.title = key;
    btn.dataset.key = key;
    btn.addEventListener('click', () => setActivePart(key));
    partsListEl.appendChild(btn);
    index++;
  }
  if (parts.size > 0) {
    const firstKey = parts.keys().next().value;
    setActivePart(firstKey);
  }
}

// ===== Реакция UI на смену активной части =====
setOnActivePartChanged((key, part) => {
  partsListEl.querySelectorAll('.btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.key === key);
  });
  if (part) {
    activePartLabel.textContent = part.name;
    const hex = '#' + part.color.getHexString().toUpperCase();
    colorPicker.value = hex;
    colorValueEl.textContent = hex;
    $$('.fabric-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.texture === part.textureUrl);
    });
  } else {
    activePartLabel.textContent = '—';
  }
});

// ===== Сброс UI трансформации =====
function resetTransformUI() {
  transform.scale = 1; transform.x = 0; transform.y = 0; transform.z = 0; transform.rotY = 0;
  $('#scaleSlider').value = 1; $('#scaleVal').textContent = '1.00';
  $('#posXSlider').value = 0;  $('#posXVal').textContent = '0.00';
  $('#posYSlider').value = 0;  $('#posYVal').textContent = '0.00';
  $('#posZSlider').value = 0;  $('#posZVal').textContent = '0.00';
  $('#rotYSlider').value = 0;  $('#rotYVal').textContent = '0°';
  applyTransform();
}

// ===== Загрузка модели =====
function loadModelWithUI(path) {
  loadingEl.style.display = 'block';
  loadingEl.textContent = 'Загрузка модели...';
  resetActivePart();
  partsListEl.innerHTML = '';
  activePartLabel.textContent = '—';

  loadModel(path, sceneApi.modelHolder, {
    onLoaded: (parts, info) => {
      sceneApi.fitCameraToModel(info.sizeDiagonal);
      resetTransformUI();
      buildPartsUI(parts);
      loadingEl.style.display = 'none';
    },
    onProgress: (percent) => {
      loadingEl.textContent = 'Загрузка: ' + percent.toFixed(0) + '%';
    },
    onError: (err) => {
      loadingEl.style.display = 'none';
      alert('Не удалось загрузить модель: ' + path);
    }
  });
}

// ===== Регистрация всех обработчиков =====
export function initUI(defaultModelPath) {
  // ----- Кнопки выбора модели -----
  $$('#modelsList .btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('#modelsList .btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      loadModelWithUI(btn.dataset.model);
    });
  });

  // ----- Кнопки тканей -----
  $$('.fabric-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!getActivePartKey()) {
        alert('Сначала выберите часть модели');
        return;
      }
      $$('.fabric-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      applyFabric(btn.dataset.texture);
    });
  });

  // ----- Color picker -----
  colorPicker.addEventListener('input', (e) => {
    const hex = e.target.value.toUpperCase();
    colorValueEl.textContent = hex;
    applyColor(e.target.value);
  });

  // ----- Масштаб текстуры -----
  $('#texScaleSlider').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    $('#texScaleVal').textContent = v.toFixed(1);
    setTextureRepeat(v);
  });

  // ----- Быстрые сцены -----
  $$('#sceneList .btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('#sceneList .btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      sceneApi.applyScene(btn.dataset.scene);
    });
  });

  // ----- Тень toggle -----
  const shadowToggle = $('#shadowToggle');
  shadowToggle.addEventListener('click', () => {
    shadowToggle.classList.toggle('on');
    sceneApi.setShadowVisible(shadowToggle.classList.contains('on'));
  });

  // ----- HDRI -----
  $$('#hdriList .btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('active')) {
        // Повторное нажатие — выключить HDRI
        btn.classList.remove('active');
        sceneApi.clearHDRI();
        return;
      }
      $$('#hdriList .btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      sceneApi.applyHDRI(btn.dataset.hdri, btn.dataset.name);
    });
  });

  // ----- Фон HDRI toggle -----
  const hdriBgToggle = $('#hdriBgToggle');
  hdriBgToggle.addEventListener('click', () => {
    hdriBgToggle.classList.toggle('on');
    sceneApi.setHdriBackgroundVisible(hdriBgToggle.classList.contains('on'));
  });

  // ----- Поворот окружения -----
  $('#envRotSlider').addEventListener('input', (e) => {
    const deg = parseFloat(e.target.value);
    $('#envRotVal').textContent = e.target.value + '°';
    sceneApi.applyEnvRotation(deg * Math.PI / 180);
  });

  // ----- Трансформация модели -----
  $('#scaleSlider').addEventListener('input', (e) => {
    transform.scale = parseFloat(e.target.value);
    $('#scaleVal').textContent = transform.scale.toFixed(2);
    applyTransform();
  });
  $('#posXSlider').addEventListener('input', (e) => {
    transform.x = parseFloat(e.target.value);
    $('#posXVal').textContent = transform.x.toFixed(2);
    applyTransform();
  });
  $('#posYSlider').addEventListener('input', (e) => {
    transform.y = parseFloat(e.target.value);
    $('#posYVal').textContent = transform.y.toFixed(2);
    applyTransform();
  });
  $('#posZSlider').addEventListener('input', (e) => {
    transform.z = parseFloat(e.target.value);
    $('#posZVal').textContent = transform.z.toFixed(2);
    applyTransform();
  });
  $('#rotYSlider').addEventListener('input', (e) => {
    transform.rotY = parseFloat(e.target.value) * Math.PI / 180;
    $('#rotYVal').textContent = e.target.value + '°';
    applyTransform();
  });
  $('#resetTransformBtn').addEventListener('click', resetTransformUI);

  // ----- FOV камеры -----
  $('#fovSlider').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    $('#fovVal').textContent = e.target.value + '°';
    sceneApi.setCameraFOV(v);
  });

  // ----- Сброс материалов -----
  $('#resetBtn').addEventListener('click', () => {
    resetAllMaterials();
    colorPicker.value = '#ffffff';
    colorValueEl.textContent = '#FFFFFF';
    $$('.fabric-btn').forEach((b) => b.classList.remove('active'));
  });

  // ----- Сохранение изображения -----
  $('#saveBtn').addEventListener('click', () => {
    sceneApi.renderFrame();
    const dataURL = sceneApi.getCanvas().toDataURL('image/png');
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.download = 'configurator-' + timestamp + '.png';
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // ----- Стартовая загрузка модели -----
  loadModelWithUI(defaultModelPath);
}
