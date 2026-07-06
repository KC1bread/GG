# Draggable Panel System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 8 fixed-position panels with a draggable, minimizable, closable window system — panels start as dock icons, drag freely, and the 3D scene has maximum visibility.

**Architecture:** Two new classes (`DraggablePanel` wraps a single panel with drag/state/animations; `PanelManager` orchestrates all panels, dock rendering, z-index, and the `+` closed-panel menu). Every existing panel class is refactored to receive a container element and build its HTML inside it — no more global `document.getElementById()` queries. Panels are created eagerly via `contentFactory` in `PanelManager.register()` so they always exist regardless of expand/minimize/close state.

**Tech Stack:** Vanilla JS (ES Modules), Pointer Events, CSS animations. No new dependencies.

## Global Constraints

- Zero new npm dependencies
- All existing panel functionality preserved (speed control, HUD display, missions, quizzes, concepts, spacetime diagram, data export)
- Three.js OrbitControls unaffected — panel drag events must not leak to the 3D canvas
- Intro panel remains as a static center overlay, dismissed on Start
- WebXR VRButton still appended to body
- Panels created eagerly inside contentFactory so `this.hud`, `this.logger` etc. always defined

---

### Task 1: Create DraggablePanel class

**Files:**
- Create: `src/ui/DraggablePanel.js`

**Interfaces:**
- Consumes: nothing
- Produces: `DraggablePanel` class
  - `constructor(id, { title, icon, dockSide, defaultPosition, contentFactory, onStateChange })`
  - `.expand()`, `.minimize()`, `.close()`
  - `.setZIndex(n: number)`
  - `get state(): 'closed' | 'minimized' | 'expanded'`
  - `.contentEl: HTMLElement` — the content div, passed to contentFactory

- [ ] **Step 1: Write the file**

```js
// src/ui/DraggablePanel.js

const PANEL_MIN_WIDTH = 260;
const VIEWPORT_MARGIN = 80;

export class DraggablePanel {
  constructor(id, { title, icon, dockSide, defaultPosition, contentFactory, onStateChange }) {
    this.id = id;
    this.title = title;
    this.icon = icon;
    this.dockSide = dockSide;
    this._state = 'minimized';
    this._position = defaultPosition || this._defaultPos();
    this._zIndex = 100;
    this._onStateChange = onStateChange || (() => {});

    this._buildDom();
    this._bindDrag();
    this._setMinimizedStyle();

    // contentFactory runs immediately — panel instance always exists
    if (contentFactory) {
      contentFactory(this.contentEl);
    }
  }

  _defaultPos() {
    const topOffset = 80 + Math.random() * 40;
    return this.dockSide === 'right'
      ? { x: window.innerWidth - 340, y: topOffset }
      : { x: 80, y: topOffset };
  }

  _buildDom() {
    this.el = document.createElement('div');
    this.el.className = 'draggable-panel';
    this.el.style.left = this._position.x + 'px';
    this.el.style.top = this._position.y + 'px';
    this.el.style.zIndex = this._zIndex;
    this.el.innerHTML = `
      <div class="draggable-titlebar">
        <span class="draggable-title-icon">${this.icon}</span>
        <span class="draggable-title-text">${this.title}</span>
        <div class="draggable-title-actions">
          <button class="draggable-btn-minimize" title="最小化">─</button>
          <button class="draggable-btn-close" title="关闭">✕</button>
        </div>
      </div>
      <div class="draggable-content"></div>
    `;

    this.titleBar = this.el.querySelector('.draggable-titlebar');
    this.contentEl = this.el.querySelector('.draggable-content');
    this._minimizeBtn = this.el.querySelector('.draggable-btn-minimize');
    this._closeBtn = this.el.querySelector('.draggable-btn-close');

    this._minimizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.minimize();
    });
    this._closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });

    // Bring to front on pointer contact
    this.el.addEventListener('pointerdown', () => {
      this._onStateChange('focus', this.id);
    });

    document.body.appendChild(this.el);
  }

  _bindDrag() {
    let dragging = false;
    let startX, startY, origLeft, origTop;

    this.titleBar.addEventListener('pointerdown', (e) => {
      if (e.target === this._minimizeBtn || e.target === this._closeBtn) return;
      if (this._state !== 'expanded') return;

      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      origLeft = this.el.offsetLeft;
      origTop = this.el.offsetTop;
      this.el.setPointerCapture(e.pointerId);
    });

    this.el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newLeft = Math.max(
        -(this.el.offsetWidth - VIEWPORT_MARGIN),
        Math.min(window.innerWidth - VIEWPORT_MARGIN, origLeft + dx)
      );
      const newTop = Math.max(0, Math.min(window.innerHeight - 40, origTop + dy));
      this.el.style.left = newLeft + 'px';
      this.el.style.top = newTop + 'px';
      this._position = { x: newLeft, y: newTop };
    });

    this.el.addEventListener('pointerup', () => {
      dragging = false;
    });
  }

  _setMinimizedStyle() {
    this.el.classList.add('draggable-minimized');
    this.el.style.width = '0';
    this.el.style.height = '0';
    this.el.style.minWidth = '0';
    this.el.style.overflow = 'hidden';
    this.el.style.padding = '0';
    this.el.style.border = 'none';
    this.el.style.pointerEvents = 'none';
  }

  _clearMinimizedStyle() {
    this.el.classList.remove('draggable-minimized');
    this.el.style.width = '';
    this.el.style.height = '';
    this.el.style.minWidth = PANEL_MIN_WIDTH + 'px';
    this.el.style.overflow = '';
    this.el.style.padding = '';
    this.el.style.border = '';
    this.el.style.pointerEvents = '';
  }

  // --- Public API ---

  expand() {
    if (this._state === 'expanded') return;
    this._state = 'expanded';
    this._clearMinimizedStyle();

    this.el.style.left = this._position.x + 'px';
    this.el.style.top = this._position.y + 'px';

    this.el.classList.add('draggable-expanding');
    this.el.addEventListener('animationend', () => {
      this.el.classList.remove('draggable-expanding');
    }, { once: true });

    this._onStateChange('expanded', this.id);
  }

  minimize() {
    if (this._state === 'minimized') return;
    this._state = 'minimized';
    this._setMinimizedStyle();
    this._onStateChange('minimized', this.id);
  }

  close() {
    if (this._state === 'closed') return;
    this.el.classList.add('draggable-closing');
    this.el.addEventListener('animationend', () => {
      this.el.remove();
      this._state = 'closed';
      this._onStateChange('closed', this.id);
    }, { once: true });
  }

  setZIndex(z) {
    this._zIndex = z;
    this.el.style.zIndex = z;
  }

  get state() {
    return this._state;
  }
}
```

- [ ] **Step 2: Verify file loads cleanly**

```bash
node -e "import('./src/ui/DraggablePanel.js').then(m => console.log(Object.keys(m)))"
```

Expected: `[ 'DraggablePanel' ]`

- [ ] **Step 3: Commit**

```bash
git add src/ui/DraggablePanel.js
git commit -m "feat: add DraggablePanel - drag, minimize, close with animations"
```

---

### Task 2: Create PanelManager class

**Files:**
- Create: `src/ui/PanelManager.js`

**Interfaces:**
- Consumes: `DraggablePanel` from Task 1
- Produces: `PanelManager` class
  - `register(id: string, config: { title, icon, dockSide, contentFactory })`
  - `expand(id)`, `minimize(id)`, `close(id)`, `toggle(id)`
  - `showAll()` — expand all non-closed panels

- [ ] **Step 1: Write the file**

```js
// src/ui/PanelManager.js

import { DraggablePanel } from './DraggablePanel.js';

const BASE_Z = 100;

export class PanelManager {
  constructor() {
    this._panels = new Map();   // id -> { draggablePanel, config }
    this._zCounter = BASE_Z;
    this._ensureDocks();
  }

  _ensureDocks() {
    for (const side of ['left', 'right']) {
      let dock = document.getElementById(`dock-${side}`);
      if (!dock) {
        dock = document.createElement('div');
        dock.id = `dock-${side}`;
        dock.className = `dock dock-${side}`;
        document.body.appendChild(dock);
      }
      this._ensurePlusButton(dock, side);
    }
  }

  _ensurePlusButton(dock, side) {
    if (dock.querySelector('.dock-plus')) return;
    const btn = document.createElement('button');
    btn.className = 'dock-plus';
    btn.textContent = '＋';
    btn.title = '更多面板';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._showClosedMenu(dock, side, e);
    });
    dock.appendChild(btn);
  }

  _showClosedMenu(dock, side, event) {
    document.querySelector('.dock-menu')?.remove();

    const closedIds = [];
    for (const [id, entry] of this._panels) {
      if (entry.config.dockSide === side && entry.draggablePanel.state === 'closed') {
        closedIds.push({ id, title: entry.config.title, icon: entry.config.icon });
      }
    }
    if (closedIds.length === 0) return;

    const menu = document.createElement('div');
    menu.className = 'dock-menu';
    closedIds.forEach(({ id, title, icon }) => {
      const item = document.createElement('button');
      item.className = 'dock-menu-item';
      item.textContent = `${icon} ${title}`;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this._reopen(id);
        menu.remove();
      });
      menu.appendChild(item);
    });

    const dockRect = dock.getBoundingClientRect();
    menu.style.position = 'fixed';
    if (side === 'left') {
      menu.style.left = (dockRect.right + 8) + 'px';
    } else {
      menu.style.right = (window.innerWidth - dockRect.left + 8) + 'px';
    }
    menu.style.bottom = Math.min(window.innerHeight - 120, window.innerHeight - dockRect.top + 60) + 'px';
    document.body.appendChild(menu);

    const closeMenu = (ev) => {
      if (!menu.contains(ev.target)) {
        menu.remove();
        document.removeEventListener('pointerdown', closeMenu);
      }
    };
    requestAnimationFrame(() => {
      document.addEventListener('pointerdown', closeMenu);
    });
  }

  _reopen(id) {
    const entry = this._panels.get(id);
    if (!entry) return;
    const config = entry.config;

    const dp = new DraggablePanel(id, {
      ...config,
      onStateChange: (newState, panelId) => this._onStateChange(panelId, newState),
    });
    entry.draggablePanel = dp;
    dp.setZIndex(++this._zCounter);

    // Add icon back to dock
    const dock = document.getElementById(`dock-${config.dockSide}`);
    let iconBtn = dock.querySelector(`.dock-icon[data-panel-id="${id}"]`);
    if (!iconBtn) {
      iconBtn = document.createElement('button');
      iconBtn.className = 'dock-icon';
      iconBtn.textContent = config.icon;
      iconBtn.title = config.title;
      iconBtn.dataset.panelId = id;
      iconBtn.addEventListener('click', () => this.toggle(id));
      const plusBtn = dock.querySelector('.dock-plus');
      dock.insertBefore(iconBtn, plusBtn);
    }
    iconBtn.classList.remove('active');
  }

  // --- Public API ---

  register(id, config) {
    const dp = new DraggablePanel(id, {
      ...config,
      onStateChange: (newState, panelId) => this._onStateChange(panelId, newState),
    });
    this._panels.set(id, { draggablePanel: dp, config });

    const dock = document.getElementById(`dock-${config.dockSide}`);
    const iconBtn = document.createElement('button');
    iconBtn.className = 'dock-icon';
    iconBtn.textContent = config.icon;
    iconBtn.title = config.title;
    iconBtn.dataset.panelId = id;
    iconBtn.addEventListener('click', () => this.toggle(id));
    const plusBtn = dock.querySelector('.dock-plus');
    dock.insertBefore(iconBtn, plusBtn);

    dp.setZIndex(++this._zCounter);
  }

  toggle(id) {
    const entry = this._panels.get(id);
    if (!entry) return;
    if (entry.draggablePanel.state === 'expanded') {
      this.minimize(id);
    } else if (entry.draggablePanel.state === 'minimized') {
      this.expand(id);
    }
  }

  expand(id) {
    const entry = this._panels.get(id);
    if (!entry) return;
    entry.draggablePanel.setZIndex(++this._zCounter);
    entry.draggablePanel.expand();
  }

  minimize(id) {
    const entry = this._panels.get(id);
    if (!entry) return;
    entry.draggablePanel.minimize();
  }

  close(id) {
    const entry = this._panels.get(id);
    if (!entry) return;
    entry.draggablePanel.close();
  }

  showAll() {
    for (const [id] of this._panels) {
      const entry = this._panels.get(id);
      if (entry.draggablePanel.state !== 'closed') {
        this.expand(id);
      }
    }
  }

  _onStateChange(panelId, newState) {
    const iconBtn = document.querySelector(`.dock-icon[data-panel-id="${panelId}"]`);
    if (newState === 'closed') {
      iconBtn?.remove();
    } else if (newState === 'expanded') {
      iconBtn?.classList.add('active');
    } else if (newState === 'minimized') {
      iconBtn?.classList.remove('active');
    } else if (newState === 'focus') {
      const entry = this._panels.get(panelId);
      if (entry) {
        entry.draggablePanel.setZIndex(++this._zCounter);
      }
    }
  }
}
```

- [ ] **Step 2: Verify file loads cleanly**

```bash
node -e "import('./src/ui/PanelManager.js').then(m => console.log(Object.keys(m)))"
```

Expected: `[ 'PanelManager' ]`

- [ ] **Step 3: Commit**

```bash
git add src/ui/PanelManager.js
git commit -m "feat: add PanelManager - dock icons, z-index, + menu for closed panels"
```

---

### Task 3: Update index.html

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: nothing
- Produces: cleaned-up HTML with `#app-root`, `#intro-panel`, `#dock-left`, `#dock-right`; all other panel `<section>` elements removed

- [ ] **Step 1: Replace index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Relativistic Voyager Alpha</title>
</head>
<body>
  <div id="app-root"></div>

  <section id="intro-panel" class="panel intro-panel">
    <h1>Relativistic Voyager</h1>
    <p>相对论航行者：近光速星际旅行沉浸式 3D 可视化交互系统</p>
    <button id="start-btn">开始任务</button>
  </section>

  <div id="dock-left" class="dock dock-left"></div>
  <div id="dock-right" class="dock dock-right"></div>

  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify removed sections**

```bash
node -e "const fs = require('fs'); const html = fs.readFileSync('index.html','utf8'); console.log(html.includes('dock-left') && html.includes('dock-right') && !html.includes('id=\"control-panel\"') && !html.includes('id=\"hud-panel\"') ? 'OK' : 'FAIL')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "refactor: remove hardcoded panels, add dock containers to index.html"
```

---

### Task 4: Update style.css

**Files:**
- Modify: `src/style.css`

**Interfaces:**
- Consumes: nothing
- Produces: dock styles, draggable panel styles, animation keyframes; old panel position rules removed; internal panel styles (buttons, inputs, HUD grid, tabs, progress) preserved

- [ ] **Step 1: Write the new CSS**

```css
/* === Reset & root === */
:root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #e8f1ff;
  background: #020613;
  --panel-bg: rgba(7, 17, 31, 0.78);
  --panel-border: rgba(157, 183, 255, 0.28);
  --accent: #7dd3fc;
  --accent-2: #facc15;
}

* { box-sizing: border-box; }
body { margin: 0; overflow: hidden; }
canvas { display: block; }

/* === Intro panel === */
#intro-panel {
  position: fixed;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 16px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(10px);
  padding: 14px 16px;
  z-index: 200;
  width: min(540px, calc(100vw - 40px));
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}
#intro-panel.hidden { display: none !important; }
#intro-panel h1 { font-size: 25px; margin: 0 0 8px; }
#intro-panel p { font-size: 13px; line-height: 1.5; }

/* === Docks === */
.dock {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 90;
  padding: 8px;
}
.dock-left  { left: 12px; }
.dock-right { right: 12px; }

.dock-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  color: #e8f1ff;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  padding: 0;
  line-height: 1;
}
.dock-icon:hover {
  border-color: var(--accent);
  box-shadow: 0 0 8px rgba(125, 211, 252, 0.25);
}
.dock-icon.active {
  border-color: var(--accent-2);
  box-shadow: 0 0 10px rgba(250, 204, 21, 0.35);
}

.dock-plus {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px dashed var(--panel-border);
  background: transparent;
  color: #9fb0d0;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s ease, color 0.15s ease;
  padding: 0;
  line-height: 1;
}
.dock-plus:hover {
  border-color: var(--accent);
  color: #e8f1ff;
}

/* === Dock closed-panel menu === */
.dock-menu {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  padding: 8px;
  z-index: 300;
  min-width: 180px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dock-menu-item {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  color: #e8f1ff;
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.dock-menu-item:hover {
  background: rgba(125, 211, 252, 0.12);
}

/* === Draggable Panel === */
.draggable-panel {
  position: fixed;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(10px);
  min-width: 260px;
  z-index: 100;
  opacity: 1;
  transform: scale(1);
}

/* Title bar */
.draggable-titlebar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: grab;
  user-select: none;
  border-bottom: 1px solid rgba(157, 183, 255, 0.15);
}
.draggable-titlebar:active {
  cursor: grabbing;
}
.draggable-title-icon {
  font-size: 16px;
}
.draggable-title-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--accent);
  flex: 1;
}
.draggable-title-actions {
  display: flex;
  gap: 4px;
}
.draggable-title-actions button {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid rgba(157, 183, 255, 0.2);
  background: rgba(125, 211, 252, 0.08);
  color: #e8f1ff;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.draggable-title-actions button:hover {
  background: rgba(125, 211, 252, 0.2);
  border-color: var(--accent);
}

/* Content area */
.draggable-content {
  padding: 14px 16px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}

/* Minimized state */
.draggable-panel.draggable-minimized {
  pointer-events: none;
}

/* Animations */
.draggable-panel.draggable-expanding {
  animation: panel-expand 0.2s ease-out;
}
@keyframes panel-expand {
  from { opacity: 0; transform: scale(0.8); }
  to   { opacity: 1; transform: scale(1); }
}

.draggable-panel.draggable-closing {
  animation: panel-close 0.15s ease-in forwards;
  pointer-events: none;
}
@keyframes panel-close {
  from { opacity: 1; transform: scale(1); }
  to   { opacity: 0; transform: scale(0.9); }
}

/* === Internal panel styles === */
.panel h1, .panel h2, .panel h3 { margin: 0 0 8px; }
.panel h1 { font-size: 25px; }
.panel h2 { font-size: 15px; color: var(--accent); }
.panel h3 { font-size: 14px; color: #ffffff; }
.panel p, .panel label, .panel dd, .panel dt { font-size: 13px; line-height: 1.5; }

input[type='range'] { width: 100%; margin: 8px 0 10px; }
select {
  width: 100%;
  margin-top: 6px;
  margin-bottom: 12px;
  padding: 7px 9px;
  border-radius: 10px;
  border: 1px solid var(--panel-border);
  background: rgba(1, 5, 13, 0.86);
  color: #e8f1ff;
}

button {
  border: 1px solid rgba(125, 211, 252, 0.35);
  border-radius: 10px;
  background: rgba(125, 211, 252, 0.12);
  color: #e8f1ff;
  padding: 7px 10px;
  cursor: pointer;
  transition: 0.16s ease;
}
button:hover { background: rgba(125, 211, 252, 0.22); transform: translateY(-1px); }
.button-row, .speed-row { display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0 12px; }
.speed-row button { font-size: 12px; padding: 5px 7px; }

/* HUD grid */
.draggable-content dl { display: grid; grid-template-columns: 1fr 1.25fr; gap: 4px 10px; margin: 0; }
.draggable-content dt { color: #a8bcde; }
.draggable-content dd { margin: 0; text-align: right; color: #ffffff; font-variant-numeric: tabular-nums; }

/* Concept tabs */
.tabs { display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
.tabs button { font-size: 12px; padding: 5px 8px; }
.tabs button.active { background: rgba(250, 204, 21, 0.18); border-color: rgba(250, 204, 21, 0.5); }

/* Progress bar */
.progress {
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
  margin: 10px 0;
}
.progress span {
  display: block;
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, #7dd3fc, #facc15);
}

/* Quiz options */
.draggable-content [data-quiz="options"] { display: grid; gap: 6px; }
.draggable-content [data-quiz="options"] button { text-align: left; }
.draggable-content [data-quiz="feedback"] { min-height: 42px; color: #fff6b2; }
.small-note { color: #9fb0d0; font-size: 12px !important; }
```

- [ ] **Step 2: Verify CSS contains new styles and no old panel positions**

```bash
node -e "const fs = require('fs'); const css = fs.readFileSync('src/style.css','utf8'); console.log(css.includes('dock-left') && css.includes('draggable-panel') && css.includes('keyframes') && !css.includes('.control-panel {') ? 'OK' : 'FAIL')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/style.css
git commit -m "refactor: replace fixed-panel CSS with dock + draggable panel styles"
```

---

### Task 5: Refactor Hud to accept container

**Files:**
- Modify: `src/ui/Hud.js`

**Interfaces:**
- Consumes: `container: HTMLElement`
- Produces: `Hud` class — `constructor(state, container)`, `.update()`

- [ ] **Step 1: Rewrite Hud.js**

```js
// src/ui/Hud.js
import { computeRelativityState } from '../physics/relativity.js';

function fmt(value, digits = 3) {
  if (!Number.isFinite(value)) return '--';
  return value.toFixed(digits);
}

function fmtYears(value) {
  if (!Number.isFinite(value)) return '--';
  if (value > 1000) return `${value.toExponential(2)} years`;
  return `${value.toFixed(2)} years`;
}

export class Hud {
  constructor(state, container) {
    this.state = state;
    this.container = container;
    this._buildHtml();
  }

  _buildHtml() {
    this.container.innerHTML = `
      <h2>Relativity HUD</h2>
      <dl>
        <dt>速度 β</dt><dd data-hud="beta">0.000</dd>
        <dt>洛伦兹因子 γ</dt><dd data-hud="gamma">1.000</dd>
        <dt>地球时间</dt><dd data-hud="earthTime">0.00 years</dd>
        <dt>飞船固有时间</dt><dd data-hud="shipTime">0.00 years</dd>
        <dt>地球系距离</dt><dd data-hud="earthDistance">4.24 ly</dd>
        <dt>飞船系距离</dt><dd data-hud="shipDistance">4.24 ly</dd>
        <dt>到达 ETA</dt><dd data-hud="eta">--</dd>
        <dt>长度收缩比例</dt><dd data-hud="lengthRatio">1.000</dd>
      </dl>
    `;
    const root = this.container;
    this.el = {
      beta: root.querySelector('[data-hud="beta"]'),
      gamma: root.querySelector('[data-hud="gamma"]'),
      earthTime: root.querySelector('[data-hud="earthTime"]'),
      shipTime: root.querySelector('[data-hud="shipTime"]'),
      earthDistance: root.querySelector('[data-hud="earthDistance"]'),
      shipDistance: root.querySelector('[data-hud="shipDistance"]'),
      eta: root.querySelector('[data-hud="eta"]'),
      lengthRatio: root.querySelector('[data-hud="lengthRatio"]'),
    };
  }

  update() {
    const r = computeRelativityState(this.state);
    this.el.beta.textContent = fmt(r.beta, 3);
    this.el.gamma.textContent = fmt(r.gamma, 3);
    this.el.earthTime.textContent = fmtYears(r.earthTime);
    this.el.shipTime.textContent = fmtYears(r.shipTime);
    this.el.earthDistance.textContent = `${fmt(r.earthDistance, 2)} ly`;
    this.el.shipDistance.textContent = `${fmt(r.shipDistance, 2)} ly`;
    this.el.eta.textContent = `${fmtYears(r.etaEarth)} / ${fmtYears(r.etaShip)}`;
    this.el.lengthRatio.textContent = fmt(r.lengthRatio, 3);
  }
}
```

- [ ] **Step 2: Verify file loads**

```bash
node -e "import('./src/ui/Hud.js').then(m => console.log(Object.keys(m)))"
```

Expected: `[ 'Hud' ]`

- [ ] **Step 3: Commit**

```bash
git add src/ui/Hud.js
git commit -m "refactor: Hud accepts container, builds HTML internally"
```

---

### Task 6: Refactor ControlPanel to accept container

**Files:**
- Modify: `src/ui/ControlPanel.js`

**Interfaces:**
- Consumes: `container: HTMLElement`, `callbacks: { onChange, onStart }` (both optional)
- Produces: `ControlPanel` class — `constructor(state, logger, container, callbacks)`

- [ ] **Step 1: Rewrite ControlPanel.js**

```js
// src/ui/ControlPanel.js

export class ControlPanel {
  constructor(state, logger, container, { onChange, onStart } = {}) {
    this.state = state;
    this.logger = logger;
    this.container = container;
    this.onChange = onChange || (() => {});
    this.onStart = onStart || (() => {});
    this._buildHtml();
    this._bindEvents();
  }

  _buildHtml() {
    this.container.innerHTML = `
      <h2>飞船控制</h2>
      <label>
        速度 β = v/c
        <input data-ctrl="slider" type="range" min="0" max="0.99" step="0.001" value="0" />
      </label>
      <div class="speed-row">
        <button data-beta="0.1">0.1c</button>
        <button data-beta="0.5">0.5c</button>
        <button data-beta="0.8">0.8c</button>
        <button data-beta="0.9">0.9c</button>
        <button data-beta="0.99">0.99c</button>
      </div>
      <label>
        参考系
        <select data-ctrl="frame">
          <option value="earth">地球参考系 Earth frame</option>
          <option value="ship">飞船参考系 Ship frame</option>
          <option value="sideBySide">并列比较 Side-by-side</option>
        </select>
      </label>
      <label>
        显示模式
        <select data-ctrl="viewMode">
          <option value="measured">Measured：物理测量模式</option>
          <option value="observed">Observed：视觉观察模式</option>
        </select>
      </label>
      <div class="button-row">
        <button data-ctrl="pause">暂停</button>
        <button data-ctrl="reset">重置</button>
      </div>
    `;
  }

  _bindEvents() {
    const root = this.container;

    const slider = root.querySelector('[data-ctrl="slider"]');

    slider.addEventListener('input', () => {
      this.state.beta = Number(slider.value);
      this.logger.log('speed_change', this._snapshot());
      this.onChange();
    });

    root.querySelectorAll('[data-beta]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.state.beta = Number(btn.dataset.beta);
        slider.value = String(this.state.beta);
        this.logger.log('speed_preset', this._snapshot());
        this.onChange();
      });
    });

    root.querySelector('[data-ctrl="frame"]').addEventListener('change', (e) => {
      this.state.frame = e.target.value;
      this.logger.log('frame_change', this._snapshot());
      this.onChange();
    });

    root.querySelector('[data-ctrl="viewMode"]').addEventListener('change', (e) => {
      this.state.viewMode = e.target.value;
      this.logger.log('view_mode_change', this._snapshot());
      this.onChange();
    });

    const pauseBtn = root.querySelector('[data-ctrl="pause"]');
    pauseBtn.addEventListener('click', () => {
      this.state.paused = !this.state.paused;
      pauseBtn.textContent = this.state.paused ? '继续' : '暂停';
      this.logger.log('pause_toggle', { paused: this.state.paused, ...this._snapshot() });
    });

    root.querySelector('[data-ctrl="reset"]').addEventListener('click', () => {
      this.state.beta = 0;
      this.state.earthTime = 0;
      slider.value = '0';
      this.logger.log('reset', this._snapshot());
      this.onChange();
    });
  }

  _snapshot() {
    return {
      beta: this.state.beta,
      frame: this.state.frame,
      viewMode: this.state.viewMode,
    };
  }
}
```

- [ ] **Step 2: Verify file loads**

```bash
node -e "import('./src/ui/ControlPanel.js').then(m => console.log(Object.keys(m)))"
```

Expected: `[ 'ControlPanel' ]`

- [ ] **Step 3: Commit**

```bash
git add src/ui/ControlPanel.js
git commit -m "refactor: ControlPanel accepts container, builds HTML internally"
```

---

### Task 7: Refactor MissionSystem to accept container

**Files:**
- Modify: `src/ui/MissionSystem.js`

**Interfaces:**
- Consumes: `container: HTMLElement`
- Produces: `MissionSystem` class — `constructor(state, logger, container)`, `.init()`, `.update()`

- [ ] **Step 1: Rewrite MissionSystem.js**

```js
// src/ui/MissionSystem.js
import { missions } from '../data/missions.js';

export class MissionSystem {
  constructor(state, logger, container) {
    this.state = state;
    this.logger = logger;
    this.container = container;
    this.index = 0;
    this.completed = new Set();
  }

  init() {
    this._buildHtml();
    this._bindEvents();
    this.render();
  }

  _buildHtml() {
    this.container.innerHTML = `
      <h2>学习任务</h2>
      <h3 data-msn="title"></h3>
      <p data-msn="description"></p>
      <div data-msn="progress" class="progress"><span></span></div>
      <button data-msn="next">下一个任务</button>
    `;
    this.titleEl = this.container.querySelector('[data-msn="title"]');
    this.descEl = this.container.querySelector('[data-msn="description"]');
    this.progressBar = this.container.querySelector('[data-msn="progress"] span');
    this.nextBtn = this.container.querySelector('[data-msn="next"]');
  }

  _bindEvents() {
    this.nextBtn.addEventListener('click', () => {
      this.index = (this.index + 1) % missions.length;
      this.logger.log('mission_next', { missionId: this.current().id });
      this.render();
    });
  }

  current() {
    return missions[this.index];
  }

  evaluate() {
    const m = this.current();
    let score = 0;
    if (typeof m.targetBeta === 'number') {
      const delta = Math.abs(this.state.beta - m.targetBeta);
      score += Math.max(0, 1 - delta / (m.tolerance * 4));
    } else {
      score += 0.5;
    }
    if (m.requiredMode) score += this.state.viewMode === m.requiredMode ? 1 : 0;
    if (m.requiredFrame) score += this.state.frame === m.requiredFrame ? 1 : 0;

    const maxScore = 1 + (m.requiredMode ? 1 : 0) + (m.requiredFrame ? 1 : 0);
    const progress = Math.min(1, score / maxScore);

    if (progress >= 0.95 && !this.completed.has(m.id)) {
      this.completed.add(m.id);
      this.logger.log('mission_complete', {
        missionId: m.id,
        beta: this.state.beta,
        frame: this.state.frame,
        viewMode: this.state.viewMode,
      });
    }
    return progress;
  }

  update() {
    const progress = this.evaluate();
    this.progressBar.style.width = `${Math.round(progress * 100)}%`;
    if (progress >= 0.95) {
      this.descEl.innerHTML = `${this.current().description}<br><strong>完成：</strong>${this.current().concept}`;
    }
  }

  render() {
    const m = this.current();
    this.titleEl.textContent = m.title;
    this.descEl.textContent = m.description;
    this.progressBar.style.width = '0%';
  }
}
```

- [ ] **Step 2: Verify file loads**

```bash
node -e "import('./src/ui/MissionSystem.js').then(m => console.log(Object.keys(m)))"
```

Expected: `[ 'MissionSystem' ]`

- [ ] **Step 3: Commit**

```bash
git add src/ui/MissionSystem.js
git commit -m "refactor: MissionSystem accepts container, builds HTML internally"
```

---

### Task 8: Refactor ConceptPanel to accept container

**Files:**
- Modify: `src/ui/ConceptPanel.js`

**Interfaces:**
- Consumes: `container: HTMLElement`
- Produces: `ConceptPanel` class — `constructor(logger, container)`, `.init()`

- [ ] **Step 1: Rewrite ConceptPanel.js**

```js
// src/ui/ConceptPanel.js
import { concepts } from '../data/concepts.js';

export class ConceptPanel {
  constructor(logger, container) {
    this.logger = logger;
    this.container = container;
    this.level = 1;
  }

  init() {
    this._buildHtml();
    this._bindEvents();
    this.render();
  }

  _buildHtml() {
    this.container.innerHTML = `
      <h2>概念解释</h2>
      <div data-concept="tabs" class="tabs">
        <button data-level="1" class="active">现象</button>
        <button data-level="2">直观解释</button>
        <button data-level="3">公式</button>
        <button data-level="4">参考系</button>
      </div>
      <p data-concept="text"></p>
    `;
    this.textEl = this.container.querySelector('[data-concept="text"]');
    this.buttons = [...this.container.querySelectorAll('[data-concept="tabs"] [data-level]')];
  }

  _bindEvents() {
    this.buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.level = Number(btn.dataset.level);
        this.buttons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.logger.log('concept_level_change', { level: this.level });
        this.render();
      });
    });
  }

  render() {
    this.textEl.textContent = concepts[this.level];
  }
}
```

- [ ] **Step 2: Verify file loads**

```bash
node -e "import('./src/ui/ConceptPanel.js').then(m => console.log(Object.keys(m)))"
```

Expected: `[ 'ConceptPanel' ]`

- [ ] **Step 3: Commit**

```bash
git add src/ui/ConceptPanel.js
git commit -m "refactor: ConceptPanel accepts container, builds HTML internally"
```

---

### Task 9: Refactor QuizSystem to accept container

**Files:**
- Modify: `src/ui/QuizSystem.js`

**Interfaces:**
- Consumes: `container: HTMLElement`
- Produces: `QuizSystem` class — `constructor(state, logger, container)`, `.init()`

- [ ] **Step 1: Rewrite QuizSystem.js**

```js
// src/ui/QuizSystem.js
import { quizzes } from '../data/quizzes.js';

export class QuizSystem {
  constructor(state, logger, container) {
    this.state = state;
    this.logger = logger;
    this.container = container;
    this.index = 0;
  }

  init() {
    this._buildHtml();
    this._bindEvents();
    this.render();
  }

  _buildHtml() {
    this.container.innerHTML = `
      <h2>概念问答</h2>
      <p data-quiz="question"></p>
      <div data-quiz="options"></div>
      <p data-quiz="feedback"></p>
      <button data-quiz="next">下一题</button>
    `;
    this.questionEl = this.container.querySelector('[data-quiz="question"]');
    this.optionsEl = this.container.querySelector('[data-quiz="options"]');
    this.feedbackEl = this.container.querySelector('[data-quiz="feedback"]');
    this.nextBtn = this.container.querySelector('[data-quiz="next"]');
  }

  _bindEvents() {
    this.nextBtn.addEventListener('click', () => {
      this.index = (this.index + 1) % quizzes.length;
      this.logger.log('quiz_next', { quizId: this.current().id });
      this.render();
    });
  }

  current() {
    return quizzes[this.index];
  }

  render() {
    const q = this.current();
    this.questionEl.textContent = q.question;
    this.optionsEl.innerHTML = '';
    this.feedbackEl.textContent = '';
    q.options.forEach((option, idx) => {
      const btn = document.createElement('button');
      btn.textContent = option;
      btn.addEventListener('click', () => this._answer(idx));
      this.optionsEl.appendChild(btn);
    });
  }

  _answer(index) {
    const q = this.current();
    const isCorrect = index === q.answer;
    this.feedbackEl.textContent = `${isCorrect ? '✓ 正确。' : '✗ 需要再想想。'}${q.feedback}`;
    this.logger.log('quiz_answer', {
      quizId: q.id,
      answerIndex: index,
      isCorrect,
      beta: this.state.beta,
      frame: this.state.frame,
      viewMode: this.state.viewMode,
    });
  }
}
```

- [ ] **Step 2: Verify file loads**

```bash
node -e "import('./src/ui/QuizSystem.js').then(m => console.log(Object.keys(m)))"
```

Expected: `[ 'QuizSystem' ]`

- [ ] **Step 3: Commit**

```bash
git add src/ui/QuizSystem.js
git commit -m "refactor: QuizSystem accepts container, builds HTML internally"
```

---

### Task 10: Refactor DataLogger to accept container

**Files:**
- Modify: `src/ui/DataLogger.js`

**Interfaces:**
- Consumes: `container: HTMLElement`
- Produces: `DataLogger` class — `constructor(container)`, `.log(type, payload)`, `.exportJson()`, `.exportCsv()`

- [ ] **Step 1: Rewrite DataLogger.js**

```js
// src/ui/DataLogger.js

export class DataLogger {
  constructor(container) {
    this.container = container;
    this.sessionId = crypto?.randomUUID?.() ?? `session-${Date.now()}`;
    this.startedAt = new Date().toISOString();
    this.events = [];
    this._buildHtml();
    this._bindEvents();
  }

  _buildHtml() {
    this.container.innerHTML = `
      <h2>实验记录</h2>
      <div class="button-row">
        <button data-log="export-json">导出 JSON</button>
        <button data-log="export-csv">导出 CSV</button>
      </div>
      <p class="small-note">记录速度调节、参考系切换、模式切换、任务与问答行为。</p>
    `;
  }

  _bindEvents() {
    this.container.querySelector('[data-log="export-json"]').addEventListener('click', () => this.exportJson());
    this.container.querySelector('[data-log="export-csv"]').addEventListener('click', () => this.exportCsv());
  }

  log(type, payload = {}) {
    this.events.push({
      sessionId: this.sessionId,
      type,
      timestamp: new Date().toISOString(),
      t: performance.now(),
      ...payload,
    });
  }

  exportJson() {
    const content = JSON.stringify(
      {
        sessionId: this.sessionId,
        startedAt: this.startedAt,
        exportedAt: new Date().toISOString(),
        events: this.events,
      },
      null,
      2
    );
    this._download(`relativistic-voyager-${this.sessionId}.json`, content, 'application/json');
  }

  exportCsv() {
    const columns = [
      'sessionId', 'timestamp', 't', 'type', 'beta', 'gamma',
      'frame', 'viewMode', 'missionId', 'quizId', 'answerIndex', 'isCorrect',
    ];
    const rows = [columns.join(',')];
    for (const e of this.events) {
      rows.push(columns.map((c) => JSON.stringify(e[c] ?? '')).join(','));
    }
    this._download(`relativistic-voyager-${this.sessionId}.csv`, rows.join('\n'), 'text/csv');
  }

  _download(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}
```

- [ ] **Step 2: Verify file loads**

```bash
node -e "import('./src/ui/DataLogger.js').then(m => console.log(Object.keys(m)))"
```

Expected: `[ 'DataLogger' ]`

- [ ] **Step 3: Commit**

```bash
git add src/ui/DataLogger.js
git commit -m "refactor: DataLogger accepts container, renders export buttons internally"
```

---

### Task 11: Refactor SpacetimeDiagram to accept container

**Files:**
- Modify: `src/visual/SpacetimeDiagram.js`

**Interfaces:**
- Consumes: `container: HTMLElement`
- Produces: `SpacetimeDiagram` class — `constructor(state, container)`, `.update()`

- [ ] **Step 1: Rewrite SpacetimeDiagram.js**

```js
// src/visual/SpacetimeDiagram.js

export class SpacetimeDiagram {
  constructor(state, container) {
    this.state = state;
    this.container = container;
    this._buildHtml();
  }

  _buildHtml() {
    this.container.innerHTML = `
      <h2>Minkowski 时空图</h2>
      <canvas data-st="canvas" width="360" height="280"></canvas>
      <p class="small-note">纵轴为时间 ct，横轴为空间 x；飞船速度越大，世界线越接近光锥。</p>
    `;
    this.canvas = this.container.querySelector('[data-st="canvas"]');
    this.ctx = this.canvas.getContext('2d');
  }

  update() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#07111f';
    ctx.fillRect(0, 0, w, h);

    const origin = { x: w / 2, y: h - 36 };
    const top = 28;
    const axisColor = '#9fb7ff';
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x, top);
    ctx.moveTo(34, origin.y);
    ctx.lineTo(w - 34, origin.y);
    ctx.stroke();

    ctx.fillStyle = axisColor;
    ctx.font = '13px sans-serif';
    ctx.fillText('ct', origin.x + 8, top + 6);
    ctx.fillText('x', w - 48, origin.y - 8);

    // light cone
    ctx.strokeStyle = '#445b88';
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x - 115, top);
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x + 115, top);
    ctx.stroke();
    ctx.setLineDash([]);

    // Earth worldline
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x, top + 8);
    ctx.stroke();
    ctx.fillStyle = '#7dd3fc';
    ctx.fillText('Earth', origin.x + 8, top + 24);

    // Ship worldline
    const beta = Math.max(0.02, this.state.beta);
    const yTop = top + 8;
    const dy = origin.y - yTop;
    const xTop = origin.x + beta * 115;
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(xTop, yTop);
    ctx.stroke();
    ctx.fillStyle = '#facc15';
    ctx.fillText(`Ship β=${this.state.beta.toFixed(2)}`, Math.min(xTop + 6, w - 100), yTop + 18);

    // Event marker
    const progress = Math.min(1, this.state.earthTime / 4.24);
    const eventY = origin.y - dy * progress;
    const eventX = origin.x + beta * 115 * progress;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eventX, eventY, 5, 0, Math.PI * 2);
    ctx.fill();

    // simultaneity cue
    ctx.strokeStyle = this.state.frame === 'ship' ? '#facc15' : '#7dd3fc';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    if (this.state.frame === 'ship') {
      ctx.moveTo(60, eventY + beta * 35);
      ctx.lineTo(w - 60, eventY - beta * 35);
    } else {
      ctx.moveTo(60, eventY);
      ctx.lineTo(w - 60, eventY);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#d7e4ff';
    ctx.font = '12px sans-serif';
    ctx.fillText(
      this.state.frame === 'ship' ? 'ship-frame simultaneity cue' : 'earth-frame simultaneity cue',
      16,
      h - 12
    );
  }
}
```

- [ ] **Step 2: Verify file loads**

```bash
node -e "import('./src/visual/SpacetimeDiagram.js').then(m => console.log(Object.keys(m)))"
```

Expected: `[ 'SpacetimeDiagram' ]`

- [ ] **Step 3: Commit**

```bash
git add src/visual/SpacetimeDiagram.js
git commit -m "refactor: SpacetimeDiagram accepts container, creates canvas internally"
```

---

### Task 12: Update App.js to use PanelManager

**Files:**
- Modify: `src/core/App.js`

**Interfaces:**
- Consumes: `PanelManager` from Task 2, all refactored panel classes from Tasks 5-11
- Produces: updated `RelativisticVoyagerApp` — `setupPanels()` uses `PanelManager.register()` with `contentFactory`; panels created eagerly inside contentFactory; `onStateChanged()` and `update()` guard with existence checks

- [ ] **Step 1: Rewrite App.js**

```js
// src/core/App.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

import { PanelManager } from '../ui/PanelManager.js';
import { DataLogger } from '../ui/DataLogger.js';
import { Hud } from '../ui/Hud.js';
import { ControlPanel } from '../ui/ControlPanel.js';
import { MissionSystem } from '../ui/MissionSystem.js';
import { ConceptPanel } from '../ui/ConceptPanel.js';
import { QuizSystem } from '../ui/QuizSystem.js';
import { StarField } from '../visual/StarField.js';
import { Spacecraft } from '../visual/Spacecraft.js';
import { MeasurementRod } from '../visual/MeasurementRod.js';
import { SpacetimeDiagram } from '../visual/SpacetimeDiagram.js';
import { addReferenceScene } from '../visual/SceneObjects.js';
import {
  computeRelativityState,
  DEFAULT_TARGET_DISTANCE_LY,
} from '../physics/relativity.js';

export class RelativisticVoyagerApp {
  constructor() {
    this.state = {
      beta: 0,
      frame: 'earth',
      viewMode: 'measured',
      paused: false,
      earthTime: 0,
      earthDistance: DEFAULT_TARGET_DISTANCE_LY,
      timeScale: 0.025,
    };
    this.clock = new THREE.Clock();
  }

  init() {
    this.panelManager = new PanelManager();

    this.setupThree();
    this.setupScene();
    this.setupPanels();
    this.setupResize();
    this.logger.log('app_init');
    this.renderer.setAnimationLoop(() => this.update());
  }

  setupThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020613);
    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.01,
      2000
    );
    this.camera.position.set(0, 2.2, 7.5);
    this.camera.lookAt(0, -0.4, -7);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.xr.enabled = true;
    this.renderer.shadowMap.enabled = true;
    document.getElementById('app-root').appendChild(this.renderer.domElement);
    document.body.appendChild(VRButton.createButton(this.renderer));

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, -0.6, -5);
  }

  setupScene() {
    this.starField = new StarField({ count: 2200, radius: 180 });
    this.starField.addTo(this.scene);

    this.spacecraft = new Spacecraft();
    this.spacecraft.addTo(this.scene);

    this.measurementRod = new MeasurementRod();
    this.measurementRod.addTo(this.scene);

    this.refs = addReferenceScene(this.scene);
  }

  setupPanels() {
    const onStateChange = () => this.onStateChanged();

    // Data Logger — must be registered first (other panels reference this.logger)
    // It is created eagerly inside contentFactory, which runs synchronously during register()
    this.panelManager.register('logger', {
      title: '实验记录',
      icon: '📝',
      dockSide: 'left',
      contentFactory: (container) => {
        this.logger = new DataLogger(container);
      },
    });

    // Intro start button
    const startBtn = document.getElementById('start-btn');
    startBtn.addEventListener('click', () => {
      document.getElementById('intro-panel').classList.add('hidden');
      this.panelManager.showAll();
      this.logger.log('start');
    });

    // Control Panel — left dock
    this.panelManager.register('control', {
      title: '飞船控制',
      icon: '⚙',
      dockSide: 'left',
      contentFactory: (container) => {
        this.controlPanel = new ControlPanel(this.state, this.logger, container, {
          onChange: onStateChange,
        });
      },
    });

    // Mission System — left dock
    this.panelManager.register('mission', {
      title: '学习任务',
      icon: '🎯',
      dockSide: 'left',
      contentFactory: (container) => {
        this.missionSystem = new MissionSystem(this.state, this.logger, container);
        this.missionSystem.init();
      },
    });

    // HUD — right dock
    this.panelManager.register('hud', {
      title: 'Relativity HUD',
      icon: '📊',
      dockSide: 'right',
      contentFactory: (container) => {
        this.hud = new Hud(this.state, container);
      },
    });

    // Concept Panel — right dock
    this.panelManager.register('concept', {
      title: '概念解释',
      icon: '📖',
      dockSide: 'right',
      contentFactory: (container) => {
        this.conceptPanel = new ConceptPanel(this.logger, container);
        this.conceptPanel.init();
      },
    });

    // Quiz System — right dock
    this.panelManager.register('quiz', {
      title: '概念问答',
      icon: '❓',
      dockSide: 'right',
      contentFactory: (container) => {
        this.quizSystem = new QuizSystem(this.state, this.logger, container);
        this.quizSystem.init();
      },
    });

    // Spacetime Diagram — right dock
    this.panelManager.register('spacetime', {
      title: 'Minkowski 时空图',
      icon: '⏱',
      dockSide: 'right',
      contentFactory: (container) => {
        this.spacetimeDiagram = new SpacetimeDiagram(this.state, container);
      },
    });
  }

  setupResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  onStateChanged() {
    const computed = computeRelativityState(this.state);
    this.logger.log('state_snapshot', {
      beta: computed.beta,
      gamma: computed.gamma,
      frame: this.state.frame,
      viewMode: this.state.viewMode,
    });
    if (this.hud) this.hud.update();
    if (this.spacetimeDiagram) this.spacetimeDiagram.update();
  }

  update() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const r = computeRelativityState(this.state);

    if (!this.state.paused) {
      this.state.earthTime +=
        dt * this.state.timeScale * Math.max(0.2, this.state.beta * 12);
      if (this.state.earthTime > r.etaEarth && Number.isFinite(r.etaEarth)) {
        this.state.earthTime = 0;
        this.logger.log('arrival_loop_reset', {
          beta: this.state.beta,
          gamma: r.gamma,
        });
      }
    }

    this.starField.update(this.state.beta);
    this.spacecraft.update(this.state.beta);
    this.measurementRod.update(this.state.beta, this.state.viewMode);
    this.controls.update();
    if (this.hud) this.hud.update();
    if (this.missionSystem) this.missionSystem.update();
    if (this.spacetimeDiagram) this.spacetimeDiagram.update();

    if (this.refs?.earth) this.refs.earth.rotation.y += dt * 0.12;
    this.renderer.render(this.scene, this.camera);
  }
}
```

- [ ] **Step 2: Verify file loads cleanly**

```bash
node -e "import('./src/core/App.js').then(m => console.log(Object.keys(m)))"
```

Expected: `[ 'RelativisticVoyagerApp' ]`

- [ ] **Step 3: Commit**

```bash
git add src/core/App.js
git commit -m "refactor: App.js uses PanelManager with eagerly-created panels via contentFactory"
```

---

### Task 13: Verify end-to-end

**Files:**
- No new files created or modified — test only

**Interfaces:**
- Consumes: all previous tasks
- Produces: working app with draggable panels

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open browser and manually verify**

Checklist:
1. Page loads without JS errors (check console)
2. Intro panel visible center screen, dock icons visible on left and right
3. Click "开始任务" → intro panel hides, all 7 panels expand
4. Drag a panel by its title bar → moves freely, constrained to viewport
5. Click `─` on a panel → minimizes to dock icon
6. Click dock icon → panel re-expands at last position
7. Click `✕` on a panel → panel closes, icon removed from dock
8. Click `＋` in dock → dropdown shows closed panel names
9. Click a closed panel name → panel reopens minimized, icon appears
10. HUD updates in real-time when speed slider changes
11. OrbitControls work on 3D scene (mouse drag to rotate)
12. Export JSON/CSV works (Data Logger panel)

- [ ] **Step 3: Fix any issues found**

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: issues found during E2E verification"
```
