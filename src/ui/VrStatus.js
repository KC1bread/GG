/**
 * VrStatus — live WebXR capability + session status for the VR status panel.
 * Replaces the old static placeholder text with real device state.
 */
export class VrStatus {
  constructor(renderer) {
    this.renderer = renderer;
    this.iconEl   = document.getElementById('vr-status-icon');
    this.titleEl  = document.getElementById('vr-status-title');
    this.detailEl = document.getElementById('vr-status-detail');
    this._controllerCount = 0;
  }

  init() {
    if (!this.detailEl) return;

    this.renderer.xr.addEventListener('sessionstart', () => {
      this._refresh(true);
    });
    this.renderer.xr.addEventListener('sessionend', () => {
      this._controllerCount = 0;
      this._refresh(false);
    });
    this.renderer.xr.addEventListener('inputsourceschange', (e) => {
      if (e.added)   this._controllerCount += e.added.length;
      if (e.removed) this._controllerCount -= e.removed.length;
      this._refresh(this.renderer.xr.isPresenting);
    });

    this._refresh(false);
  }

  async _refresh(presenting) {
    const support = await this._detectSupport();

    if (presenting) {
      this._render('🥽', 'VR 会话进行中',
        this._controllerCount > 0
          ? `已连接 ${this._controllerCount} 只手柄。`
          : '已进入 VR，未检测到手柄。',
        '右手摇杆前进/转向 · 右扳机加速 · 左扳机减速 · 左X键跳转行星。');
    } else if (support === 'unsupported') {
      this._render('🚫', '不支持 VR',
        '当前浏览器或访问环境不支持 WebXR。',
        '请使用支持 WebXR 的浏览器（Chrome/Edge），并通过 HTTPS 地址访问本页。');
    } else {
      this._render('🥽', 'VR 设备就绪',
        '已检测到 WebXR 支持，尚未进入 VR。',
        '点击下方按钮进入沉浸式 VR。');
    }
  }

  async _detectSupport() {
    if (!('xr' in navigator)) return 'unsupported';
    try {
      const ok = await navigator.xr.isSessionSupported('immersive-vr');
      return ok ? 'supported' : 'unsupported';
    } catch {
      return 'unsupported';
    }
  }

  _render(icon, title, detail, note) {
    if (this.iconEl)   this.iconEl.textContent = icon;
    if (this.titleEl)  this.titleEl.textContent = title;
    if (this.detailEl) {
      this.detailEl.innerHTML = `<p>${detail}</p><p class="small-note">${note}</p>`;
    }
  }
}
