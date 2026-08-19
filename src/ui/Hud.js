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
  constructor(state) {
    this.state = state;
    this.el = {
      beta: document.getElementById('hud-beta'),
      gamma: document.getElementById('hud-gamma'),
      earthTime: document.getElementById('hud-earth-time'),
      shipTime: document.getElementById('hud-ship-time'),
      earthDistance: document.getElementById('hud-earth-distance'),
      shipDistance: document.getElementById('hud-ship-distance'),
      eta: document.getElementById('hud-eta'),
      lengthRatio: document.getElementById('hud-length-ratio'),
      badge: document.getElementById('mode-badge')
    };
    this._last = {}; // 缓存上次写入文本，避免每帧重复触发 DOM 更新
  }

  _setText(key, value) {
    if (this._last[key] === value) return;
    this._last[key] = value;
    this.el[key].textContent = value;
  }

  update() {
    // Terrell 档位名称映射
    const _terrellNames = {
      lorentzOnly: '纯长度收缩',
      precise: 'Penrose-Terrell精确',
      enhanced: '增强教学'
    };

    const r = computeRelativityState(this.state);
    this._setText('beta', fmt(r.beta, 3));
    this._setText('gamma', fmt(r.gamma, 3));
    this._setText('earthTime', fmtYears(r.earthTime));
    this._setText('shipTime', fmtYears(r.shipTime));
    this._setText('earthDistance', `${fmt(r.earthDistance, 2)} ly`);
    this._setText('shipDistance', `${fmt(r.shipDistance, 2)} ly`);
    this._setText('eta', `${fmtYears(r.etaEarth)} / ${fmtYears(r.etaShip)}`);
    this._setText('lengthRatio', fmt(r.lengthRatio, 3));

    // 顶部状态栏内容
    const frameLabel = this.state.frame === 'earth' ? 'Earth'
      : this.state.frame === 'ship' ? 'Ship'
      : 'Side-by-side';
    const perspectiveLabel = this.state.viewPerspective === 'firstPerson' ? '1P' : '3P';
    const modeLabel = this.state.viewMode === 'measured' ? 'Measured' : 'Observed';
    const effectLabel = this.state.effectMode === 'teaching' ? '教学模式' : '显示模式';
    let modeFull = `${modeLabel} · ${effectLabel}`;
    if (this.state.viewMode === 'observed') {
      const terrellName = _terrellNames[this.state.terrellMode] || this.state.terrellMode;
      modeFull += ` · ${terrellName}`;
    }
    const betaLabel = `β = ${this.state.beta.toFixed(3)}c`;
    this._setText('badge', `${modeFull} | ${frameLabel} | ${perspectiveLabel} | ${betaLabel}`);
  }
}
