// js/ui.js
// Связывание UI product page: карусель фото / 3D-режим, конфигуратор и прайсинг.

import { sceneApi } from './scene.js';
import { loadModel, loadComponent, removeComponent } from './model.js';
import { applyFabricToBody, applyColorToBody, applyColorToLegs } from './materials.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const loadingEl = $('#loading');
const viewerArea = $('.viewer-area');

// ===== Прайсинг (демо) =====
const BASE_PRICE = 50000;
const DISCOUNT_RATE = 0.27;

const STATE = {
  fabricUrl: null,
  fabricPrice: 0,
  fabricName: '',
  fabricType: 'standard',
  legsSrc: null,
  legsPrice: 0,
  legsName: '',
  modelName: 'Bjorn Andre',
  is360: false,
  carouselIndex: 0
};

const SLIDE_COUNT = 4;

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
  const parts = [STATE.modelName];
  if (STATE.fabricName) parts.push(STATE.fabricName);
  if (STATE.legsName)   parts.push(STATE.legsName);
  $('#variantSummary').textContent = parts.join(' · ');
}

// ===== Переключение режимов вьюера =====
function set360Mode(enabled) {
  STATE.is360 = enabled;
  viewerArea.classList.toggle('mode-3d', enabled);
  $('#toggle360').classList.toggle('active', enabled);
  if (enabled) {
    // снять подсветку с фото-миниатюр
    $$('.photo-thumb').forEach((b) => b.classList.remove('active'));
  } else {
    // вернуться к текущему фото
    $$('.photo-thumb').forEach((b, i) => {
      b.classList.toggle('active', i === STATE.carouselIndex);
    });
  }
}

// Гарантируем, что 3D-режим активен (вызывается при любом изменении конфигурации)
function ensure360() {
  if (!STATE.is360) set360Mode(true);
}

// ===== Карусель =====
function showSlide(idx) {
  STATE.carouselIndex = ((idx % SLIDE_COUNT) + SLIDE_COUNT) % SLIDE_COUNT;
  $$('#carouselSlides .slide').forEach((s, i) => {
    s.classList.toggle('active', i === STATE.carouselIndex);
  });
  $$('#carouselDots .dot').forEach((d, i) => {
    d.classList.toggle('active', i === STATE.carouselIndex);
  });
  if (!STATE.is360) {
    $$('.photo-thumb').forEach((b, i) => {
      b.classList.toggle('active', i === STATE.carouselIndex);
    });
  }
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
      if (STATE.legsSrc)   loadComponentWithUI(STATE.legsSrc, 'legs', /*silent*/ true);
      if (STATE.fabricUrl) applyFabricToBody(STATE.fabricUrl, STATE.fabricType);
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
  // ---- Миниатюры фото
  $$('.photo-thumb').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10) || 0;
      set360Mode(false);
      showSlide(idx);
    });
  });

  // ---- Кнопка 360°
  $('#toggle360').addEventListener('click', () => {
    set360Mode(!STATE.is360);
  });

  // ---- Карусель: стрелки и точки
  $('#carouselPrev').addEventListener('click', () => showSlide(STATE.carouselIndex - 1));
  $('#carouselNext').addEventListener('click', () => showSlide(STATE.carouselIndex + 1));
  $$('#carouselDots .dot').forEach((dot, i) => {
    dot.addEventListener('click', () => showSlide(i));
  });

  // ---- Карточки моделей в Колекції
  $$('.collection-card.model-card').forEach((card) => {
    card.addEventListener('click', () => {
      $$('.collection-card.model-card').forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
      STATE.modelName = card.dataset.name || '';
      ensure360();
      loadModelWithUI(card.dataset.model);
      updateSummary();
    });
  });

  // ---- Ткани (применяются к базе)
  $$('.fabric-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      ensure360();
      $$('.fabric-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.fabricUrl   = btn.dataset.texture;
      STATE.fabricPrice = parseInt(btn.dataset.price, 10) || 0;
      STATE.fabricName  = btn.dataset.name || '';
      STATE.fabricType  = btn.dataset.type || 'standard';
      applyFabricToBody(STATE.fabricUrl, STATE.fabricType);
      recalculatePrice();
      updateSummary();
    });
  });

  // ---- Колор-пикер для базы
  $('#baseColorPicker').addEventListener('input', (e) => {
    ensure360();
    applyColorToSource(null, e.target.value);
  });

  // ---- Ножки
  $$('.leg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      ensure360();
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

  // ---- Swatches цвета ножек
  $$('#legsColorSwatches .swatch').forEach((btn) => {
    btn.addEventListener('click', () => {
      ensure360();
      $$('#legsColorSwatches .swatch').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const color = btn.dataset.color;
      $('#legsColorPicker').value = color;
      applyColorToLegs(color);
    });
  });

  // ---- Произвольный цвет ножек
  $('#legsColorPicker').addEventListener('input', (e) => {
    ensure360();
    $$('#legsColorSwatches .swatch').forEach((b) => b.classList.remove('active'));
    applyColorToLegs(e.target.value);
  });

  // ---- «До кошика»
  $('#cartBtn').addEventListener('click', () => {
    const summary = 'Сваут (' + STATE.modelName + ')\n' +
      'Тканина: ' + (STATE.fabricName || 'не вибрано') + '\n' +
      'Ніжки: '   + (STATE.legsName   || 'не вибрано') + '\n' +
      'Ціна: '    + $('#priceCurrent').textContent;
    alert('Додано до кошика:\n\n' + summary);
  });

  // ---- Стартовая загрузка (3D готов, но карусель остаётся активной)
  loadModelWithUI(defaultModelPath);
  recalculatePrice();
  updateSummary();
}
