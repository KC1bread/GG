/**
 * MeasurementHelp — 双测量尺 交互式概念解说
 *
 * · 点击预览中的平行尺 / 垂直尺（或杆上文字标签）→ 弹出对应概念说明
 * · 仅在单模式（earth / ship）启用；并列模式（sideBySide）不弹卡
 * · 弹层复用时空图那套玻璃 Popover 样式（st-help-*），每次只显示一个
 * · 点击空白处 / Esc / × 关闭；不修改任何渲染与拖拽逻辑
 */

// ── 概念文案（HTML，支持 <strong> 加粗关键词；第一句话单独一行） ──
const CONCEPT_CONTENT = {
  parallel: {
    title: '平行尺',
    color: '#ffd36b',
    body:
      '<strong>平行尺：沿飞船运动方向</strong>' +
      '<br>🌍 地球参考系中，沿运动方向缩短至 √(1−β²) 倍；' +
      '🚀 飞船参考系中与飞船相对静止，长度不变。' +
      '<br><strong>Measured（测量模式）</strong>：地球参考系下展示纯长度收缩，' +
      '实际长度 = 固有长度 × √(1−β²)。' +
      '<br><strong>Observed（观察模式）</strong>：地球参考系下叠加 Penrose-Terrell 旋转，' +
      '光传播延迟与光行差使尺子呈与视角相关的倾斜。' +
      '<div class="st-help-sub"><strong>纯长度收缩</strong>：仅展示测量收缩，不旋转。</div>' +
      '<div class="st-help-sub"><strong>P-T 精确</strong>：旋转角按 θ = asin(β·sinα) 计算。</div>' +
      '<div class="st-help-sub"><strong>增强教学</strong>：旋转角 ×1.5 放大，便于观察。</div>'
  },
  perpendicular: {
    title: '垂直尺',
    color: '#eaf4ff',
    body:
      '<strong>垂直尺：垂直于运动方向</strong>' +
      '<br>垂直方向不发生长度收缩，在任意参考系中长度恒为固有长度 5.00，' +
      '作为参照与平行尺对比。'
  }
};

export class MeasurementHelp {
  constructor() {
    this._currentKey = null; // 'parallel' | 'perpendicular' | null
    this.el = null;
    this._viewMode = 'measured'; // 用于平行尺弹卡标题颜色（measured=黄 / observed=蓝）
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
    pop.setAttribute('aria-label', '测量尺概念说明');
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
    let content = CONCEPT_CONTENT[key];
    if (!content) return;
    // 平行尺标题颜色随模式：Observed=蓝（与杆颜色一致），Measured=黄
    if (key === 'parallel' && this._viewMode === 'observed') {
      content = { ...content, color: '#9ad8ff' };
    }
    this._currentKey = key;
    this.elTitle.textContent = content.title;
    this.elTitle.style.color = content.color;
    this.elDot.style.background = content.color;
    this.elDot.style.boxShadow = `0 0 8px ${content.color}`;
    this.elBody.innerHTML = content.body; // 支持 <strong> 加粗关键词
    this._position(anchor);
    this.el.setAttribute('aria-hidden', 'false');
  }

  /** 由 App 在模式切换时调用，同步弹卡颜色 */
  setViewMode(mode) {
    this._viewMode = mode === 'observed' ? 'observed' : 'measured';
    // 弹层已打开且是平行尺 → 立即刷新颜色
    if (this._currentKey === 'parallel' && this.el) {
      const color = this._viewMode === 'observed' ? '#9ad8ff' : CONCEPT_CONTENT.parallel.color;
      this.elTitle.style.color = color;
      this.elDot.style.background = color;
      this.elDot.style.boxShadow = `0 0 8px ${color}`;
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
