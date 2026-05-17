# 3D Configurator

Веб-конфигуратор мебели в духе Rolf Benz: 3D-модель из базы + сменных подкомпонентов (например, ножек), выбор ткани/цвета по частям, переключение быстрых сцен, сохранение скриншота.

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

**`model.js`** — поддерживает базовую модель + подкомпоненты по слотам (например, `legs`).
- `loadModel(path, holder, callbacks)` грузит базу. Чтобы компоненты, добавленные позже, автоматически совпадали по координатам, центрирование делается сдвигом `holder.position`, а не самой модели. Перед загрузкой удаляет старую базу и все её компоненты.
- `loadComponent(path, slotName, holder, callbacks)` грузит подкомпонент в указанный слот. Если в слоте уже был компонент — удаляется. Файл компонента должен быть авторен в Blender в той же системе координат, что и база.
- `removeComponent(slotName, holder, callback)` снимает подкомпонент со слота.
- Все mesh-и (база и компоненты) попадают в общую мапу `parts: Map<partKey, { name, meshes[], texture, color, textureUrl, source }>`. У базовых частей `source = null`, у компонентных — `source = slotName`. Это нужно при удалении слота, чтобы вычистить только его части. `partKey` базы — имя материала; компонента — `slotName + ':' + материал`, чтобы не сливались с базовыми при совпадении имён.
- Экспорт: `loadModel`, `loadComponent`, `removeComponent`, `getParts()`, `getOriginalMaterials()`, `getInitialHalfHeight()`.

**`materials.js`** — хранит `activePartKey` и `textureRepeat`. Функции: `setActivePart(key)`, `getActivePartKey()`, `applyFabric(url, cb)` (грузит текстуру, ставит `RepeatWrapping`, при необходимости заменяет материал на `MeshStandardMaterial`), `applyColor(hex)`, `setTextureRepeat(value)`, `resetAllMaterials()`. Через `setOnActivePartChanged(cb)` уведомляет UI.

**`ui.js`** — все обработчики. Кнопки моделей → `loadModelWithUI(path)`: показать loader → `loadModel(...)` → по `onLoaded` собрать кнопки частей через `buildPartsUI(parts)` → `sceneApi.fitCameraToModel(...)` → `sceneApi.setShadowFloorY(-getInitialHalfHeight())`. Кнопки слотов `#legsList` → `loadComponentWithUI(src, slot)` или `removeComponent(slot, ...)` (если `data-src` пуст). После загрузки/снятия компонента `buildPartsUI(parts)` вызывается заново; активная часть сохраняется, если она ещё существует в новой мапе.

---

## Что уже работает

- 2 модели (`Bjorn Andre`, `Asset`), переключение кнопками
- Сменные подкомпоненты по слотам (сейчас слот `legs` — ножки), отдельный GLB на вариант
- Авторазбиение на «части» по уникальным материалам (включая части подкомпонентов)
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

Все типы ассетов добавляются одинаково — файл в папку + кнопка в `index.html`. JS их сам подхватывает по `data-*`.

```html
<!-- базовая модель -->
<button class="btn full" data-model="models/имя.glb">Название</button>

<!-- подкомпонент в слот (ножки и т.п.) -->
<button class="btn full" data-slot="legs" data-src="models/legs_имя.glb">Название</button>
<!-- пустой data-src = снять компонент со слота -->
<button class="btn full" data-slot="legs" data-src="">Без ножек</button>

<!-- ткань -->
<button class="fabric-btn"
        data-texture="textures/имя.png"
        style="background-image:url('textures/имя.png')"
        title="Название"></button>
```

Текстуры: бесшовные PNG/JPG, квадратные, ≥1024px.

**Слоты подкомпонентов.** Сейчас в HTML один контейнер `#legsList` для слота `legs`. Чтобы добавить новый слот (например, `arms` — подлокотники), достаточно скопировать секцию в HTML с другим id и `data-slot`. Обработчик в `ui.js` сейчас цепляется именно к `#legsList` — если слотов больше, обобщить селектор (например, `[data-slot]`).

**Координаты подкомпонентов.** Идеально — авторить варианты ножек в Blender ровно там, где они должны стоять относительно базы (как одна сцена). Если так не получилось, `loadComponent` по умолчанию делает **авто-выравнивание по bbox**: top компонента совмещается с bottom базы, X/Z центрируются. Это работает для типовой мебели «база сверху, ножки снизу». Чтобы отключить (например, когда координаты в GLB уже правильные с лёгким перехлёстом), вызывать `loadComponent(..., { align: 'none', ... })` или прокинуть через UI.
