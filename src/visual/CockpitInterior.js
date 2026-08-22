import * as THREE from 'three';

/**
 * CockpitInterior — 第一人称航向全息指示（不再用实体方框座舱窗）。
 *
 * 挂在 ship-heading rig 上：元素沿船头 -Z 排列，转头时仍指向运动方向。
 * 中央留空，不遮挡星空。
 */

const HUD_CYAN = 0x7dd3fc;
const HUD_AMBER = 0xffc45c;

export class CockpitInterior {
  constructor() {
    this.group = new THREE.Group();
    this._mats = [];
    this._rings = [];
    this._pulse = 0;
    this._buildHeadingHud();
  }

  _lineMat(color, opacity) {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    this._mats.push(mat);
    return mat;
  }

  _buildHeadingHud() {
    const hud = new THREE.Group();
    hud.renderOrder = 20;

    const ringDefs = [
      { z: -0.62, r: 0.20, tube: 0.0022, opacity: 0.28, color: HUD_CYAN },
      { z: -1.05, r: 0.145, tube: 0.0018, opacity: 0.22, color: HUD_CYAN },
      { z: -1.55, r: 0.095, tube: 0.0016, opacity: 0.18, color: HUD_CYAN },
      { z: -2.15, r: 0.055, tube: 0.0014, opacity: 0.16, color: HUD_AMBER }
    ];

    for (const def of ringDefs) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(def.r, def.tube, 8, 64),
        this._lineMat(def.color, def.opacity)
      );
      ring.position.set(0, 0, def.z);
      ring.userData.baseOpacity = def.opacity;
      this._rings.push(ring);
      hud.add(ring);
    }

    // 最近一环上的方位刻度（不封口）
    const tickMat = this._lineMat(HUD_CYAN, 0.32);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const tick = new THREE.Mesh(
        new THREE.BoxGeometry(i % 2 === 0 ? 0.018 : 0.010, 0.0014, 0.0014),
        tickMat
      );
      tick.position.set(Math.cos(a) * 0.215, Math.sin(a) * 0.215, -0.62);
      tick.rotation.z = a;
      hud.add(tick);
    }

    // 航向箭头：指向船头（运动方向）
    const chevronMat = this._lineMat(HUD_AMBER, 0.55);
    const chevron = this._makeChevron(0.034, chevronMat);
    chevron.position.set(0, -0.245, -0.62);
    chevron.userData.baseOpacity = 0.55;
    this._chevron = chevron;
    hud.add(chevron);

    const tip = this._makeChevron(0.016, this._lineMat(HUD_AMBER, 0.42));
    tip.position.set(0, 0, -2.28);
    tip.userData.baseOpacity = 0.42;
    this._tip = tip;
    hud.add(tip);

    // 沿航向收束的虚线，提示「往这边飞」
    const beadMat = this._lineMat(HUD_CYAN, 0.2);
    for (let i = 0; i < 7; i++) {
      const t = (i + 1) / 8;
      const z = THREE.MathUtils.lerp(-0.72, -2.05, t);
      const bead = new THREE.Mesh(
        new THREE.SphereGeometry(0.0032 * (1 - t * 0.45), 8, 8),
        beadMat
      );
      bead.position.set(0, 0, z);
      hud.add(bead);
    }

    // 左右微翼：只在下方留一点，不挡天球
    const wingMat = this._lineMat(HUD_CYAN, 0.14);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(
        new THREE.RingGeometry(0.19, 0.198, 20, 1, side > 0 ? -0.55 : Math.PI - 0.55, 1.1),
        wingMat
      );
      wing.position.set(0, -0.02, -0.62);
      hud.add(wing);
    }

    this.group.add(hud);
  }

  _makeChevron(size, material) {
    const shape = new THREE.Shape();
    shape.moveTo(0, size);
    shape.lineTo(size * 0.72, -size * 0.55);
    shape.lineTo(0, -size * 0.22);
    shape.lineTo(-size * 0.72, -size * 0.55);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    const mesh = new THREE.Mesh(geo, material);
    return mesh;
  }

  attachTo(parent) {
    parent.add(this.group);
  }

  detachFrom(parent, scene) {
    parent.remove(this.group);
    if (scene) scene.add(this.group);
  }

  show() {
    this.group.visible = true;
  }

  hide() {
    this.group.visible = false;
  }

  /**
   * @param {number} dt
   * @param {number} beta — 当前 v/c
   */
  update(dt, beta) {
    this._pulse += dt;
    const b = THREE.MathUtils.clamp(Number(beta) || 0, 0, 0.999);
    const breath = 0.82 + 0.18 * Math.sin(this._pulse * (1.4 + b * 4.0));
    const speedBoost = 0.75 + b * 0.7;

    for (const ring of this._rings) {
      if (!ring.material) continue;
      ring.material.opacity = ring.userData.baseOpacity * breath * speedBoost;
    }
    if (this._chevron?.material) {
      this._chevron.material.opacity = this._chevron.userData.baseOpacity * (0.7 + b * 0.55);
    }
    if (this._tip?.material) {
      this._tip.material.opacity = this._tip.userData.baseOpacity * (0.55 + b * 0.7);
    }
  }
}
