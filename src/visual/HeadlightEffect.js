import * as THREE from 'three';

/**
 * HeadlightEffect — 相对论探照灯效应（相对论束流增亮 / 头灯效应）
 *
 * 仅在第一人称视角启用：朝运动前方（速度方向）的物体，因多普勒束流被增亮
 * （等效「奔向光子流 → 更多光子击中你 → 物体更亮」）；反方向的物体变暗。
 *
 * 例：向左（速度方向指向左）飞行时，左侧物体比右侧更亮。
 *
 * 只作用于场景里的远处实体（行星 / 太阳 / 月亮 / 目标星），
 * 不作用于随船坐标系的座舱，也不作用于已内置相对论效果的星空（StarField）。
 *
 * 实现：每帧按 β 与「视线 → 物体」夹角 θ 计算多普勒因子 df = γ(1+β·cosθ)，
 * 以 df^α 作为亮度倍率 —— 前方增亮（加自发光贴图）、后方变暗（乘色）。
 */
export class HeadlightEffect {
  constructor() {
    this.targets = [];
    this._velocityDir = new THREE.Vector3(0, 0, -1);
    this._toObject = new THREE.Vector3();
    this._objWorldPos = new THREE.Vector3();

    // —— 调参 ——
    this.alpha = 1.4;      // 束流增亮指数（越大前方越亮、后方越暗）
    this.maxBoost = 2.4;   // 前方最大亮度倍率（避免刺眼）
    this.minAtten = 0.3;   // 后方最小亮度倍率（避免全黑）
    this.gateBeta = 0.05;  // β 低于此值效应归零（静止时无探照灯）
  }

  /**
   * 注册一个物体组：遍历其中所有带 color 材质的 mesh，
   * 用 posRef 的世界坐标计算方向（避免被 Terrell 矩阵二次偏移）。
   * @param {THREE.Object3D} object3d — 待遍历的物体（含子 mesh）
   * @param {THREE.Object3D} [posRef] — 方向计算的锚点（默认用 object3d 自身）
   */
  registerGroup(object3d, posRef) {
    const ref = posRef || object3d;
    object3d.traverse((child) => {
      if (!child.isMesh) return;
      const mat = child.material;
      if (!mat || !mat.color) return;

      const isStandard = !!mat.emissive; // MeshStandard / MeshPhysical 才有 emissive
      this.targets.push({
        mesh: child,
        posRef: ref,
        isStandard,
        baseColor: mat.color.clone(),
        baseEmissive: isStandard ? mat.emissive.clone() : null,
        baseEmissiveIntensity: isStandard ? mat.emissiveIntensity : 1,
        baseEmissiveMap: isStandard ? mat.emissiveMap : null,
        emissiveOn: false
      });
    });
  }

  /**
   * 每帧调用。
   * @param {number} beta — 实际 v/c（0–0.999）
   * @param {THREE.Vector3} velocityDir — 世界空间速度方向（单位向量）
   * @param {THREE.Vector3} cameraPosition — 相机世界坐标
   * @param {boolean} active — 是否启用（仅第一人称）
   */
  update(beta, velocityDir, cameraPosition, active) {
    if (!active) {
      this._reset();
      return;
    }

    const b = THREE.MathUtils.clamp(beta, 0, 0.999);
    this._velocityDir.copy(velocityDir);
    if (this._velocityDir.lengthSq() < 1e-6) this._velocityDir.set(0, 0, -1);
    this._velocityDir.normalize();

    const gamma = 1 / Math.sqrt(1 - b * b);
    const gate = THREE.MathUtils.smoothstep(b, this.gateBeta, this.gateBeta * 2);

    for (const t of this.targets) {
      t.posRef.getWorldPosition(this._objWorldPos);
      this._toObject.subVectors(this._objWorldPos, cameraPosition);
      const dist = this._toObject.length();
      if (dist < 1e-4) continue;
      this._toObject.divideScalar(dist);

      const cosTheta = THREE.MathUtils.clamp(
        this._toObject.dot(this._velocityDir), -1, 1
      );

      const df = gamma * (1 + b * cosTheta);
      let beaming = Math.pow(Math.max(df, 0.001), this.alpha);
      beaming = THREE.MathUtils.clamp(beaming, this.minAtten, this.maxBoost);
      // β=0 时 gate=0 → brightness=1（无效果），高速时逼近 beaming
      const brightness = THREE.MathUtils.lerp(1, beaming, gate);

      this._applyBrightness(t, brightness);
    }
  }

  _applyBrightness(t, brightness) {
    const mat = t.mesh.material;

    if (!t.isStandard) {
      // 基础材质（太阳核 / 目标星 / 大气 / 环）：直接乘色（增亮受 color 上限约束，主要表现变暗）
      mat.color.copy(t.baseColor).multiplyScalar(Math.max(brightness, 0));
      return;
    }

    const boost = Math.max(0, brightness - 1.0);
    if (boost > 0.001) {
      // 增亮：用自发光贴图（= 当前 albedo）让整颗星「发光」，保留纹理细节
      if (!t.emissiveOn) {
        t.emissiveOn = true;
        mat.needsUpdate = true; // 打开 USE_EMISSIVEMAP 需重编着色器
      }
      mat.color.copy(t.baseColor);
      mat.emissiveMap = mat.map || null; // 跟随 PIT 纹理异步替换，保持最新
      mat.emissive.setRGB(1, 1, 1);
      mat.emissiveIntensity = boost * 0.9;
    } else {
      if (t.emissiveOn) {
        t.emissiveOn = false;
        mat.needsUpdate = true;
      }
      mat.color.copy(t.baseColor).multiplyScalar(Math.max(brightness, 0));
      mat.emissiveMap = t.baseEmissiveMap;
      mat.emissive.copy(t.baseEmissive);
      mat.emissiveIntensity = t.baseEmissiveIntensity;
    }
  }

  _reset() {
    for (const t of this.targets) {
      const mat = t.mesh.material;
      mat.color.copy(t.baseColor);
      if (t.isStandard) {
        if (t.emissiveOn) {
          t.emissiveOn = false;
          mat.needsUpdate = true;
        }
        mat.emissiveMap = t.baseEmissiveMap;
        mat.emissive.copy(t.baseEmissive);
        mat.emissiveIntensity = t.baseEmissiveIntensity;
      }
    }
  }
}
