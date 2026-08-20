import * as THREE from 'three';

/**
 * VRControllerInput — generic WebXR controller driver.
 *
 * Maps standard WebXR gamepad input (buttons/axes/handedness) into this.keys
 * (a per-frame gamepad state); App.js merges it with keyboard input via OR
 * before running its unchanged flight model. Works with Quest Touch / Index /
 * Vive / PCVR.
 *
 * 双手方案：
 *   右手柄  扳机=加速 β+，抓握键=减速 β−
 *   左手柄  扳机=向前移动（跟随头显朝向），X 键=跳转到下一颗行星
 *   摇杆不再映射
 */

/**
 * Pure mapping: one XRInputSource.gamepad → semantic actions.
 * Continuous only (no edge/state); discrete button edges handled in the class.
 *
 * @param {Gamepad} gamepad - XRInputSource.gamepad
 * @param {string} handedness - 'left' | 'right' | 'none'
 * @returns {{forward:boolean,backward:boolean,left:boolean,right:boolean,up:boolean,down:boolean,shift:boolean,ctrl:boolean}}
 */
export function mapGamepadToActions(gamepad, handedness) {
  const buttons = gamepad.buttons || [];

  const actions = {
    forward: false, backward: false,
    left: false, right: false,
    up: false, down: false,
    shift: false, ctrl: false,
  };

  if (handedness === 'right') {
    // 右手柄：扳机=加速 β+（shift），抓握键=减速 β−（ctrl）。摇杆不再使用
    actions.shift = !!(buttons[0] && buttons[0].pressed);
    actions.ctrl  = !!(buttons[1] && buttons[1].pressed);
  } else if (handedness === 'left') {
    // 左手柄：扳机=向前移动（forward）
    actions.forward = !!(buttons[0] && buttons[0].pressed);
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
    // 手柄瞬时输入状态（每帧重建），由 App.js 与键盘状态合并为最终输入
    this.keys = {
      forward: false, backward: false,
      left: false, right: false,
      up: false, down: false,
      shift: false, ctrl: false,
    };
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

    // 手柄状态每帧重建，写入自身 this.keys（由 App.js 与键盘状态合并，不再覆盖 app.keys）
    const g = this.keys = {
      forward: false, backward: false,
      left: false, right: false,
      up: false, down: false,
      shift: false, ctrl: false,
    };

    for (const source of session.inputSources) {
      const gp = source.gamepad;
      if (!gp) continue;

      const a = mapGamepadToActions(gp, source.handedness);
      g.forward  = g.forward  || a.forward;
      g.backward = g.backward || a.backward;
      g.left     = g.left     || a.left;
      g.right    = g.right    || a.right;
      g.up       = g.up       || a.up;
      g.down     = g.down     || a.down;
      g.shift    = g.shift    || a.shift;
      g.ctrl     = g.ctrl     || a.ctrl;

      this._handleButtonEdges(source.handedness, gp.buttons);
    }
  }

  _handleButtonEdges(handedness, buttons) {
    // 左手柄 X 键跳转到下一颗行星
    if (handedness !== 'left') return;

    const now = buttons.map((b) => !!b.pressed);
    const prev = this._prevButtons.get(handedness) || [];

    // button[4] = Quest X（左）/ A（右），也是多数手柄的主按键
    const nowMain = !!now[4];
    const prevMain = !!prev[4];
    if (nowMain && !prevMain) {
      this.app._vrJumpToPlanet(+1);
    }

    this._prevButtons.set(handedness, now);
  }

  dispose() {
    this.scene.remove(this.controllerL, this.controllerR, this.gripL, this.gripR);
  }
}
