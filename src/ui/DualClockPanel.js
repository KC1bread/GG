import { computeRelativityState } from '../physics/relativity.js';

/**
 * DualClockPanel — DOM-driven dual clock for time-dilation visualization.
 *
 * Shows Earth clock (coordinate time t) and Ship clock (proper time τ)
 * side-by-side with animated progress bars.  Injected into #hud-panel
 * below the existing <dl> grid.
 */
export class DualClockPanel {
  constructor(state) {
    this.state = state;
    this._prevEarth = 0;
    this._prevShip = 0;
    this._last = {}; // 缓存上次写入值，避免每帧重复触发 DOM 样式重算
  }

  // -- Initialisation -------------------------------------------------------

  init() {
    const panel = document.querySelector('#hud-panel');
    if (!panel) return;

    const root = document.createElement('div');
    root.id = 'dual-clock';
    root.innerHTML = `
      <div class="dual-clock-row">
        <div class="clock-card earth-card">
          <span class="clock-card-label">🌍 地球钟 t</span>
          <span class="clock-card-value" id="dc-earth-val">0.00 年</span>
          <div class="clock-bar-track">
            <div class="clock-bar-fill earth-bar-fill" id="dc-earth-bar"></div>
          </div>
          <span class="clock-card-hint">坐标时间 · 走得较快</span>
        </div>
        <div class="clock-card ship-card">
          <span class="clock-card-label">🚀 飞船钟 τ</span>
          <span class="clock-card-value" id="dc-ship-val">0.00 年</span>
          <div class="clock-bar-track">
            <div class="clock-bar-fill ship-bar-fill" id="dc-ship-bar"></div>
          </div>
          <span class="clock-card-hint">固有时间 · 走得较慢</span>
        </div>
      </div>
      <div class="dual-clock-gap">
        地球多过的岁月：<span id="dc-gap-val">0.00 年</span>
      </div>
    `;

    panel.appendChild(root);

    this.el = {
      earthVal: root.querySelector('#dc-earth-val'),
      shipVal:  root.querySelector('#dc-ship-val'),
      earthBar: root.querySelector('#dc-earth-bar'),
      shipBar:  root.querySelector('#dc-ship-bar'),
      gapVal:   root.querySelector('#dc-gap-val')
    };
  }

  // -- Per-frame update -----------------------------------------------------

  _setText(key, value) {
    const k = 't:' + key;
    if (this._last[k] === value) return;
    this._last[k] = value;
    this.el[key].textContent = value;
  }

  _setWidth(key, pct) {
    const value = (Math.round(pct * 2) / 2) + '%'; // 量化到 0.5%，减少样式重算
    const k = 'w:' + key;
    if (this._last[k] === value) return;
    this._last[k] = value;
    this.el[key].style.width = value;
  }

  _setColor(key, value) {
    const k = 'c:' + key;
    if (this._last[k] === value) return;
    this._last[k] = value;
    this.el[key].style.color = value;
  }

  _setBackground(key, value) {
    const k = 'b:' + key;
    if (this._last[k] === value) return;
    this._last[k] = value;
    this.el[key].style.background = value;
  }

  update(r) {
    if (!this.el) return;

    // Smooth interpolation (exponential moving average)
    const alpha = 0.18;
    this._prevEarth += (r.earthTime - this._prevEarth) * alpha;
    this._prevShip  += (r.shipTime  - this._prevShip)  * alpha;

    // Clock digits
    this._setText('earthVal', this._prevEarth.toFixed(3) + ' 年');
    this._setText('shipVal',  this._prevShip.toFixed(3)  + ' 年');

    // Gap display
    const gap = Math.max(0, this._prevEarth - this._prevShip);
    this._setText('gapVal', gap.toFixed(3) + ' 年');

    // Bar widths — both fill relative to the larger of the two
    const maxTime = Math.max(this._prevEarth, this._prevShip, 0.001);
    const earthPct = (this._prevEarth / maxTime) * 100;
    const shipPct  = (this._prevShip  / maxTime) * 100;

    this._setWidth('earthBar', earthPct);
    this._setWidth('shipBar',  shipPct);

    // Dynamic colour: earth gets warmer red as gap grows, ship stays cool blue
    const gapRatio = this._prevEarth > 0.01
      ? Math.min(1, gap / this._prevEarth)
      : 0;

    // 颜色量化到 5 的倍数，减少字符串变化频率
    const warmR = Math.round((120 + gapRatio * 135) / 5) * 5;
    const warmG = Math.round((180 - gapRatio * 140) / 5) * 5;
    const warmB = Math.round((220 - gapRatio * 160) / 5) * 5;
    this._setColor('earthVal', `rgb(${warmR}, ${warmG}, ${warmB})`);
    this._setBackground('earthBar',
      `linear-gradient(90deg, #ff9966, rgb(${warmR}, ${Math.max(40, warmG)}, ${Math.max(60, warmB)}))`);

    const coolR = Math.round((100 - gapRatio * 40) / 5) * 5;
    const coolG = Math.round((160 - gapRatio * 40) / 5) * 5;
    this._setColor('shipVal', `rgb(${coolR}, ${coolG}, 255)`);

    // Fade gap text when beta is negligible
    const gapEl = this.el.gapVal.parentElement;
    if (gapEl) {
      const opacity = gapRatio < 0.005 ? '0.4' : '1';
      if (this._last.opacity !== opacity) {
        this._last.opacity = opacity;
        gapEl.style.opacity = opacity;
      }
    }
  }

  // -- Resize (no-op — DOM handles layout via CSS) --------------------------

  resize() {
    // DOM-based; CSS flexbox handles responsive sizing.
  }
}
