/**
 * PanelManager v2 — 底部全局底栏 + 弹窗智能避让系统
 *
 * 核心变化：
 * 1. 页面加载完成时所有悬浮弹窗默认全部隐藏，仅展示3D星空主场景
 * 2. 底部底栏分为5个功能分组（🚀仿真控制/📊数据观测/📚学习教学/📈可视化工具/🥽VR设备）
 * 3. 弹窗首次生成时执行智能避让，自动避开已存在的窗口区域
 * 4. 弹窗避免大面积遮挡画面中央3D星空核心区域
 * 5. 屏幕空间不足时保证弹窗标题栏露出
 * 6. 支持【一键全部最小化】和【一键全部关闭】
 * 7. 本次不实现窗口位置本地缓存，刷新页面全部重置
 */
export class PanelManager {
  constructor() {
    this.panels = [];            // 所有已注册面板
    this.panelMap = new Map();   // id -> panel element
    this.windowOrder = [];       // z-order 顺序栈
    this.minimizedPanels = new Set();
    this.activePanelId = null;   // 当前置顶的面板ID
    this.topBarEl = null;
    this.dockEl = null;
    this.dragState = null;

    // 分组定义
    this.groups = [
      { id: 'simulation',    label: '🚀仿真控制' },
      { id: 'observation',   label: '📊数据观测' },
      { id: 'education',     label: '📚学习教学' },
      { id: 'visualization', label: '📈可视化工具' },
      { id: 'vr',            label: '🥽VR设备' },
    ];

    // 每个分组内的面板配置（严格按需求归类）
    this.groupPanels = {
      simulation:    [{ id: 'control-panel',     label: '飞船控制' }],
      observation:   [
        { id: 'hud-panel',          label: 'Relativity HUD' },
        { id: 'log-panel',          label: '实验记录', isAttached: true },
      ],
      education:     [
        { id: 'high-speed-effects-guide', label: '高速视效概念释义', isToggle: true },
      ],
      visualization: [
        { id: 'spacetime-panel',    label: 'Minkowski时空图' },
        { id: 'measurement-panel',  label: '双测量尺' },
      ],
      vr:            [
        { id: 'vr-status',          label: 'VR状态提示', isVr: true },
      ],
    };

    // 默认位置配置（不缓存，每次刷新重置）
    this.defaultPositions = {
      'control-panel':     { right: 16, top: 16 },
      'hud-panel':         { right: 16, top: 16 },
      'measurement-panel': { right: 16, bottom: 228 },
      'spacetime-panel':   { right: 392, bottom: 16 },
    };

    // Z-index 基础值（低于 intro-panel 的 1000）
    this._baseZ = 50;
  }

  /**
   * 初始化面板管理器
   * @param {Array<{id:string, label:string, isVr?:boolean}>} panelConfigs - 按分组顺序的面板配置列表
   */
  init() {
    // 1. 收集所有面板DOM元素并初始化
    this._collectPanels();

    // 2. 创建 VR 状态弹窗
    this._createVrStatusPanel();

    // 3. 初始化面板拖拽
    this._initDragSystem();

    // 4. 全局监听点击置顶
    this._initBringToFront();

    // 5. 窗口缩放后自动将越界面板拉回视口
    this._initResizeHandler();
  }

  // ==========================================================================
  //  面板收集与初始化
  // ==========================================================================

  _collectPanels() {
    for (const group of this.groups) {
      const panels = this.groupPanels[group.id] || [];
      for (const cfg of panels) {
        if (cfg.isVr || cfg.isAttached || cfg.isToggle) continue; // VR/附属按钮/开关不进入浮窗系统
        const el = document.getElementById(cfg.id);
        if (!el) continue;

        this._setupPanel(el, cfg.label);
        el.dataset.panelKey = cfg.id;
        this.panelMap.set(cfg.id, el);
        this.panels.push(el);
      }
    }
  }

  _setupPanel(panel, title) {
    // 如果已经设置过 titlebar 则跳过
    if (panel.querySelector('.panel-titlebar')) return;

    panel.dataset.panelTitle = title || panel.id;

    // 创建标题栏
    const titleBar = document.createElement('div');
    titleBar.className = 'panel-titlebar';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'panel-titlebar-text';
    titleSpan.textContent = title || panel.id;

    const btnGroup = document.createElement('span');
    btnGroup.className = 'panel-titlebar-btns';

    const minBtn = this._createBtn('−', '最小化', () => this._toggleMinimize(panel));
    const closeBtn = this._createBtn('×', '关闭', () => this._closePanel(panel));

    btnGroup.appendChild(minBtn);
    btnGroup.appendChild(closeBtn);
    titleBar.appendChild(titleSpan);
    titleBar.appendChild(btnGroup);

    panel.insertBefore(titleBar, panel.firstChild);

    // 包裹内容
    const content = document.createElement('div');
    content.className = 'panel-content';
    while (titleBar.nextSibling) {
      content.appendChild(titleBar.nextSibling);
    }
    panel.appendChild(content);

    panel._minimized = false;
    panel._closed = false;
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
    btn.addEventListener('mousedown', (e) => e.stopPropagation());
    btn.addEventListener('touchstart', (e) => e.stopPropagation());
    return btn;
  }

  // ==========================================================================
  //  创建 VR 状态面板
  // ==========================================================================

  _createVrStatusPanel() {
    // 检查是否已存在
    let vrPanel = document.getElementById('vr-status-panel');
    if (vrPanel) return;

    vrPanel = document.createElement('section');
    vrPanel.id = 'vr-status-panel';
    vrPanel.className = 'panel hidden';
    vrPanel.style.position = 'fixed';
    vrPanel.style.left = '16px';
    vrPanel.style.bottom = '80px';
    vrPanel.style.width = '320px';
    vrPanel.style.zIndex = '50';

    // 先设置 panelManager 属性以便 _setupPanel 能获取到标题
    vrPanel.dataset.panelTitle = 'VR状态检测';

    // 创建标题栏 (_setupPanel 会处理)
    // 手动构建内容
    const header = document.createElement('div');
    header.className = 'panel-titlebar';
    const titleSpan = document.createElement('span');
    titleSpan.className = 'panel-titlebar-text';
    titleSpan.textContent = 'VR状态检测';
    const btnGroup = document.createElement('span');
    btnGroup.className = 'panel-titlebar-btns';
    const minBtn = this._createBtn('−', '最小化', () => this._toggleMinimize(vrPanel));
    const closeBtn = this._createBtn('×', '关闭', () => this._closePanel(vrPanel));
    btnGroup.appendChild(minBtn);
    btnGroup.appendChild(closeBtn);
    header.appendChild(titleSpan);
    header.appendChild(btnGroup);
    vrPanel.appendChild(header);

    const content = document.createElement('div');
    content.className = 'panel-content';
    content.innerHTML = `
      <div class="vr-status-content">
        <div class="vr-status-icon">🥽</div>
        <div class="vr-status-title">VR 设备状态</div>
        <div class="vr-status-detail" id="vr-status-detail">
          <p>当前浏览器不支持 VR / WebXR，或未检测到 VR 设备。</p>
          <p class="small-note">如需体验沉浸式 VR 交互，请使用支持 WebXR 的浏览器（如 Chrome）并连接兼容的 VR 头显设备。</p>
          <p class="small-note">VR 完整沉浸式交互方案将在后续版本迭代开发。</p>
        </div>
        <div id="vr-button-container" class="vr-button-container"></div>
      </div>
    `;
    vrPanel.appendChild(content);

    vrPanel._minimized = false;
    vrPanel._closed = false;
    vrPanel.dataset.panelKey = 'vr-status';

    document.body.appendChild(vrPanel);
    this.panelMap.set('vr-status', vrPanel);
    this.panels.push(vrPanel);

    // 将原有的 VRButton 移入 VR 面板（延迟执行确保 Three.js VRButton 已创建）
    setTimeout(() => {
      const vrBtnContainer = document.getElementById('vr-button-container');
      if (!vrBtnContainer) return;

      // 尝试多种方式找到 Three.js 生成的 VRButton
      const vrBtn = document.querySelector('.vr-button')
        || document.querySelector('[class*="VR"]')
        || Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent.includes('VR')
          || b.textContent.includes('Enter')
          || b.id === 'VRButton'
        );

      if (vrBtn) {
        vrBtnContainer.appendChild(vrBtn);
        // 移除 Three.js 默认添加的 fixed 定位样式
        vrBtn.style.position = 'static';
        vrBtn.style.bottom = 'auto';
        vrBtn.style.left = 'auto';
        vrBtn.style.right = 'auto';
        vrBtn.style.zIndex = 'auto';
      }
    }, 100);
  }

  // ==========================================================================
  //  创建底部底栏（延迟创建：开始任务后才调用）
  // ==========================================================================

  /**
   * 显示底部底栏（首次调用时创建 DOM，后续仅展开）
   */
  showBottomBar() {
    if (!this.topBarEl) {
      this._createBottomBar();
    }
    this.topBarEl.classList.remove('bottom-bar-collapsed');
    this._updateToggleIcon();
  }

  _createBottomBar() {
    // 清除旧的 dock
    const oldDock = document.getElementById('panel-dock');
    if (oldDock) oldDock.remove();

    // █ 整体容器：tab（箭头在上）+ bar-inner（按钮在下），联动滑动
    this.topBarEl = document.createElement('div');
    this.topBarEl.id = 'bottom-bar';
    this.topBarEl.className = 'bottom-bar';

    // ── 箭头 tab（位于容器顶部，收起时可见于屏幕底边） ──
    const tab = document.createElement('button');
    tab.className = 'bottom-bar-tab';
    tab.textContent = '⌃';
    tab.title = '收起底栏';
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleBottomBar();
    });

    // ── 底栏内容主体 ──
    const barInner = document.createElement('div');
    barInner.className = 'bottom-bar-inner';

    for (const group of this.groups) {
      const groupEl = document.createElement('div');
      groupEl.className = 'bottom-bar-group';
      groupEl.dataset.groupId = group.id;

      const groupLabel = document.createElement('div');
      groupLabel.className = 'bottom-bar-group-label';
      groupLabel.textContent = group.label;
      groupEl.appendChild(groupLabel);

      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'bottom-bar-items';

      const panels = this.groupPanels[group.id] || [];
      for (const cfg of panels) {
        if (cfg.isVr) {
          const vrBtn = document.createElement('button');
          vrBtn.className = 'bottom-bar-btn';
          vrBtn.textContent = cfg.label;
          vrBtn.dataset.panelId = 'vr-status';
          vrBtn.title = 'VR设备状态检测';
          vrBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._togglePanel('vr-status');
          });
          itemsContainer.appendChild(vrBtn);
          continue;
        }

        if (cfg.isAttached) {
          // 附属面板（如实验记录）- 展开/收起子面板
          const btn = document.createElement('button');
          btn.className = 'bottom-bar-btn';
          btn.textContent = cfg.label;
          btn.dataset.panelId = cfg.id;
          btn.dataset.attached = 'true';
          btn.title = `展开 ${cfg.label}`;
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleAttachedPanel(cfg.id);
          });
          itemsContainer.appendChild(btn);
          continue;
        }

        if (cfg.isToggle) {
          const btn = document.createElement('button');
          btn.className = 'bottom-bar-btn bottom-bar-toggle-btn';
          btn.textContent = cfg.label;
          btn.dataset.toggleId = cfg.id;
          btn.title = `切换 ${cfg.label}`;
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleCustomControl(cfg.id);
          });
          itemsContainer.appendChild(btn);
          continue;
        }

        const btn = document.createElement('button');
        btn.className = 'bottom-bar-btn';
        btn.textContent = cfg.label;
        btn.dataset.panelId = cfg.id;
        btn.title = `打开 ${cfg.label}`;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._togglePanel(cfg.id);
        });
        itemsContainer.appendChild(btn);
      }

      groupEl.appendChild(itemsContainer);
      barInner.appendChild(groupEl);
    }

    // 分隔线 & 快捷操作区
    const separator = document.createElement('div');
    separator.className = 'bottom-bar-separator';

    const quickActions = document.createElement('div');
    quickActions.className = 'bottom-bar-quick-actions';

    const minimizeAllBtn = document.createElement('button');
    minimizeAllBtn.className = 'bottom-bar-action-btn';
    minimizeAllBtn.textContent = '— 全部最小化';
    minimizeAllBtn.title = '一键全部最小化';
    minimizeAllBtn.addEventListener('click', () => this._minimizeAll());

    const closeAllBtn = document.createElement('button');
    closeAllBtn.className = 'bottom-bar-action-btn bottom-bar-action-btn-close';
    closeAllBtn.textContent = '× 全部关闭';
    closeAllBtn.title = '一键全部关闭';
    closeAllBtn.addEventListener('click', () => this._closeAll());

    quickActions.appendChild(minimizeAllBtn);
    quickActions.appendChild(closeAllBtn);

    barInner.appendChild(separator);
    barInner.appendChild(quickActions);

    // ── 组装：tab（上）+ inner（下），封装在同一容器内 ──
    this.topBarEl.appendChild(tab);
    this.topBarEl.appendChild(barInner);

    document.body.appendChild(this.topBarEl);
    this.dockEl = this.topBarEl;
    this._updateCustomControlStates();

    // ── 创建浮动菜单（实验记录：按钮锚定，向上纵向展开） ──
    this.attachedSubPanel = document.createElement('div');
    this.attachedSubPanel.className = 'bottom-bar-sub-panel';
    this.attachedSubPanel.innerHTML = `
      <button class="bottom-bar-sub-panel-btn att-export-json" id="att-export-json-btn">导出 JSON</button>
      <button class="bottom-bar-sub-panel-btn att-export-csv" id="att-export-csv-btn">导出 CSV</button>
    `;
    this.attachedSubPanel.querySelector('.att-export-json').addEventListener('click', (e) => {
      e.stopPropagation();
      window.rvApp?.logger?.exportJson();
      this._hideSubPanel();
    });
    this.attachedSubPanel.querySelector('.att-export-csv').addEventListener('click', (e) => {
      e.stopPropagation();
      window.rvApp?.logger?.exportCsv();
      this._hideSubPanel();
    });
    // 点击菜单外关闭
    this.attachedSubPanel.addEventListener('mousedown', (e) => e.stopPropagation());
    document.body.appendChild(this.attachedSubPanel);
  }

  _toggleAttachedPanel(panelId) {
    if (!this.topBarEl || !this.attachedSubPanel) return;

    const isOpen = this.attachedSubPanel.classList.contains('sub-panel-open');

    if (isOpen) {
      this._hideSubPanel();
    } else {
      // 如果底栏已收起，先展开底栏
      if (this.topBarEl.classList.contains('bottom-bar-collapsed')) {
        this._toggleBottomBar();
      }

      // 定位：锚定到按钮正上方
      const btn = this.topBarEl.querySelector(`[data-panel-id="${panelId}"]`);
      if (btn) {
        const rect = btn.getBoundingClientRect();
        const gap = 4;
        this.attachedSubPanel.style.left = (rect.left + rect.width / 2) + 'px';
        this.attachedSubPanel.style.bottom = (window.innerHeight - rect.top + gap) + 'px';
        this.attachedSubPanel.classList.add('sub-panel-open');
        btn.classList.add('active');
        btn.title = `收起 ${btn.textContent}`;
      }
    }
  }

  _hideSubPanel() {
    if (!this.attachedSubPanel) return;
    this.attachedSubPanel.classList.remove('sub-panel-open');
    // 同步清除按钮状态
    const attachedBtns = this.topBarEl.querySelectorAll('[data-attached="true"]');
    attachedBtns.forEach(btn => {
      btn.classList.remove('active');
      btn.title = `展开 ${btn.textContent}`;
    });
  }

  _toggleBottomBar() {
    if (!this.topBarEl) return;
    const isCollapsing = !this.topBarEl.classList.contains('bottom-bar-collapsed');
    this.topBarEl.classList.toggle('bottom-bar-collapsed');

    // 底栏收起时同步收起附属面板
    if (isCollapsing) {
      this._hideSubPanel();
    }

    this._updateToggleIcon();
  }

  _updateToggleIcon() {
    if (!this.topBarEl) return;
    const tab = this.topBarEl.querySelector('.bottom-bar-tab');
    if (!tab) return;
    const isCollapsed = this.topBarEl.classList.contains('bottom-bar-collapsed');
    tab.textContent = isCollapsed ? '⌄' : '⌃';
    tab.title = isCollapsed ? '展开底栏' : '收起底栏';
  }

  _toggleCustomControl(controlId) {
    if (controlId === 'high-speed-effects-guide') {
      window.rvApp?.toggleHighSpeedEffectsGuide?.();
    }
    this._updateCustomControlStates();
  }

  _updateCustomControlStates() {
    if (!this.topBarEl) return;
    const toggleButtons = this.topBarEl.querySelectorAll('[data-toggle-id]');
    toggleButtons.forEach((btn) => {
      const controlId = btn.dataset.toggleId;
      if (controlId === 'high-speed-effects-guide') {
        const enabled = !!window.rvApp?.state?.highSpeedEffectsGuideEnabled;
        btn.classList.toggle('active', enabled);
        btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        btn.title = enabled ? '关闭 高速视效概念释义' : '打开 高速视效概念释义';
      }
    });
  }

  // ==========================================================================
  //  弹窗显示/隐藏/切换
  // ==========================================================================

  /**
   * 切换面板显示/置顶
   */
  _togglePanel(panelId) {
    const panel = this.panelMap.get(panelId);
    if (!panel) return;

    if (panel._closed || panel.classList.contains('hidden')) {
      // 面板已关闭/隐藏 → 打开
      this._showPanel(panel);
    } else if (this.activePanelId === panelId) {
      // 面板已显示且是当前活跃 → 关闭（第二次点击）
      if (panel._minimized) {
        this._toggleMinimize(panel);
      } else {
        this._closePanel(panel);
      }
    } else {
      // 面板已显示但不是当前活跃 → 置顶
      this._raisePanel(panel);
    }

    // 更新按钮状态
    this._updateBtnStates();
  }

  /**
   * 打开面板（首次打开时执行智能避让）
   */
  _showPanel(panel) {
    panel._closed = false;

    // 如果没有手动设置过位置，执行智能避让
    if (!panel.dataset._positioned) {
      // 先临时设置为 visibility:hidden 以获取真实尺寸，再进行定位
      panel.style.visibility = 'hidden';
      panel.classList.remove('hidden');
      this._smartPosition(panel);
      panel.style.visibility = '';
      panel.dataset._positioned = 'true';
    } else {
      panel.classList.remove('hidden');
      // 窗口缩放后旧位置可能已超出视口 → 按当前窗口尺寸重新定位
      if (!this._isWithinViewport(panel)) {
        this._smartPosition(panel);
      }
    }

    // 最小化状态下恢复
    if (panel._minimized) {
      panel._minimized = false;
      panel.classList.remove('panel-minimized');
    }

    // 置顶
    this._raisePanel(panel);
    this._updateBtnStates();
  }

  /**
   * 关闭面板
   */
  _closePanel(panel) {
    panel._closed = true;
    panel.classList.add('hidden');
    this.minimizedPanels.delete(panel);

    if (this.activePanelId === panel.id) {
      this.activePanelId = null;
    }
    this._updateBtnStates();
  }

  /**
   * 切换最小化
   */
  _toggleMinimize(panel) {
    panel._minimized = !panel._minimized;
    if (panel._minimized) {
      panel.classList.add('panel-minimized');
      this.minimizedPanels.add(panel);
    } else {
      panel.classList.remove('panel-minimized');
      this.minimizedPanels.delete(panel);
      this._raisePanel(panel);
    }
    this._updateBtnStates();
  }

  /**
   * 置顶面板（递增 z-index，确保最近点击在最前）
   */
  _raisePanel(panel) {
    if (panel._closed || panel.classList.contains('hidden')) return;
    this._bringToFrontCounter++;
    panel.style.zIndex = String(this._bringToFrontCounter);
    this.activePanelId = panel.dataset.panelKey || panel.id;
    const idx = this.windowOrder.indexOf(panel);
    if (idx !== -1) this.windowOrder.splice(idx, 1);
    this.windowOrder.push(panel);
    this._updateBtnStates();
  }

  // ==========================================================================
  //  窗口缩放自适应（防止面板被挤出视口外）
  // ==========================================================================

  _initResizeHandler() {
    window.addEventListener('resize', () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        for (const panel of this.panels) {
          if (panel._closed || panel.classList.contains('hidden')) continue;
          if (!this._isWithinViewport(panel)) {
            this._smartPosition(panel);
          }
        }
      }, 120);
    });
  }

  /** 检查面板矩形是否（基本）位于当前视口内 */
  _isWithinViewport(panel) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = panel.getBoundingClientRect();
    const tol = 8; // 允许 8px 容差，避免边缘闪烁
    return rect.left >= -tol && rect.top >= -tol
        && rect.right <= vw + tol && rect.bottom <= vh + tol;
  }

  // ==========================================================================
  //  智能避让算法（重点）
  // ==========================================================================

  /**
   * 智能避让：为新弹出的面板寻找最佳位置
   *
   * 策略：
   * 1. 首选面板对应的"默认位置"（根据不同面板类型分布到屏幕四角）
   * 2. 如果与现有窗口重叠，尝试偏移
   * 3. 如果偏移仍然重叠，尝试其他备选位置
   * 4. 尽量避免遮挡画面中央 3D 星空核心区域（屏幕中心 60% 区域）
   * 5. 最后保证至少标题栏可见
   */
  _smartPosition(panel) {
    const panelW = panel.offsetWidth || 280;
    const panelH = panel.offsetHeight || 300;

    // 获取候选位置列表
    const candidates = this._getPositionCandidates(panel.id, panelW, panelH);

    // 遍历候选位置，找到第一个不重叠的位置
    for (const pos of candidates) {
      if (!this._isOverlapping(pos, panelW, panelH)) {
        this._applyPosition(panel, pos);
        return;
      }
    }

    // 所有位置都重叠（常见于小窗口）→ 使用默认位置并强制钳制在视口内，
    // 保证面板主体不被挤出屏幕（而不只是标题栏可见）
    const defaultPos = candidates[0];
    this._applyPosition(panel, this._clampToViewport(defaultPos, panelW, panelH));
  }

  /**
   * 将面板位置钳制在当前视口内（小窗口时保证面板主体可见）
   */
  _clampToViewport(pos, panelW, panelH) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    const bottomBarH = 80;
    const safeBottom = Math.max(margin, vh - bottomBarH - margin);

    const finite = (v) => typeof v === 'number' && Number.isFinite(v);
    let left = finite(pos.left) ? pos.left : margin;
    let top  = finite(pos.top)  ? pos.top  : margin;

    const maxLeft = Math.max(margin, vw - panelW - margin);
    const maxTop  = Math.max(margin, safeBottom - panelH);

    left = Math.max(margin, Math.min(left, maxLeft));
    top  = Math.max(margin, Math.min(top, maxTop));

    return { left, top };
  }

  /**
   * 获取面板的候选位置列表（按优先级排序）
   */
  _getPositionCandidates(panelId, panelW, panelH) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 16;
    const bottomBarH = 80; // 底部底栏高度（近似）
    const safeBottom = vh - bottomBarH - margin;

    // 每个面板的默认位置 （定义在 mockup 中）
    // 按优先级产生多个候选位置

    // 1. 默认位置
    const def = this.defaultPositions[panelId] || { right: 16, top: 16 };

    // 2. 根据面板类型决定首选区域，将面板分配到不同象限
    const quadrantMap = {
      'control-panel':     'top-left',
      'hud-panel':         'top-right',
      'measurement-panel': 'bottom-right',
      'spacetime-panel':   'bottom-right',
      'vr-status':         'bottom-left',
    };

    const preferredQuadrant = quadrantMap[panelId] || 'top-left';

    // 生成候选位置列表（8个候选位置）
    const candidates = [];

    // 候选1: 面板默认位置
    candidates.push(this._makePos(def, vw, vh, margin, safeBottom, panelW));

    // 候选2-3: 首选象限内的微调位置（偏移 ± panelW/2）
    const baseQuadrantPos = this._getQuadrantPosition(preferredQuadrant, panelW, panelH, margin, safeBottom);
    if (baseQuadrantPos) {
      candidates.push(baseQuadrantPos);
      // 偏移候选
      candidates.push({ left: baseQuadrantPos.left + 20, top: baseQuadrantPos.top + 20 });
      candidates.push({ left: baseQuadrantPos.left - 20, top: baseQuadrantPos.top - 20 });
    }

    // 候选4-7: 四个角落
    candidates.push({ left: margin, top: margin });
    candidates.push({ left: vw - panelW - margin, top: margin });
    candidates.push({ left: margin, top: safeBottom - panelH });
    candidates.push({ left: vw - panelW - margin, top: safeBottom - panelH });

    // 候选8-10: 四边中间
    candidates.push({ left: (vw - panelW) / 2, top: margin });
    candidates.push({ left: margin, top: (vh - panelH) / 2 - 50 });
    candidates.push({ left: vw - panelW - margin, top: (vh - panelH) / 2 - 50 });

    // 候选11: 中心偏上（但避开核心区域） 
    candidates.push({ left: vw * 0.15, top: vh * 0.1 });
    candidates.push({ left: vw * 0.55, top: vh * 0.1 });

    return candidates;
  }

  _makePos(def, vw, vh, margin, safeBottom, panelW) {
    let left, top;
    if (def.left !== undefined) {
      left = def.left;
    } else if (def.right !== undefined) {
      left = vw - def.right - panelW;
    } else {
      left = margin;
    }

    if (def.top !== undefined) {
      top = def.top;
    } else if (def.bottom !== undefined) {
      top = safeBottom - def.bottom;
    } else {
      top = margin;
    }

    return { left: Math.max(margin, left), top: Math.max(margin, top) };
  }

  _getQuadrantPosition(quadrant, panelW, panelH, margin, safeBottom) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    switch (quadrant) {
      case 'top-left':
        return { left: margin, top: margin };
      case 'top-right':
        return { left: vw - panelW - margin, top: margin };
      case 'bottom-left':
        return { left: margin, top: safeBottom - panelH };
      case 'bottom-right':
        return { left: vw - panelW - margin, top: safeBottom - panelH };
      default:
        return { left: margin, top: margin };
    }
  }

  /**
   * 检查位置是否与现有可见面板重叠
   * 并避开屏幕中心的 3D 星空核心区域
   */
  _isOverlapping(pos, panelW, panelH) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // 新面板的边界
    const newRect = {
      left: pos.left,
      top: pos.top,
      right: pos.left + panelW,
      bottom: pos.top + panelH,
    };

    // ========== 核心区域避让 ==========
    // 3D 星空核心区域：屏幕中心 60% 区域
    const coreMarginX = vw * 0.2;
    const coreMarginY = vh * 0.2;
    const coreRect = {
      left: coreMarginX,
      top: coreMarginY,
      right: vw - coreMarginX,
      bottom: vh - coreMarginY,
    };

    // 计算新面板与核心区域的重叠面积
    const overlapW = Math.max(0, Math.min(newRect.right, coreRect.right) - Math.max(newRect.left, coreRect.left));
    const overlapH = Math.max(0, Math.min(newRect.bottom, coreRect.bottom) - Math.max(newRect.top, coreRect.top));
    const overlapArea = overlapW * overlapH;
    const panelArea = panelW * panelH;

    // 如果超过 30% 的面积覆盖了核心区域，认为重叠
    if (panelArea > 0 && overlapArea / panelArea > 0.3) {
      return true;
    }

    // ========== 与现有弹窗重叠检测 ==========
    for (const panel of this.panels) {
      if (panel._closed || panel.classList.contains('hidden')) continue;
      if (panel._minimized) continue; // 最小化的不参与避让（只占标题栏空间）

      const panelRect = panel.getBoundingClientRect();

      // 检查矩形重叠
      const overlapX = Math.max(0, Math.min(newRect.right, panelRect.right) - Math.max(newRect.left, panelRect.left));
      const overlapY = Math.max(0, Math.min(newRect.bottom, panelRect.bottom) - Math.max(newRect.top, panelRect.top));

      if (overlapX > 10 && overlapY > 10) {
        // 有显著重叠
        const overlapArea2 = overlapX * overlapY;
        const panelArea2 = panelW * panelH;
        const existingArea = panelRect.width * panelRect.height;

        // 如果重叠面积超过任一面板面积的 25%，认为被遮挡
        if (panelArea2 > 0 && existingArea > 0) {
          const ratio1 = overlapArea2 / panelArea2;
          const ratio2 = overlapArea2 / existingArea;
          if (ratio1 > 0.25 || ratio2 > 0.25) {
            return true;
          }
        }
      }
    }

    // ========== 边界检测 ==========
    if (newRect.right > vw - 8 || newRect.bottom > vh - 88) {
      return true;
    }

    return false;
  }

  /**
   * 应用位置到面板
   */
  _applyPosition(panel, pos) {
    panel.style.left = pos.left + 'px';
    panel.style.top = pos.top + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.transform = 'none';
    panel.style.position = 'fixed';
  }

  // ==========================================================================
  //  批量操作
  // ==========================================================================

  /**
   * 一键全部最小化
   */
  _minimizeAll() {
    for (const panel of this.panels) {
      if (panel._closed || panel.classList.contains('hidden')) continue;
      if (!panel._minimized) {
        panel._minimized = true;
        panel.classList.add('panel-minimized');
        this.minimizedPanels.add(panel);
      }
    }
    this._updateBtnStates();
  }

  /**
   * 一键全部关闭
   */
  _closeAll() {
    for (const panel of this.panels) {
      if (panel._closed || panel.classList.contains('hidden')) continue;
      panel._closed = true;
      panel.classList.add('hidden');
      this.minimizedPanels.delete(panel);
    }
    this.activePanelId = null;
    this._updateBtnStates();
  }

  // ==========================================================================
  //  拖拽系统
  // ==========================================================================

  _initDragSystem() {
    for (const panel of this.panels) {
      const titleBar = panel.querySelector('.panel-titlebar');
      if (!titleBar) continue;

      titleBar.addEventListener('mousedown', (e) => this._onDragStart(e, panel));
      titleBar.addEventListener('touchstart', (e) => this._onDragStart(e, panel), { passive: false });
    }
  }

  _onDragStart(e, panel) {
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const rect = panel.getBoundingClientRect();
    this.dragState = {
      panel,
      offsetX: clientX - rect.left,
      offsetY: clientY - rect.top,
    };

    // 切换到固定定位
    panel.style.left = rect.left + 'px';
    panel.style.top = rect.top + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.transform = 'none';
    panel.style.position = 'fixed';
    this._raisePanel(panel);
    panel.classList.add('dragging');

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

    // 限制在视口内
    const panel = this.dragState.panel;
    const maxLeft = window.innerWidth - 60;
    const maxTop = window.innerHeight - 88; // 留出底栏空间
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

    if (this.dragState) {
      this.dragState.panel.classList.remove('dragging');
      this.dragState = null;
    }
  }

  // ==========================================================================
  //  置顶系统
  // ==========================================================================

  _initBringToFront() {
    this._bringToFrontCounter = this._baseZ + 50; // 从 ~100 开始递增

    // 全局文档监听器（兜底）
    document.addEventListener('mousedown', (e) => {
      // 点击浮动菜单外部时关闭
      if (this.attachedSubPanel && this.attachedSubPanel.classList.contains('sub-panel-open')) {
        if (!this.attachedSubPanel.contains(e.target) && !e.target.closest('[data-attached="true"]')) {
          this._hideSubPanel();
        }
      }
      this._raiseOnClick(e);
    });

    // 每个面板自身监听 mousedown，确保 body 区域也能触发
    for (const panel of this.panels) {
      panel.addEventListener('mousedown', (e) => {
        if (e.target.closest('.panel-action-btn')) return;
        this._raiseOnClick(e);
      });
    }
  }

  _raiseOnClick(e) {
    const panel = e.target.closest('.panel');
    if (!panel) return;
    if (panel._closed || panel.classList.contains('hidden')) return;
    if (e.target.closest('.panel-action-btn')) return;
    this._raisePanel(panel);
  }

  // ==========================================================================
  //  按钮状态更新
  // ==========================================================================

  _updateBtnStates() {
    if (!this.topBarEl) return;
    const buttons = this.topBarEl.querySelectorAll('.bottom-bar-btn:not([data-attached="true"])');
    for (const btn of buttons) {
      const panelId = btn.dataset.panelId;
      const panel = this.panelMap.get(panelId);
      if (!panel) continue;

      const isOpen = !panel._closed && !panel.classList.contains('hidden');
      const isActive = this.activePanelId === panelId;

      btn.classList.toggle('active', isOpen);
      btn.classList.toggle('topmost', isActive && isOpen);

      if (isOpen) {
        btn.title = panel._minimized ? `恢复 ${btn.textContent}` : `${btn.textContent} (已打开，点击置顶)`;
      } else {
        btn.title = `打开 ${btn.textContent}`;
      }
    }
    this._updateCustomControlStates();
  }

  // ==========================================================================
  //  公共方法
  // ==========================================================================

  /**
   * 检查面板是否可见
   */
  isPanelVisible(panelId) {
    const panel = this.panelMap.get(panelId);
    if (!panel) return false;
    return !panel._closed && !panel.classList.contains('hidden');
  }

  /**
   * 打开指定面板（外部调用）
   */
  openPanel(panelId) {
    this._togglePanel(panelId);
  }
}
