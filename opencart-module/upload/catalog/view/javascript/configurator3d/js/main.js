// catalog/view/javascript/configurator3d/js/main.js
// Точка входа конфигуратора в OpenCart.

import { initScene } from './scene.js';
import { initUI } from './ui.js';

const DEFAULT_MODEL = 'catalog/view/javascript/configurator3d/models/ImageToStl.com_Bjorn_Andre_obj.glb';

const canvas = document.getElementById('cfg3d-viewer');
const viewerWrap = document.getElementById('cfg3d-viewer-wrap');

if (canvas && viewerWrap) {
  initScene(canvas, viewerWrap);
  initUI(DEFAULT_MODEL);
}
