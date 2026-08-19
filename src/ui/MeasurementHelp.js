/**
 * MeasurementHelp — 双测量尺 交互式概念解说
 *
 * · 点击预览中的平行尺 / 垂直尺（或杆上文字标签）→ 弹出对应概念说明
 * · 仅在单模式（earth / ship）启用；并列模式（sideBySide）不弹卡
 * · 弹层复用时空图那套玻璃 Popover 样式（st-help-*），每次只显示一个
 * · 点击空白处 / Esc / × 关闭；不修改任何渲染与拖拽逻辑
 * · 文案三语化：内容取自 i18n 字典，切语言时已打开的弹层即时刷新
 */
import { t, onLangChange } from '../i18n/i18n.js';

// ── 概念元信息（颜色 + i18n key；正文为 HTML，支持 <strong> 加粗） ──
const CONCEPT_META = {
  parallel: {
    color: '#ffd36b',
    titleKey: 'mhelp.parallel.title',
    bodyKey: 'mhelp.parallel.body'
  },
  perpendicular: {
    color: '#eaf4ff',
    titleKey: 'mhelp.perp.title',
    bodyKey: 'mhelp.perp.body'
  }
};

export class MeasurementHelp {
  constructor() {
    this._currentKey = null; // 'parallel' | 'perpendicular' | null
    this._currentAnchor = null;
    this.el = null;
    this._viewMode = 'measured'; // 用于平行尺弹卡标题颜色（measured=黄 / observed=蓝）
    onLangChange(() => this.refresh());
  }

  _safe() {
    return !!(this.el && this.previewCanvas);
  }

  init() {
    // ── 弹层 Popover（挂到 body，避免面板 overflow:hidden 裁切） ──
    const pop = document.createElement('div');
    pop.className = 'st-help-popover';
    pop.id = 'measurement-help-popover';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', t('mhelp.aria'));
    pop.setAttribute('aria-hidden', 'true');
    pop.innerHTML = `
      <div class="st-help-arrow"></div>
      <div class="st-help-head">
        <span class="st-help-dot"></span>
        <span class="st-help-title"></span>
        <button class="st-help-close" aria-label="${t('mhelp.close')}" title="${t('mhelp.close')}">×</button>
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

    // ── 点击空白处关闭（预览画布点击交给 onDiagramClick 处理） ──
    document.addEventListener('click', (e) => {
      if (!this.isOpen()) return;
      if (pop.contains(e.target)) return;
      if (e.target && e.target.id === 'measurement-preview-canvas') return; // 单画布点击自行处理
      this.hide();
    });

    // ── Esc 关闭 ──
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });
  }

  /** 绑定可点击的预览画布（单模式画布） */
  attachPreview(canvas, preview) {
    this.previewCanvas = canvas;
    this.preview = preview;
    canvas.addEventListener('click', (e) => {
      this.onPreviewClick(e);
    });
  }

  // ==========================================================================
  //  对外接口
  // ==========================================================================

  /** 预览画布点击：命中平行尺/垂直尺 → 弹卡，空白 → 关闭 */
  onPreviewClick(e) {
    if (!this._safe()) return;
    const hit = this.preview?.getHitRod(e);
    if (!hit) {
      this.hide();
      return;
    }
    const rect = this.previewCanvas.getBoundingClientRect();
    this.showConcept(hit.key, {
      x: rect.left + hit.screenX,
      y: rect.top + hit.screenY
    });
  }

  /** 参考系/模式切换时：并列模式关闭弹层 */
  onStateChange() {
    // 并列模式下由 App 直接调用 hide()（若需要）
  }

  hide() {
    if (!this._safe()) return;
    this._currentKey = null;
    this.el.classList.remove('open');
    this.el.setAttribute('aria-hidden', 'true');
  }

  isOpen() {
    return this._currentKey !== null;
  }

  /** key: 'parallel' | 'perpendicular'；anchor: {x, y} 屏幕坐标 */
  showConcept(key, anchor) {
    if (!this._safe()) return;
    const meta = CONCEPT_META[key];
    if (!meta) return;
    // 平行尺标题颜色随模式：Observed=蓝（与杆颜色一致），Measured=黄
    let color = meta.color;
    if (key === 'parallel' && this._viewMode === 'observed') color = '#9ad8ff';
    this._currentKey = key;
    this._currentAnchor = anchor;
    this.elTitle.textContent = t(meta.titleKey);
    this.elTitle.style.color = color;
    this.elDot.style.background = color;
    this.elDot.style.boxShadow = `0 0 8px ${color}`;
    this.elBody.innerHTML = t(meta.bodyKey); // 支持 <strong> 加粗关键词
    this._position(anchor);
    this.el.setAttribute('aria-hidden', 'false');
  }

  /** 由 App 在模式切换时调用，同步弹卡颜色 */
  setViewMode(mode) {
    this._viewMode = mode === 'observed' ? 'observed' : 'measured';
    // 弹层已打开且是平行尺 → 立即刷新颜色
    if (this._currentKey === 'parallel' && this.el) {
      const color = this._viewMode === 'observed' ? '#9ad8ff' : CONCEPT_META.parallel.color;
      this.elTitle.style.color = color;
      this.elDot.style.background = color;
      this.elDot.style.boxShadow = `0 0 8px ${color}`;
    }
  }

  /** 语言切换后：更新 aria 文本；若弹层已打开则重新渲染内容 */
  refresh() {
    if (!this._safe()) return;
    this.el.setAttribute('aria-label', t('mhelp.aria'));
    const closeBtn = this.el.querySelector('.st-help-close');
    if (closeBtn) {
      closeBtn.title = t('mhelp.close');
      closeBtn.setAttribute('aria-label', t('mhelp.close'));
    }
    if (this._currentKey && this._currentAnchor) {
      this.showConcept(this._currentKey, this._currentAnchor);
    }
  }

  // ==========================================================================
  //  内部
  // ==========================================================================

  /** 定位弹层：默认在锚点下方，越界翻转到上方并钳制在视口内 */
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
