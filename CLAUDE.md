# 3D Configurator

Веб-конфигуратор мебели в духе Rolf Benz: 3D-модель, выбор ткани/цвета по частям, переключение быстрых сцен, сохранение скриншота.

---

## ⚠️ Правила работы с проектом (читать первым)

- **Без бандлеров.** Проект на нативных ES-модулях, Three.js грузится с CDN через `importmap` в `index.html`. **Не предлагать** Webpack / Vite / Rollup / esbuild. Это сознательный выбор — деплой простой статикой по FTP.
- **Three.js r160.** Версия зафиксирована в `importmap`. Если что-то требует более новой версии — сначала проверить, что нельзя обойтись возможностями r160.
- **Не работает по `file://`** — нужен HTTP/HTTPS из-за CORS для ES-модулей.
- **Правки локальные.** Каждый модуль имеет одну зону ответственности. Не переписывать модули целиком при мелких изменениях, не размывать границы между ними.
- **Новые ассеты — без правки JS.** Модели/ткани добавляются как файл в нужную папку + `<button data-*>` в `index.html`. JS подхватывает через делегирование. Если хочется тронуть JS — сначала проверить, что нельзя обойтись HTML.
- **Цель = быстрый, понятный, нативный код.** Лучше 20 строк vanilla JS, чем тащить зависимость.

---

## Tech stack

- **Three.js r160** (CDN unpkg.com через importmap)
- Чистый **HTML / CSS / JS**, ES-модули
- Без сборки, без `package.json` в проде
- Деплой: статика по FTP → `http://test.macsstore.com.ua/3d/`

---

## Структура

```
/configurator/
  index.html          # разметка, importmap, подключение CSS и main.js
  CLAUDE.md           # этот файл
  /css/styles.css
  /js/
    main.js           # bootstrap
    scene.js          # рендер, камера, освещение, пресеты сцен
    model.js          # загрузка GLB, парсинг частей, UV
    materials.js      # ткани и цвета на активную часть
    ui.js             # обработчики UI
  /models/            # *.glb
  /textures/          # *.png (бесшовные, квадратные, ≥1024px)
```

---

## Архитектура модулей

**`main.js`** — только bootstrap. Находит DOM-элементы вьюера, зовёт `initScene(canvas, viewerWrap)` и `initUI(DEFAULT_MODEL_PATH)`. Больше ничего.

**`scene.js`** — экспортирует синглтон `sceneApi` со ссылками на `scene`, `camera`, `renderer`, `controls`, `modelHolder` и методами: `applyScene`, `setShadowVisible`, `setShadowFloorY`, `fitCameraToModel`, `renderFrame`, `getCanvas`. Пресеты быстрых сцен (`studio`, `warm`, `cool`, `dark`, `sunset`) — наборы цветов фона/света/экспозиции. Окружение для отражений — `RoomEnvironment` через `PMREMGenerator`. Тень: `ShadowMaterial` + `DirectionalLight` с `castShadow`.

**`model.js`** — `loadModel(path, holder, callbacks)` грузит GLB через `GLTFLoader`, обходит дерево, для каждого `isMesh` вызывает `ensureUVs(c)` (нет UV → планарная XZ-проекция). Группирует mesh-и по имени материала в `Map<materialName, { name, meshes[], texture, color, textureUrl }>`. Центрирует модель и сохраняет `modelInitialHalfHeight`. Экспорт: `getParts()`, `getOriginalMaterials()`, `getInitialHalfHeight()`.

**`materials.js`** — хранит `activePartKey` и `textureRepeat`. Функции: `setActivePart(key)`, `getActivePartKey()`, `applyFabric(url, cb)` (грузит текстуру, ставит `RepeatWrapping`, при необходимости заменяет материал на `MeshStandardMaterial`), `applyColor(hex)`, `setTextureRepeat(value)`, `resetAllMaterials()`. Через `setOnActivePartChanged(cb)` уведомляет UI.

**`ui.js`** — все обработчики. Кнопки моделей → `loadModelWithUI(path)`: показать loader → `loadModel(...)` → по `onLoaded` собрать кнопки частей через `buildPartsUI(parts)` → `sceneApi.fitCameraToModel(...)` → `sceneApi.setShadowFloorY(-getInitialHalfHeight())`.

---

## Что уже работает

- 2 модели (`Bjorn Andre`, `Asset`), переключение кнопками
- Авторазбиение на «части» по уникальным материалам
- Активная часть → ткань (6 тканей) и/или цвет (HEX color picker)
- Слайдер `texture repeat` 0.2–10
- 5 быстрых сцен
- Toggle тени на полу
- Сохранение PNG текущего вида
- Адаптив <768px

---

## Известные quirks (важно при отладке)

- **`Bjorn_Andre.glb`** — один mesh, без UV. Авто-XZ-проекция ложится приемлемо. Не трогать.
- **`asset.glb`** — 4 mesh-а, 2 материала (`rolfbenzhome:11.520`, `rolfbenzhome:7044`), UV есть, но в нестандартном диапазоне. На некоторых частях текстура может выглядеть неправильно. Идеальный fix — переэкспорт в Blender со Smart UV Project.
- При применении текстуры материал заменяется на `MeshStandardMaterial`, если был другим. Это намеренно.
- При смене модели `dispose()` чистит геометрию и материалы старой — не ломать порядок вызовов.
- Linux-сервер чувствителен к регистру имён файлов. Все имена ассетов — точно как в HTML.

---

## Запуск

**Локально:**
```bash
npx serve              # любая папка-корень проекта
# или
python -m http.server 8000
```

**Прод:** FTP-загрузка папки `/configurator/` на хостинг. Текущий URL: `http://test.macsstore.com.ua/3d/index.html`

На сервере должен быть корректный MIME для `.js`. Если белый экран и в консоли ругань про module — в `.htaccess`:
```
AddType application/javascript .js
```

---

## Диагностика

| Симптом | Причина | Решение |
|---|---|---|
| Белый экран | 404 на JS или MIME неверный | F12 → Console; `.htaccess` с AddType |
| Модель не грузится | Опечатка или регистр имени | Проверить точное имя файла |
| Текстура есть, видно только цвет | Кривые UV в модели | Переэкспорт модели со Smart UV Project в Blender |

---

## Паттерн добавления ассетов

Оба типа ассетов добавляются одинаково — файл в папку + кнопка в `index.html`. JS их сам подхватывает по `data-*`.

```html
<!-- модель -->
<button class="btn full" data-model="models/имя.glb">Название</button>

<!-- ткань -->
<button class="fabric-btn"
        data-texture="textures/имя.png"
        style="background-image:url('textures/имя.png')"
        title="Название"></button>
```

Текстуры: бесшовные PNG/JPG, квадратные, ≥1024px.
