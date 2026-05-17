// js/main.js
// Точка входа: инициализация сцены и UI

import { initScene } from './scene.js';
import { initUI } from './ui.js';

// Стартовая модель
const DEFAULT_MODEL = 'models/ImageToStl.com_Bjorn_Andre_obj.glb';

// Находим элементы вьюера
const canvas = document.getElementById('viewer');
const viewerWrap = document.getElementById('viewer-wrap');

// Запускаем 3D-сцену
initScene(canvas, viewerWrap);

// Подключаем интерфейс и запускаем загрузку стартовой модели
initUI(DEFAULT_MODEL);
