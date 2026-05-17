// js/ui.js
// Связывание интерфейса с логикой: обработчики кнопок и toggle

import { sceneApi } from './scene.js';
import { loadModel, loadComponent, removeComponent, getInitialHalfHeight } from './model.js';
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

// ===== Построение списка частей модели =====
// Сохраняет активную часть, если она ещё существует после изменения состава
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
  const currentActive = getActivePartKey();
  if (currentActive && parts.has(currentActive)) {
    setActivePart(currentActive);
  } else if (parts.size > 0) {
    setActivePart(parts.keys().next().value);
  } else {
    resetActivePart();
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
    $$('.fabric-btn').forEach((b) => b.classList.remove('active'));
  }
});

// ===== Загрузка базовой модели =====
function loadModelWithUI(path) {
  loadingEl.style.display = 'block';
  loadingEl.textContent = 'Загрузка модели...';
  resetActivePart();
  partsListEl.innerHTML = '';
  activePartLabel.textContent = '—';
  $$('#legsList .btn').forEach((b) => b.classList.remove('active'));

  loadModel(path, sceneApi.modelHolder, {
    onLoaded: (parts, info) => {
      sceneApi.fitCameraToModel(info.sizeDiagonal);
      sceneApi.setShadowFloorY(-getInitialHalfHeight());
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

// ===== Загрузка подкомпонента (ножки и т.п.) =====
function loadComponentWithUI(path, slotName) {
  loadingEl.style.display = 'block';
  loadingEl.textContent = 'Загрузка...';
  loadComponent(path, slotName, sceneApi.modelHolder, {
    onLoaded: (parts) => {
      buildPartsUI(parts);
      loadingEl.style.display = 'none';
    },
    onError: (err) => {
      loadingEl.style.display = 'none';
      alert('Не удалось загрузить компонент: ' + path);
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

  // ----- Кнопки слотов: ножки и т.п. -----
  // data-slot — имя слота (legs, arms, back...), data-src — путь к GLB
  // Пустой data-src = снять компонент со слота
  $$('#legsList .btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('#legsList .btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const slot = btn.dataset.slot || 'legs';
      const src = btn.dataset.src;
      if (src) {
        loadComponentWithUI(src, slot);
      } else {
        removeComponent(slot, sceneApi.modelHolder, (parts) => buildPartsUI(parts));
      }
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
