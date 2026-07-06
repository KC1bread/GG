/**
 * PanelManager — makes all UI panels draggable, minimizable, and closable.
 * Closed panels appear in a bottom dock for restoration.
 */
export class PanelManager {
  constructor() {
    this.panels = [];
    this.closedPanels = new Set();
    this.dockEl = null;
    this.dragState = null;
  }

  /**
   * Initialize all panel elements matching the given selectors.
   * @param {string[]} selectors - CSS selectors for panel containers
   */
  init(selectors = []) {
    this._createDock();
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      this._setupPanel(el);
    }
  }

  // ---- Dock -----------------------------------------------------------------

  _createDock() {
    this.dockEl = document.createElement('div');
    this.dockEl.id = 'panel-dock';
    this.dockEl.className = 'panel-dock';
    document.body.appendChild(this.dockEl);
  }

  _addToDock(panel) {
    const item = document.createElement('button');
    item.className = 'panel-dock-item';
    item.textContent = panel.dataset.panelTitle || panel.id || 'Panel';
    item.title = `恢复 ${item.textContent}`;
    item.addEventListener('click', () => this._showPanel(panel));
    panel._dockItem = item;
    this.dockEl.appendChild(item);
  }

  _removeFromDock(panel) {
    if (panel._dockItem) {
      panel._dockItem.remove();
      panel._dockItem = null;
    }
  }

  // ---- Panel setup ----------------------------------------------------------

  _setupPanel(panel) {
    // Extract title from the first h2/h1/h3 or use id
    const heading = panel.querySelector('h1, h2, h3');
    const title = heading ? heading.textContent : panel.id || 'Panel';
    panel.dataset.panelTitle = title;

    // Create title bar
    const titleBar = document.createElement('div');
    titleBar.className = 'panel-titlebar';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'panel-titlebar-text';
    titleSpan.textContent = title;

    const btnGroup = document.createElement('span');
    btnGroup.className = 'panel-titlebar-btns';

    const minBtn = this._createBtn('−', '最小化', () => this._toggleMinimize(panel));
    const closeBtn = this._createBtn('×', '关闭', () => this._closePanel(panel));

    btnGroup.appendChild(minBtn);
    btnGroup.appendChild(closeBtn);
    titleBar.appendChild(titleSpan);
    titleBar.appendChild(btnGroup);

    // Insert title bar at top of panel
    panel.insertBefore(titleBar, panel.firstChild);

    // Wrap existing content in a content wrapper (skip titlebar)
    const content = document.createElement('div');
    content.className = 'panel-content';
    while (titleBar.nextSibling) {
      content.appendChild(titleBar.nextSibling);
    }
    panel.appendChild(content);

    // Drag handling
    titleBar.addEventListener('mousedown', (e) => this._onDragStart(e, panel));
    titleBar.addEventListener('touchstart', (e) => this._onDragStart(e, panel), { passive: false });

    // Track
    panel._minimized = false;
    panel._closed = false;
    this.panels.push(panel);
  }

  _createBtn(text, title, onClick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.title = title;
    btn.className = 'panel-action-btn';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    // Prevent drag initiation from buttons
    btn.addEventListener('mousedown', (e) => e.stopPropagation());
    btn.addEventListener('touchstart', (e) => e.stopPropagation());
    return btn;
  }

  // ---- Actions ---------------------------------------------------------------

  _toggleMinimize(panel) {
    panel._minimized = !panel._minimized;
    if (panel._minimized) {
      panel.classList.add('panel-minimized');
    } else {
      panel.classList.remove('panel-minimized');
    }
  }

  _closePanel(panel) {
    panel._closed = true;
    panel.classList.add('hidden');
    this.closedPanels.add(panel);
    this._addToDock(panel);
  }

  _showPanel(panel) {
    panel._closed = false;
    panel.classList.remove('hidden');
    this.closedPanels.delete(panel);
    this._removeFromDock(panel);
    // Bring to front
    panel.style.zIndex = this._nextZIndex();
  }

  // ---- Drag ------------------------------------------------------------------

  _onDragStart(e, panel) {
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const rect = panel.getBoundingClientRect();
    this.dragState = {
      panel,
      offsetX: clientX - rect.left,
      offsetY: clientY - rect.top,
      startLeft: rect.left,
      startTop: rect.top
    };

    // Switch from CSS fixed positioning to inline left/top
    const style = window.getComputedStyle(panel);
    panel.style.left = rect.left + 'px';
    panel.style.top = rect.top + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.transform = 'none';
    panel.style.position = 'fixed';
    panel.style.zIndex = this._nextZIndex();

    const onMove = (ev) => this._onDragMove(ev);
    const onEnd = () => this._onDragEnd(onMove, onEnd);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }

  _onDragMove(e) {
    if (!this.dragState) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    let newLeft = clientX - this.dragState.offsetX;
    let newTop = clientY - this.dragState.offsetY;

    // Clamp to viewport
    const panel = this.dragState.panel;
    const maxLeft = window.innerWidth - panel.offsetWidth;
    const maxTop = window.innerHeight - 40; // leave room for dock
    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop = Math.max(0, Math.min(newTop, maxTop));

    panel.style.left = newLeft + 'px';
    panel.style.top = newTop + 'px';
  }

  _onDragEnd(onMove, onEnd) {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
    this.dragState = null;
  }

  _nextZIndex() {
    const maxZ = this.panels.reduce((max, p) => {
      const z = parseInt(window.getComputedStyle(p).zIndex, 10) || 5;
      return Math.max(max, z);
    }, 5);
    return maxZ + 1;
  }
}
