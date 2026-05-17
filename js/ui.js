// js/ui.js
// Связывание интерфейса с логикой: обработчики кнопок и toggle

import { sceneApi } from './scene.js';
import { loadModel, loadComponent, removeComponent } from './model.js';
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
const colorPicker = $('#colorPicker');
const colorValueEl = $('#colorValue');
const loadingEl = $('#loading');

// Подписи для слотов в списке частей
const SOURCE_LABELS = { base: 'Основа', legs: 'Ножки' };

// ===== Построение списка частей модели =====
// Имена частей берутся из их источника (база → "Основа", слот legs → "Ножки").
// Если в одном источнике несколько частей — добавляется номер.
// Сохраняет активную часть, если она ещё существует после изменения состава.
function buildPartsUI(parts) {
  partsListEl.innerHTML = '';

  // Сгруппировать по source с сохранением порядка вставки
  const grouped = new Map();
  for (const [key, part] of parts.entries()) {
    const src = part.source || 'base';
    if (!grouped.has(src)) grouped.set(src, []);
    grouped.get(src).push([key, part]);
  }

  for (const [source, items] of grouped) {
    const label = SOURCE_LABELS[source] || source;
    items.forEach(([key, part], idx) => {
      const btn = document.createElement('button');
      btn.className = 'btn full';
      btn.textContent = items.length > 1 ? `${label} ${idx + 1}` : label;
      btn.title = key;
      btn.dataset.key = key;
      btn.addEventListener('click', () => setActivePart(key));
      partsListEl.appendChild(btn);
    });
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
    const hex = '#' + part.color.getHexString().toUpperCase();
    colorPicker.value = hex;
    colorValueEl.textContent = hex;
    $$('.fabric-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.texture === part.textureUrl);
    });
  } else {
    $$('.fabric-btn').forEach((b) => b.classList.remove('active'));
  }
});

// ===== Загрузка базовой модели =====
function loadModelWithUI(path) {
  loadingEl.style.display = 'block';
  loadingEl.textContent = 'Загрузка модели...';
  resetActivePart();
  partsListEl.innerHTML = '';
  $$('#legsList .btn').forEach((b) => b.classList.remove('active'));

  loadModel(path, sceneApi.modelHolder, {
    onLoaded: (parts, info) => {
      sceneApi.fitCameraToModel(info.sizeDiagonal);
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
