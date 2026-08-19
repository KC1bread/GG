# VR 沉浸式体验 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户戴上 VR 眼镜后能 360° 无死角探索近光速飞行场景，用手柄驾驶飞船，且界面实时真实显示 VR 设备连接状态。

**Architecture:** 纯 Three.js v0.185.1 + WebXR。通过「相机 rig（承载飞船位姿）+ 头部姿态」两级结构解耦飞船与头部朝向，解决 360° 探索；通过「语义动作层」把标准 WebXR gamepad 输入映射到既有 `this.keys` 飞行状态，解决手柄操作；通过 `navigator.xr` 能力检测 + `sessionstart/end`/`inputsourceschange` 事件，解决连接显示。所有 VR 改动仅在 `renderer.xr.isPresenting` 时激活，桌面端行为不变。

**Tech Stack:** three 0.185.1（`three/addons/webxr/VRButton.js`、`WebXRManager`）、`@vitejs/plugin-basic-ssl`（HTTPS）、原生 DOM/`navigator.xr`。

## Global Constraints

- **不改动桌面端 UI 与功能**：所有 VR 改动限定在 `renderer.xr.isPresenting` 分支或仅在 XR 会话期间生效；桌面键盘/鼠标路径原样保留。
- **HTTPS 必需**：WebXR 要求安全上下文。LAN/头显访问必须走 `https://<ip>:5173`（自签证书，首次需手动接受）。
- **three.js v0.185.1**；手柄交互基于 WebXR 标准 `inputSource.gamepad`（buttons/axes/handedness），兼容 Quest/Index/Vive/PCVR。
- **参考系**：`renderer.xr.setReferenceSpaceType('local')`（坐姿 cockpit 体验，避免 `local-floor` 的 1.6m 真实地面高度与场景 0.7 单位座舱的比例错配）。
- **UI 文案为中文**；VR 状态面板三态文案见 Task 2。
- **不做**（范围外）：VR 全屏相对论后处理（双眼后处理）、手柄 GLTF 模型、VR 内 3D 化 HUD、手部追踪手势。

---

## 验证方式说明（本计划通用）

本项目 **无测试框架**（`package.json` 无 test script），且 WebXR 的 360° 与手柄行为需**真实头显硬件**验证，无法在无头环境自动断言。因此各任务的验证步骤为：

1. **静态验证**（所有任务可做）：`npm run dev` 启动、浏览器控制台无报错、`navigator.xr` 存在、面板文案正确。
2. **硬件验证**（需 Quest/PCVR 头显，标注「需头显」）：进入 VR、转头 360°、手柄驾驶。
3. 纯逻辑函数（`mapGamepadToActions`）设计为**无副作用纯函数**，便于日后补单元测试（本次不引入测试框架）。

---

## File Structure

| 文件 | 责任 |
|---|---|
| `vite.config.js`（新建） | 启用 HTTPS（`@vitejs/plugin-basic-ssl`），解锁 WebXR |
| `src/ui/VrStatus.js`（新建） | 实时 WebXR 能力检测 + 会话/输入源状态，驱动 `vr-status` 面板 |
| `src/input/VRControllerInput.js`（新建） | 通用 WebXR 手柄驱动 + 纯映射函数 `mapGamepadToActions` |
| `src/core/App.js`（修改） | 相机 rig、XR 相机分支、`setupVr()`、`_vrJumpToPlanet()`、隐藏 DOM |
| `src/ui/PanelManager.js`（修改） | `_createVrStatusPanel` 补充 icon/title 的 `id` 供 VrStatus 更新 |
| `src/style.css`（修改） | `.xr-presenting` 隐藏 2D 覆盖层的 CSS 规则 |

---

### Task 1: 启用 HTTPS（vite.config.js）

**Files:**
- Create: `vite.config.js`

**Interfaces:**
- Consumes: `@vitejs/plugin-basic-ssl`（已在 `package.json` dependencies 中）
- Produces: dev server 以 HTTPS 服务于 `https://localhost:5173` 与 `https://<lan-ip>:5173`；后续所有 WebXR 任务依赖此安全上下文。

- [ ] **Step 1: 创建 vite.config.js**

```js
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [basicSsl()],
});
```

- [ ] **Step 2: 重启 dev server 并验证 HTTPS**

Run: `npm run dev`
Expected 输出（`Network` 与 `Local` 均为 `https://`，且出现自签证书提示属正常）：
```
  ➜  Local:   https://localhost:5173/
  ➜  Network: https://192.168.137.1:5173/
  ➜  Network: https://10.8.105.233:5173/
```

浏览器访问 `https://localhost:5173`，接受自签证书后页面正常加载；在控制台执行 `console.log('xr' in navigator)` 应输出 `true`（安全上下文下 WebXR 可用）。

- [ ] **Step 3: Commit**

```bash
git add vite.config.js
git commit -m "feat(vr): enable HTTPS via @vitejs/plugin-basic-ssl"
```

---

### Task 2: VR 设备连接状态（VrStatus.js + PanelManager 挂钩）

**Files:**
- Create: `src/ui/VrStatus.js`
- Modify: `src/ui/PanelManager.js`（`_createVrStatusPanel` 的 `content.innerHTML`）
- Modify: `src/core/App.js`（`setupUi` 中实例化并 `init()`；顶部 import）

**Interfaces:**
- Consumes: `this.renderer`（App.js 中 `setupThree` 已建）；DOM 元素 `#vr-status-icon`、`#vr-status-title`、`#vr-status-detail`（由本任务在 PanelManager 中补充 id）。
- Produces: `export class VrStatus { constructor(renderer); init(); }` —— App.js 的 `setupUi()` 调用 `new VrStatus(this.renderer).init()`。三态文案：`不支持 / 就绪未连接 / 会话进行中`。

- [ ] **Step 1: 在 PanelManager 中为 icon/title 补充 id，并清空静态 detail**

修改 `src/ui/PanelManager.js` 中 `_createVrStatusPanel()` 的 `content.innerHTML`（当前约 198–209 行），将：

```js
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
```

替换为：

```js
    content.innerHTML = `
      <div class="vr-status-content">
        <div class="vr-status-icon" id="vr-status-icon">🥽</div>
        <div class="vr-status-title" id="vr-status-title">VR 设备状态</div>
        <div class="vr-status-detail" id="vr-status-detail"></div>
        <div id="vr-button-container" class="vr-button-container"></div>
      </div>
    `;
```

- [ ] **Step 2: 创建 VrStatus.js**

```js
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
        '扳机前进 · 左摇杆转向/升降 · 右摇杆加/减速。');
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
```

- [ ] **Step 3: 在 App.js 中接线 VrStatus**

在 `src/core/App.js` 顶部 import 区（约第 21 行 `RelativisticPostProcess` import 之后）添加：

```js
import { VrStatus } from '../ui/VrStatus.js';
```

在 `setupUi()` 内 `this.panelManager.init();`（约第 247 行）之后添加：

```js
    this.vrStatus = new VrStatus(this.renderer);
    this.vrStatus.init();
```

- [ ] **Step 4: 验证状态面板三态**

Run: `npm run dev`，浏览器打开 `https://localhost:5173`，点击开始任务，打开「🥽VR设备」→「VR状态提示」面板。

Expected：
- 非安全上下文（`http://`）访问时：显示「🚫 不支持 VR」，note 提到「HTTPS」。
- HTTPS 且无头显/不支持 immersive-vr 时：显示「🥽 VR 设备就绪」或「🚫 不支持 VR」之一，文案非旧占位。
- （需头显）进入 VR 后：显示「🥽 VR 会话进行中」与手柄数量；退出后回到「就绪」态。

- [ ] **Step 5: Commit**

```bash
git add src/ui/VrStatus.js src/ui/PanelManager.js src/core/App.js
git commit -m "feat(vr): live WebXR capability + session status in VR panel"
```

---

### Task 3: 相机 rig + 360° 探索 + 隐藏 2D UI

**Files:**
- Modify: `src/core/App.js`（`setupThree` 加 rig；新增 `setupVr()`；`init()` 调用；`update()` 相机分支；`sessionstart/end` 处理器）
- Modify: `src/style.css`（`.xr-presenting` 规则）

**Interfaces:**
- Consumes: `this.camera`（setupThree 已建）、`this.scene`、`this.shipPosition`/`this.shipHeading`/`this.firstPersonOffset`（constructor 已建）、`this._setPerspective()`（已有）。
- Produces: `this.cameraRig`（`THREE.Group`，相机父节点，承载飞船位姿）；`this.setupVr()`；`update()` 中 `if (this.renderer.xr.isPresenting)` 分支。

- [ ] **Step 1: 在 setupThree 中创建相机 rig**

在 `src/core/App.js` 的 `setupThree()` 内，`this.camera.lookAt(this.shipPosition);`（第 146 行）之后添加：

```js
    // WebXR 相机 rig：承载飞船位姿的父节点，相机作为子节点（头部姿态叠加其上）
    this.cameraRig = new THREE.Group();
    this.cameraRig.add(this.camera);
    this.scene.add(this.cameraRig);
```

- [ ] **Step 2: 新增 setupVr() 并接入 init()**

在 `setupResize()` 方法（约第 521 行结束）之后新增方法：

```js
  // ---- VR（WebXR）会话与手柄初始化 -----------------------------------------

  setupVr() {
    // 坐姿 cockpit：'local' 参考系（原点=会话开始时的头显位置），
    // 避免 'local-floor' 把真实 ~1.6m 地面高度叠加到 0.7 单位座舱上的比例错配。
    this.renderer.xr.setReferenceSpaceType('local');

    this.vrController = new VRControllerInput(this);
    this.vrController.init();

    this.renderer.xr.addEventListener('sessionstart', () => {
      document.body.classList.add('xr-presenting');
      // VR 只有第一人称有意义：切到 cockpit，隐藏飞船模型，显示座舱
      if (this.state.viewPerspective !== 'firstPerson') {
        this._setPerspective('firstPerson');
      }
      this.freeLookYaw = 0;
      this.freeLookPitch = 0;
    });

    this.renderer.xr.addEventListener('sessionend', () => {
      document.body.classList.remove('xr-presenting');
    });
  }
```

在 `init()` 中 `this.setupResize();`（约第 129 行）之后添加：

```js
    this.setupVr();
```

在 `src/core/App.js` 顶部 import 区添加：

```js
import { VRControllerInput } from '../input/VRControllerInput.js';
```

（`VRControllerInput` 在 Task 4 中创建；本任务先引用，Task 4 落地实现。若顺序执行，可先临时注释 `new VRControllerInput(this)` 两行，Task 4 再启用——但按计划顺序 Task 4 紧随其后，直接一起实现即可。）

- [ ] **Step 3: 在 update() 中加入 XR 相机分支**

将 `src/core/App.js` 的 `update()` 中「---- Camera ----」段（约第 888–914 行）整体替换为：

```js
    // ---- Camera --------------------------------------------------------------
    if (this.renderer.xr.isPresenting) {
      // XR：rig 承载飞船位姿，头部姿态（three.js 自动应用）叠加其上。
      // 不手动写 camera.position/lookAt，避免与头部姿态互相覆盖。
      const fpOffset = this.firstPersonOffset.clone();
      fpOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.shipHeading);
      this.cameraRig.position.copy(this.shipPosition).add(fpOffset);
      this.cameraRig.rotation.set(0, this.shipHeading, 0);
      // 同步 _smoothCamPos，供 Terrell 视向计算使用（头部偏移相对行星距离可忽略）
      this._smoothCamPos.copy(this.cameraRig.position);
    } else if (this.state.viewPerspective === 'firstPerson') {
      const fpOffset = this.firstPersonOffset.clone();
      fpOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.shipHeading);
      const fpCamPos = this.shipPosition.clone().add(fpOffset);

      this._smoothCamPos.lerp(fpCamPos, this.cameraLerp * 2.0);
      this.camera.position.copy(this._smoothCamPos);

      const totalYaw = this.shipHeading + this.freeLookYaw;
      const cosPitch = Math.cos(this.freeLookPitch);
      const lookDir = new THREE.Vector3(
        -Math.sin(totalYaw) * cosPitch,
        Math.sin(this.freeLookPitch),
        -Math.cos(totalYaw) * cosPitch
      );
      this.camera.lookAt(this.camera.position.clone().add(lookDir));
    } else {
      const totalYaw = this.shipHeading + this.freeLookYaw;
      const euler = new THREE.Euler(this.freeLookPitch, totalYaw, 0, 'YXZ');
      const rotatedOffset = this.cameraLocalOffset.clone().applyEuler(euler);
      const desiredCamPos = this.shipPosition.clone().add(rotatedOffset);

      this._smoothCamPos.lerp(desiredCamPos, this.cameraLerp);
      this.camera.position.copy(this._smoothCamPos);
      this.camera.lookAt(this.shipPosition);
    }
```

- [ ] **Step 4: 添加 .xr-presenting CSS（隐藏 2D 覆盖层）**

在 `src/style.css` 末尾追加：

```css
/* ── VR 沉浸模式：进入 XR 会话时隐藏所有 2D DOM 覆盖层 ── */
body.xr-presenting .panel,
body.xr-presenting .bottom-bar,
body.xr-presenting #intro-panel,
body.xr-presenting #crosshair,
body.xr-presenting #tunnel-vignette,
body.xr-presenting #mode-badge,
body.xr-presenting #planet-info-card,
body.xr-presenting .high-speed-effects-guide {
  display: none !important;
}
```

- [ ] **Step 5: 验证桌面无回归 + XR 360°**

静态验证（桌面）：
Run: `npm run dev`，打开 `https://localhost:5173`，确认：第一/第三人称切换、鼠标自由视角、行星点击、HUD 更新均与改动前一致（rig 在桌面模式下保持单位变换，`camera` 局部=世界）。

硬件验证（需头显）：
进入 VR 后，左右转头应能看到不同方向的星空/行星（360° 环视）；左/右看不再被锁定；所有 DOM 面板/准星/暗角消失。退出 VR 后面板恢复。

- [ ] **Step 6: Commit**

```bash
git add src/core/App.js src/style.css
git commit -m "feat(vr): camera rig for 360° exploration + hide DOM overlay in XR"
```

---

### Task 4: 通用手柄操作系统（VRControllerInput.js + 接线）

**Files:**
- Create: `src/input/VRControllerInput.js`
- Modify: `src/core/App.js`（`update()` 顶部调用 `vrController.update()`；新增 `_vrJumpToPlanet()`；constructor 初始化 `_vrPlanetCursor`）

**Interfaces:**
- Consumes: `this.app.renderer`/`this.app.scene`（App 实例）、`this.app.keys`（既有飞行状态）、`this.app._vrJumpToPlanet(delta)`（本任务新增）。
- Produces: `export class VRControllerInput { constructor(app); init(); update(); dispose(); }` 与 `export function mapGamepadToActions(gamepad, handedness)`（纯函数）。
- 映射（默认，右手主控）：右扳机→`keys.forward`；右握持→`keys.backward`；左摇杆X→`left/right`（转向）；左摇杆Y→`up/down`（升降）；右摇杆Y→`shift/ctrl`（β加减）；右 A 键→下一颗行星；左 X 键→上一颗行星。

- [ ] **Step 1: 创建 VRControllerInput.js**

```js
import * as THREE from 'three';

/**
 * VRControllerInput — generic WebXR controller driver.
 *
 * Maps standard WebXR gamepad input (buttons/axes/handedness) to the app's
 * shared `keys` flight state, so App.js.update()'s flight model runs
 * unchanged. Works with Quest Touch / Index / Vive / PCVR.
 */
const AXIS_DEADZONE = 0.15;

/**
 * Pure mapping: one XRInputSource.gamepad → semantic actions.
 * Continuous only (no edge/state); discrete button edges handled in the class.
 *
 * @param {Gamepad} gamepad - XRInputSource.gamepad
 * @param {string} handedness - 'left' | 'right' | 'none'
 * @returns {{forward:boolean,backward:boolean,left:boolean,right:boolean,up:boolean,down:boolean,shift:boolean,ctrl:boolean}}
 */
export function mapGamepadToActions(gamepad, handedness) {
  const axes = gamepad.axes || [];
  const buttons = gamepad.buttons || [];
  const axisX = axes[0] || 0;
  const axisY = axes[1] || 0;

  const actions = {
    forward: false, backward: false,
    left: false, right: false,
    up: false, down: false,
    shift: false, ctrl: false,
  };

  // WebXR 标准按键布局：button[0]=trigger，button[1]=squeeze/grip
  actions.forward  = !!(buttons[0] && buttons[0].pressed);
  actions.backward = !!(buttons[1] && buttons[1].pressed);

  if (handedness === 'left') {
    // 左手：摇杆 X=转向，Y=升降
    if (axisX < -AXIS_DEADZONE) actions.left = true;
    if (axisX >  AXIS_DEADZONE) actions.right = true;
    if (axisY >  AXIS_DEADZONE) actions.up = true;
    if (axisY < -AXIS_DEADZONE) actions.down = true;
  } else {
    // 右手：摇杆 Y=β 加减
    if (axisY >  AXIS_DEADZONE) actions.shift = true;
    if (axisY < -AXIS_DEADZONE) actions.ctrl = true;
  }

  return actions;
}

function buildLaser() {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -3),
  ]);
  const mat = new THREE.LineBasicMaterial({
    color: 0x7dd3fc, transparent: true, opacity: 0.55,
  });
  return new THREE.Line(geo, mat);
}

export class VRControllerInput {
  constructor(app) {
    this.app = app;
    this.renderer = app.renderer;
    this.scene = app.scene;
    this.controllerL = this.renderer.xr.getController(0);
    this.controllerR = this.renderer.xr.getController(1);
    this.gripL = this.renderer.xr.getControllerGrip(0);
    this.gripR = this.renderer.xr.getControllerGrip(1);
    this._prevButtons = new Map(); // handedness -> Array<boolean> (上帧按钮态)
  }

  init() {
    this.controllerL.add(buildLaser());
    this.controllerR.add(buildLaser());
    this.scene.add(this.controllerL, this.controllerR);
    this.scene.add(this.gripL, this.gripR); // 预留 grip space（v1 不渲染模型）
  }

  /** 每帧调用一次，仅在 xr.isPresenting 时。 */
  update() {
    const session = this.renderer.xr.getSession();
    if (!session) return;

    const k = this.app.keys;
    // 手柄是 XR 内唯一输入源，先清空再写入
    k.forward = false; k.backward = false;
    k.left = false; k.right = false;
    k.up = false; k.down = false;
    k.shift = false; k.ctrl = false;

    for (const source of session.inputSources) {
      const gp = source.gamepad;
      if (!gp) continue;

      const a = mapGamepadToActions(gp, source.handedness);
      k.forward  = k.forward  || a.forward;
      k.backward = k.backward || a.backward;
      k.left     = k.left     || a.left;
      k.right    = k.right    || a.right;
      k.up       = k.up       || a.up;
      k.down     = k.down     || a.down;
      k.shift    = k.shift    || a.shift;
      k.ctrl     = k.ctrl     || a.ctrl;

      this._handleButtonEdges(source.handedness, gp.buttons);
    }
  }

  _handleButtonEdges(handedness, buttons) {
    const now = buttons.map((b) => !!b.pressed);
    const prev = this._prevButtons.get(handedness) || [];

    // button[4] = Quest A（右）/ X（左），也是多数手柄的主按键
    const nowMain = !!now[4];
    const prevMain = !!prev[4];
    if (nowMain && !prevMain) {
      if (handedness === 'right') this.app._vrJumpToPlanet(+1);
      else this.app._vrJumpToPlanet(-1);
    }

    this._prevButtons.set(handedness, now);
  }

  dispose() {
    this.scene.remove(this.controllerL, this.controllerR, this.gripL, this.gripR);
  }
}
```

- [ ] **Step 2: 在 App.js 中接线手柄驱动 + 新增行星循环跳转**

在 `src/core/App.js` 的 `update()` 中，紧接 `const effectiveMode = ...`（约第 777 行）之后、`// ---- Keyboard flight`（约第 779 行）之前添加：

```js
    if (this.renderer.xr.isPresenting) {
      this.vrController.update();
    }
```

在 `_handlePlanetJump(planetIndex)` 方法（约第 536 行）之前新增：

```js
  /** 手柄循环跳转：delta +1 下一颗 / -1 上一颗（0..7 回绕） */
  _vrJumpToPlanet(delta) {
    if (this._vrPlanetCursor == null) this._vrPlanetCursor = 0;
    this._vrPlanetCursor = (this._vrPlanetCursor + delta + 8) % 8;
    this._handlePlanetJump(this._vrPlanetCursor);
  }
```

在 `constructor()` 中（约第 110 行 `this._smoothCamPos = new THREE.Vector3();` 附近）添加：

```js
    this._vrPlanetCursor = 0;   // 手柄行星跳转游标（0..7）
```

- [ ] **Step 3: 验证手柄驾驶**

硬件验证（需头显）：
进入 VR（确保「Observed + 第一人称」以体验完整相对论效果与行星跳转）：
- 右手扳机按住 → 飞船前进；松开 → 减速停止。
- 右手握持 → 刹车/后退。
- 左手摇杆左/右 → 飞船转向；上/下 → 上升/下降。
- 右手摇杆上/下 → β 增大/减小（HUD 的 β 值变化）。
- 右手 A / 左手 X 键 → 行星循环跳转（仅在第一人称 + observed 时生效，与键盘 1–8 语义一致）。
- 蓝色激光射线可见，指向方向随手柄移动。

- [ ] **Step 4: Commit**

```bash
git add src/input/VRControllerInput.js src/core/App.js
git commit -m "feat(vr): generic WebXR controller input mapped to flight model"
```

---

## Self-Review（对照 spec 的缺口检查）

- **问题一（360°）** → Task 3（相机 rig + XR 相机分支 + 隐藏 DOM）✅
- **问题二（手柄）** → Task 4（`VRControllerInput` + 语义映射 + 行星跳转）✅
- **问题三（连接显示）** → Task 1（HTTPS 前置）+ Task 2（`VrStatus` 三态检测）✅
- **HTTPS 阻塞项** → Task 1 ✅
- **参考系 `local`** → Task 3 Step 2 ✅
- **桌面端不改动** → 所有改动均 `isPresenting` 分支或 `sessionstart` 期间；`update()` 桌面相机路径原样保留 ✅
- **范围外项（后处理/手柄模型/手部追踪）** → 未实现，符合 spec §8 ✅

## 已知待人工验证点（不阻塞，但需头显确认）

1. 座舱 3D HUD 准星（`CockpitInterior._buildHudReticle`，`depthTest:false` + `renderOrder:999`）在 XR 双目渲染下可能出现重影/位置异常；若如此，后续在 XR 中隐藏 `cockpit` 的 reticle 子节点。
2. `local` 参考系下头显初始位置与座舱座位（`firstPersonOffset`）的对齐，可能需要按实际头显微调 offset 数值。
3. Terrell 行星形变在 XR 下以 rig 位置近似视向（头部偏移忽略），双目下无逐眼精确性；全屏后处理仍缺失（spec §6 已接受）。
