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
 * 文案三语化：内容取自 i18n 字典；切语言时已打开的弹层即时刷新。
 */
import { t, onLangChange } from '../i18n/i18n.js';

// ── 概念颜色元信息（标题/正文在 i18n 字典中） ──
const CONCEPT_COLORS = {
  earthWorldline: '#7dd3fc',
  shipWorldline: '#facc15',
  lightCone: '#8899bb',
  simultaneity: '#b8a0e0',
  eventPoint: '#ffffff',
  velocityRef: '#e8c84a'
};

export class SpacetimeHelp {
  constructor(state) {
    this.state = state;
    this._currentKey = null; // 'info' | 概念 key | null
    onLangChange(() => this.refresh());
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
      btn.title = t('sthelp.btn');
      btn.setAttribute('aria-label', t('sthelp.btn'));
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
    pop.setAttribute('aria-label', t('sthelp.aria'));
    pop.setAttribute('aria-hidden', 'true');
    pop.innerHTML = `
      <div class="st-help-arrow"></div>
      <div class="st-help-head">
        <span class="st-help-dot"></span>
        <span class="st-help-title"></span>
        <button class="st-help-close" aria-label="${t('sthelp.close')}" title="${t('sthelp.close')}">×</button>
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
    const frame = this.state.frame === 'ship' ? 'ship' : 'earth';
    this._currentKey = 'info';
    this._currentFrame = frame;
    this._setContent({
      title: t('sthelp.info.title'),
      color: frame === 'ship' ? '#facc15' : '#7dd3fc',
      body: t(frame === 'ship' ? 'sthelp.info.ship.body' : 'sthelp.info.earth.body')
    });
    const rect = this.infoBtn.getBoundingClientRect();
    this._position({ x: rect.right - 4, y: rect.bottom });
    this._announceOpen();
  }

  /** key: CONCEPT_COLORS 中的概念 key；anchor: {x, y} 屏幕坐标锚点 */
  showConcept(key, anchor) {
    if (!this._safe()) return;
    if (!CONCEPT_COLORS[key]) return;
    let color = CONCEPT_COLORS[key];
    if (key === 'simultaneity') {
      // 同时线颜色随当前参考系变化
      color = this.state.frame === 'ship' ? '#a8d8ff' : '#b8a0e0';
    }
    this._currentKey = key;
    this._currentAnchor = anchor;
    this._setContent({
      title: t(`sthelp.c.${key}.title`),
      color,
      body: t(`sthelp.c.${key}.body`)
    });
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
      this._currentFrame = frame;
      this._setContent({
        title: t('sthelp.info.title'),
        color: frame === 'ship' ? '#facc15' : '#7dd3fc',
        body: t(frame === 'ship' ? 'sthelp.info.ship.body' : 'sthelp.info.earth.body')
      });
    } else if (this._currentKey === 'simultaneity') {
      this._setContent({
        title: t('sthelp.c.simultaneity.title'),
        color: frame === 'ship' ? '#a8d8ff' : '#b8a0e0',
        body: t('sthelp.c.simultaneity.body')
      });
    }
  }

  /** 语言切换后：更新按钮/aria 文本；弹层已打开则按当前 key 重新渲染 */
  refresh() {
    if (!this._safe()) return;
    this.infoBtn.title = t('sthelp.btn');
    this.infoBtn.setAttribute('aria-label', t('sthelp.btn'));
    this.el.setAttribute('aria-label', t('sthelp.aria'));
    const closeBtn = this.el.querySelector('.st-help-close');
    if (closeBtn) {
      closeBtn.title = t('sthelp.close');
      closeBtn.setAttribute('aria-label', t('sthelp.close'));
    }
    if (this._currentKey === 'info') {
      const frame = this._currentFrame === 'ship' ? 'ship' : 'earth';
      this._setContent({
        title: t('sthelp.info.title'),
        color: frame === 'ship' ? '#facc15' : '#7dd3fc',
        body: t(frame === 'ship' ? 'sthelp.info.ship.body' : 'sthelp.info.earth.body')
      });
    } else if (this._currentKey && this._currentAnchor) {
      this.showConcept(this._currentKey, this._currentAnchor);
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
