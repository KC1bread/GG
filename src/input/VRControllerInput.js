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
