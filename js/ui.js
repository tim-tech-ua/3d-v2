// js/ui.js
// Связывание интерфейса с логикой product page:
// выбор ткани / ножек / цвета ножек, пересчёт цены, переключение модели.

import { sceneApi } from './scene.js';
import { loadModel, loadComponent, removeComponent } from './model.js';
import { applyFabricToSource, applyColorToSource } from './materials.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const loadingEl = $('#loading');

// ===== Прайсинг (демо) =====
const BASE_PRICE = 50000;          // ₴, базовая цена изделия
const DISCOUNT_RATE = 0.27;        // 27 % скидка от «старой» цены

const STATE = {
  fabricUrl: null,
  fabricPrice: 0,
  fabricName: '',
  legsSrc: null,
  legsPrice: 0,
  legsName: ''
};

function formatPrice(n) {
  return new Intl.NumberFormat('uk-UA').format(n) + ' ₴';
}

function recalculatePrice() {
  const total = BASE_PRICE + STATE.fabricPrice + STATE.legsPrice;
  const oldPrice = Math.round(total / (1 - DISCOUNT_RATE));
  $('#priceCurrent').textContent = formatPrice(total);
  $('#priceOld').textContent = formatPrice(oldPrice);
}

function updateSummary() {
  const parts = [];
  if (STATE.fabricName) parts.push(STATE.fabricName);
  if (STATE.legsName)   parts.push(STATE.legsName);
  $('#variantSummary').textContent = parts.length ? parts.join(' · ') : 'Bjorn Andre';
}

// ===== Загрузка модели =====
function loadModelWithUI(path) {
  loadingEl.style.display = 'block';
  loadingEl.textContent = 'Завантаження моделі...';
  loadModel(path, sceneApi.modelHolder, {
    onLoaded: (parts, info) => {
      sceneApi.fitCameraToModel(info.sizeDiagonal);
      loadingEl.style.display = 'none';
      // Восстановить состояние конфигуратора на новой модели
      if (STATE.legsSrc)  loadComponentWithUI(STATE.legsSrc, 'legs', /*silent*/ true);
      if (STATE.fabricUrl) applyFabricToSource(null, STATE.fabricUrl);
    },
    onProgress: (percent) => {
      loadingEl.textContent = 'Завантаження: ' + percent.toFixed(0) + '%';
    },
    onError: () => {
      loadingEl.style.display = 'none';
      alert('Не вдалося завантажити модель: ' + path);
    }
  });
}

function loadComponentWithUI(path, slotName, silent) {
  if (!silent) {
    loadingEl.style.display = 'block';
    loadingEl.textContent = 'Завантаження...';
  }
  loadComponent(path, slotName, sceneApi.modelHolder, {
    onLoaded: () => { loadingEl.style.display = 'none'; },
    onError: () => {
      loadingEl.style.display = 'none';
      alert('Не вдалося завантажити: ' + path);
    }
  });
}

// ===== Регистрация обработчиков =====
export function initUI(defaultModelPath) {
  // ---- Переключение модели (миниатюры под канвасом)
  $$('#modelsList .thumb').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('#modelsList .thumb').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      loadModelWithUI(btn.dataset.model);
    });
  });

  // ---- Кнопки тканей (применяются к базе)
  $$('.fabric-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.fabric-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.fabricUrl   = btn.dataset.texture;
      STATE.fabricPrice = parseInt(btn.dataset.price, 10) || 0;
      STATE.fabricName  = btn.dataset.name || '';
      applyFabricToSource(null, STATE.fabricUrl);
      recalculatePrice();
      updateSummary();
    });
  });

  // ---- Колор-пикер для базы (тинт тканины)
  $('#baseColorPicker').addEventListener('input', (e) => {
    applyColorToSource(null, e.target.value);
  });

  // ---- Кнопки ножек
  $$('.leg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.leg-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const src = btn.dataset.src;
      STATE.legsSrc   = src || null;
      STATE.legsPrice = parseInt(btn.dataset.price, 10) || 0;
      STATE.legsName  = btn.dataset.name || '';
      if (src) {
        loadComponentWithUI(src, 'legs');
      } else {
        removeComponent('legs', sceneApi.modelHolder);
      }
      recalculatePrice();
      updateSummary();
    });
  });

  // ---- Готовые swatches для цвета ножек
  $$('#legsColorSwatches .swatch').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('#legsColorSwatches .swatch').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const color = btn.dataset.color;
      $('#legsColorPicker').value = color;
      applyColorToSource('legs', color);
    });
  });

  // ---- Произвольный цвет для ножек
  $('#legsColorPicker').addEventListener('input', (e) => {
    $$('#legsColorSwatches .swatch').forEach((b) => b.classList.remove('active'));
    applyColorToSource('legs', e.target.value);
  });

  // ---- «До кошика»
  $('#cartBtn').addEventListener('click', () => {
    const summary = 'Сваут\n' +
      'Тканина: ' + (STATE.fabricName || 'не вибрано') + '\n' +
      'Ніжки: '   + (STATE.legsName   || 'не вибрано') + '\n' +
      'Ціна: '    + $('#priceCurrent').textContent;
    alert('Додано до кошика:\n\n' + summary);
  });

  // ---- Стартовая загрузка
  loadModelWithUI(defaultModelPath);
  recalculatePrice();
  updateSummary();
}
