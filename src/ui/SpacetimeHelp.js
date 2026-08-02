/**
 * SpacetimeHelp — Minkowski 时空图 交互式概念说明（Help）
 *
 * · ⓘ 按钮：位于时空图面板标题栏右侧，点击弹出「什么是时空图？」说明
 *   —— 内容随当前参考系变化（Earth Frame / Ship Frame）
 * · 图例点击：单画布（earth / ship）模式下，点击图例项或图中事件点弹出对应概念说明
 * · 并列模式（sideBySide）不显示 ⓘ 按钮，也不启用图例点击说明
 * · 弹层为固定在 body 上的小型 Popover（避免被面板 overflow:hidden 裁切），
 *   半透明玻璃质地，点击 ⓘ / 空白处 / Esc 或再次点击关闭，每次只显示一个。
 *
 * 不修改任何绘图逻辑与现有交互。
 */

// ── ⓘ 说明内容（随参考系切换） ──
const INFO_CONTENT = {
  earth: {
    title: '什么是时空图？',
    color: '#7dd3fc',
    body:
      '时空图（Minkowski Diagram）是一种利用“空间（x）”和“时间（ct）”描述物体运动状态的可视化工具。' +
      '在地球参考系中，地球保持静止，因此地球世界线始终竖直；飞船向右运动，因此飞船世界线向右倾斜，' +
      '速度越接近光速，世界线越接近光锥。' +
      '通过观察世界线、光锥和同时线，可以直观理解狭义相对论中的时间膨胀以及不同速度下的运动关系。'
  },
  ship: {
    title: '什么是时空图？',
    color: '#facc15',
    body:
      '时空图（Minkowski Diagram）仍然描述物体在时空中的运动，只是观察者变成了飞船。' +
      '在飞船参考系中，飞船保持静止，因此飞船世界线始终竖直；地球相对飞船向左运动，因此地球世界线向左倾斜。' +
      '由于参考系发生改变，同时线的方向也会改变，这体现了狭义相对论中的“同时性的相对性”。' +
      '通过切换参考系，可以观察同一运动过程在不同观察者眼中的时空几何关系。'
  }
};

// ── 图例 / 事件点概念说明 ──
const CONCEPT_CONTENT = {
  earthWorldline: {
    title: '地球世界线',
    color: '#7dd3fc',
    body:
      '表示地球在时空中的运动轨迹。' +
      '在地球参考系中，地球保持静止，因此世界线竖直。' +
      '在飞船参考系中，地球相对飞船向左运动，因此世界线向左倾斜。'
  },
  shipWorldline: {
    title: '飞船世界线',
    color: '#facc15',
    body:
      '表示飞船在时空中的运动轨迹。' +
      '在地球参考系中，飞船速度越大，世界线越接近光锥。' +
      '在飞船参考系中，飞船始终认为自己静止，因此世界线与 ct′ 轴重合。'
  },
  lightCone: {
    title: '光锥',
    color: '#8899bb',
    body:
      '光锥表示光在时空中的传播方向。' +
      '任何具有质量的物体，其世界线都必须位于光锥内部，因此飞船速度可以无限接近光速，但永远不会超过光速。' +
      '光锥在所有惯性参考系中保持不变。'
  },
  simultaneity: {
    title: '同时线',
    color: '#b8a0e0',
    body:
      '同时线表示某一参考系认为“同时发生”的所有事件。' +
      '在地球参考系中，同时线保持水平。' +
      '在飞船参考系中，同时线发生倾斜，体现了狭义相对论中“同时性的相对性”。'
  },
  eventPoint: {
    title: '事件点',
    color: '#ffffff',
    body:
      '事件点表示飞船当前所在的时空位置。' +
      '随着飞船运动，事件点沿飞船世界线移动，用于表示当前时刻对应的空间位置和时间。'
  },
  velocityRef: {
    title: '速度参考线',
    color: '#e8c84a',
    body:
      '速度参考线反映飞船当前速度在时空图中的倾斜程度：速度越大，线条越倾斜，越接近光锥。'
  }
};

export class SpacetimeHelp {
  constructor(state) {
    this.state = state;
    this._currentKey = null; // 'info' | 概念 key | null
  }

  /** 面板隐藏/未找到时安全退出 */
  _safe() {
    return !!(this.el && this.infoBtn);
  }

  init() {
    const panel = document.getElementById('spacetime-panel');
    if (!panel) return;

    // ── ⓘ 按钮：紧跟面板内 h2 标题「Minkowski 时空图」文字之后（无方框圆圈） ──
    //    不放在关闭/缩小按钮所在的标题栏中
    const titleEl = panel.querySelector('h2');
    if (titleEl) {
      const btn = document.createElement('button');
      btn.className = 'st-help-btn';
      btn.id = 'st-help-btn';
      btn.textContent = 'ⓘ';
      btn.title = '时空图概念说明';
      btn.setAttribute('aria-label', '时空图概念说明');
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggleInfo();
      });
      btn.addEventListener('mousedown', (e) => e.stopPropagation());
      btn.addEventListener('touchstart', (e) => e.stopPropagation());
      titleEl.appendChild(btn);
      this.infoBtn = btn;
    }

    // ── 弹层 Popover（挂到 body，避免面板 overflow:hidden 裁切） ──
    const pop = document.createElement('div');
    pop.className = 'st-help-popover';
    pop.id = 'st-help-popover';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', '概念说明');
    pop.setAttribute('aria-hidden', 'true');
    pop.innerHTML = `
      <div class="st-help-arrow"></div>
      <div class="st-help-head">
        <span class="st-help-dot"></span>
        <span class="st-help-title"></span>
        <button class="st-help-close" aria-label="关闭" title="关闭">×</button>
      </div>
      <div class="st-help-body"></div>
    `;
    document.body.appendChild(pop);
    this.el = pop;
    this.elTitle = pop.querySelector('.st-help-title');
    this.elDot = pop.querySelector('.st-help-dot');
    this.elBody = pop.querySelector('.st-help-body');
    pop.querySelector('.st-help-close').addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });

    // ── 点击空白处关闭（单画布点击由画布监听器自行决定打开/关闭） ──
    document.addEventListener('click', (e) => {
      if (!this.isOpen()) return;
      if (pop.contains(e.target)) return;
      if (this.infoBtn && this.infoBtn.contains(e.target)) return;
      if (e.target && e.target.id === 'spacetime-canvas') return; // 单画布点击交给 onDiagramClick 处理
      this.hide();
    });

    // ── Esc 关闭 ──
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });

    this._syncFrame();
  }

  // ==========================================================================
  //  对外接口
  // ==========================================================================

  /** 参考系切换时调用：控制 ⓘ 显隐，并刷新已打开的 ⓘ 说明内容 */
  onFrameChange() {
    this._syncFrame();
  }

  /** 单画布点击：命中图例/事件点则显示说明，点击空白关闭 */
  onDiagramClick(e, diagram) {
    if (!diagram || !this._safe()) return;
    if (diagram._frameOverride) return; // 并列模式不启用图例说明
    const rect = diagram.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const key = diagram.getHitAt(x, y);
    if (!key) {
      this.hide();
      return;
    }
    const anchor = diagram.getAnchor(key);
    this.showConcept(key, {
      x: rect.left + anchor.x,
      y: rect.top + anchor.y
    });
  }

  // ==========================================================================
  //  显示 / 隐藏
  // ==========================================================================

  _toggleInfo() {
    if (!this._safe()) return;
    if (this.isOpen() && this._currentKey === 'info') {
      this.hide();
      return;
    }
    const frame = this.state.frame;
    const content = INFO_CONTENT[frame] || INFO_CONTENT.earth;
    this._currentKey = 'info';
    this._setContent(content);
    const rect = this.infoBtn.getBoundingClientRect();
    this._position({ x: rect.right - 4, y: rect.bottom });
    this._announceOpen();
  }

  /** key: CONCEPT_CONTENT 中的概念 key；anchor: {x, y} 屏幕坐标锚点 */
  showConcept(key, anchor) {
    if (!this._safe()) return;
    const base = CONCEPT_CONTENT[key];
    if (!base) return;
    let content = base;
    if (key === 'simultaneity') {
      // 同时线颜色随当前参考系变化
      content = {
        ...base,
        color: this.state.frame === 'ship' ? '#a8d8ff' : '#b8a0e0'
      };
    }
    this._currentKey = key;
    this._setContent(content);
    this._position(anchor);
    this._announceOpen();
  }

  hide() {
    if (!this._safe()) return;
    this._currentKey = null;
    this.el.classList.remove('open');
    this.el.setAttribute('aria-hidden', 'true');
    this.infoBtn.setAttribute('aria-expanded', 'false');
  }

  isOpen() {
    return this._currentKey !== null;
  }

  // ==========================================================================
  //  内部
  // ==========================================================================

  _setContent({ title, color, body }) {
    this.elTitle.textContent = title;
    this.elTitle.style.color = color;
    this.elDot.style.background = color;
    this.elDot.style.boxShadow = `0 0 8px ${color}`;
    this.elBody.textContent = body;
  }

  _announceOpen() {
    this.el.setAttribute('aria-hidden', 'false');
    this.infoBtn.setAttribute('aria-expanded', 'true');
  }

  _syncFrame() {
    if (!this.el || !this.infoBtn) return;
    const frame = this.state.frame;
    const isSingle = frame === 'earth' || frame === 'ship';
    this.infoBtn.classList.toggle('hidden', !isSingle);
    if (!isSingle) {
      if (this.isOpen()) this.hide();
      return;
    }
    // ⓘ 说明已打开 → 随参考系刷新内容
    if (this._currentKey === 'info') {
      const content = INFO_CONTENT[frame] || INFO_CONTENT.earth;
      this._setContent(content);
    } else if (this._currentKey === 'simultaneity') {
      const base = CONCEPT_CONTENT.simultaneity;
      this._setContent({
        ...base,
        color: frame === 'ship' ? '#a8d8ff' : '#b8a0e0'
      });
    }
  }

  /** 定位弹层：默认在锚点下方、箭头指向锚点；越界时翻转到上方并钳制在视口内 */
  _position(anchor) {
    const pop = this.el;
    pop.classList.remove('open');

    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const M = 10;

    let left = anchor.x - 12;
    let top = anchor.y + 14;
    let arrowSide = 'top';

    if (left + pw > vw - M) left = vw - M - pw;
    if (left < M) left = M;
    if (top + ph > vh - M) {
      top = anchor.y - ph - 14;
      arrowSide = 'bottom';
    }
    if (top < M) top = M;

    const arrow = pop.querySelector('.st-help-arrow');
    let arrowLeft = anchor.x - left;
    arrowLeft = Math.max(14, Math.min(pw - 14, arrowLeft));

    pop.dataset.arrowSide = arrowSide;
    arrow.style.left = `${arrowLeft}px`;
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;

    void pop.offsetWidth; // reflow 后触发过渡
    pop.classList.add('open');
  }
}
