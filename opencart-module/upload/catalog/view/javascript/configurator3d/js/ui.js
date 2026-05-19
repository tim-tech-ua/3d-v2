// catalog/view/javascript/configurator3d/js/ui.js
// UI конфигуратора в OpenCart: карусель фото / 3D-режим, выбор опций, расчёт доплат.

import { sceneApi } from './scene.js';
import { loadModel, loadComponent, removeComponent } from './model.js';
import { applyFabricToSource, applyColorToSource } from './materials.js';

// Все запросы scope-им внутри секции .cfg3d, чтобы случайно не задеть тему
const root = document.querySelector('.cfg3d');
const $  = (sel) => root ? root.querySelector(sel)  : document.querySelector(sel);
const $$ = (sel) => root ? root.querySelectorAll(sel) : document.querySelectorAll(sel);

const loadingEl = document.getElementById('cfg3d-loading');
const viewerArea = root ? root.querySelector('.cfg3d-viewer-area') : null;

const STATE = {
  fabricUrl: null,
  fabricPrice: 0,
  fabricName: '',
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

function recalculateExtras() {
  const extras = STATE.fabricPrice + STATE.legsPrice;
  const el = document.getElementById('cfg3dExtrasPrice');
  if (el) el.textContent = (extras > 0 ? '+' : '') + formatPrice(extras);
}

function set360Mode(enabled) {
  STATE.is360 = enabled;
  if (viewerArea) viewerArea.classList.toggle('mode-3d', enabled);
  const toggle = document.getElementById('cfg3dToggle360');
  if (toggle) toggle.classList.toggle('active', enabled);
  if (enabled) {
    $$('.cfg3d-thumb.photo-thumb').forEach((b) => b.classList.remove('active'));
  } else {
    $$('.cfg3d-thumb.photo-thumb').forEach((b, i) => {
      b.classList.toggle('active', i === STATE.carouselIndex);
    });
  }
}

function ensure360() {
  if (!STATE.is360) set360Mode(true);
}

function showSlide(idx) {
  STATE.carouselIndex = ((idx % SLIDE_COUNT) + SLIDE_COUNT) % SLIDE_COUNT;
  $$('#cfg3dCarouselSlides .cfg3d-slide').forEach((s, i) => {
    s.classList.toggle('active', i === STATE.carouselIndex);
  });
  $$('#cfg3dCarouselDots .cfg3d-dot').forEach((d, i) => {
    d.classList.toggle('active', i === STATE.carouselIndex);
  });
  if (!STATE.is360) {
    $$('.cfg3d-thumb.photo-thumb').forEach((b, i) => {
      b.classList.toggle('active', i === STATE.carouselIndex);
    });
  }
}

function loadModelWithUI(path) {
  if (loadingEl) { loadingEl.style.display = 'block'; loadingEl.textContent = 'Завантаження моделі…'; }
  loadModel(path, sceneApi.modelHolder, {
    onLoaded: (parts, info) => {
      sceneApi.fitCameraToModel(info.sizeDiagonal);
      if (loadingEl) loadingEl.style.display = 'none';
      if (STATE.legsSrc)   loadComponentWithUI(STATE.legsSrc, 'legs', true);
      if (STATE.fabricUrl) applyFabricToSource(null, STATE.fabricUrl);
    },
    onProgress: (percent) => {
      if (loadingEl) loadingEl.textContent = 'Завантаження: ' + percent.toFixed(0) + '%';
    },
    onError: () => {
      if (loadingEl) loadingEl.style.display = 'none';
      console.error('Не вдалося завантажити модель: ' + path);
    }
  });
}

function loadComponentWithUI(path, slotName, silent) {
  if (!silent && loadingEl) { loadingEl.style.display = 'block'; loadingEl.textContent = 'Завантаження…'; }
  loadComponent(path, slotName, sceneApi.modelHolder, {
    onLoaded: () => { if (loadingEl) loadingEl.style.display = 'none'; },
    onError: () => {
      if (loadingEl) loadingEl.style.display = 'none';
      console.error('Не вдалося завантажити: ' + path);
    }
  });
}

export function initUI(defaultModelPath) {
  // ---- Фото-миниатюры
  $$('.cfg3d-thumb.photo-thumb').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10) || 0;
      set360Mode(false);
      showSlide(idx);
    });
  });

  // ---- 360°
  const toggle360 = document.getElementById('cfg3dToggle360');
  if (toggle360) toggle360.addEventListener('click', () => set360Mode(!STATE.is360));

  // ---- Карусель
  const prev = document.getElementById('cfg3dCarouselPrev');
  const next = document.getElementById('cfg3dCarouselNext');
  if (prev) prev.addEventListener('click', () => showSlide(STATE.carouselIndex - 1));
  if (next) next.addEventListener('click', () => showSlide(STATE.carouselIndex + 1));
  $$('#cfg3dCarouselDots .cfg3d-dot').forEach((d, i) => {
    d.addEventListener('click', () => showSlide(i));
  });

  // ---- Карточки моделей в коллекции
  $$('.cfg3d-collection-card.model-card').forEach((card) => {
    card.addEventListener('click', () => {
      $$('.cfg3d-collection-card.model-card').forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
      STATE.modelName = card.dataset.name || '';
      ensure360();
      loadModelWithUI(card.dataset.model);
    });
  });

  // ---- Ткани
  $$('.cfg3d-fabric-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      ensure360();
      $$('.cfg3d-fabric-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.fabricUrl   = btn.dataset.texture;
      STATE.fabricPrice = parseInt(btn.dataset.price, 10) || 0;
      STATE.fabricName  = btn.dataset.name || '';
      applyFabricToSource(null, STATE.fabricUrl);
      recalculateExtras();
    });
  });

  // ---- Цвет тканины
  const baseColorPicker = document.getElementById('cfg3dBaseColorPicker');
  if (baseColorPicker) baseColorPicker.addEventListener('input', (e) => {
    ensure360();
    applyColorToSource(null, e.target.value);
  });

  // ---- Ножки
  $$('.cfg3d-leg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      ensure360();
      $$('.cfg3d-leg-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const src = btn.dataset.src;
      STATE.legsSrc   = src || null;
      STATE.legsPrice = parseInt(btn.dataset.price, 10) || 0;
      STATE.legsName  = btn.dataset.name || '';
      if (src) loadComponentWithUI(src, 'legs');
      else     removeComponent('legs', sceneApi.modelHolder);
      recalculateExtras();
    });
  });

  // ---- Swatches цвета ножек
  $$('#cfg3dLegsColorSwatches .cfg3d-swatch').forEach((btn) => {
    btn.addEventListener('click', () => {
      ensure360();
      $$('#cfg3dLegsColorSwatches .cfg3d-swatch').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const color = btn.dataset.color;
      const picker = document.getElementById('cfg3dLegsColorPicker');
      if (picker) picker.value = color;
      applyColorToSource('legs', color);
    });
  });

  // ---- Произвольный цвет ножек
  const legsColorPicker = document.getElementById('cfg3dLegsColorPicker');
  if (legsColorPicker) legsColorPicker.addEventListener('input', (e) => {
    ensure360();
    $$('#cfg3dLegsColorSwatches .cfg3d-swatch').forEach((b) => b.classList.remove('active'));
    applyColorToSource('legs', e.target.value);
  });

  // ---- Стартовая загрузка
  loadModelWithUI(defaultModelPath);
  recalculateExtras();
}
