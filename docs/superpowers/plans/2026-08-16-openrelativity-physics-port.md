# OpenRelativity 真实实现移植 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 OpenRelativity 的两大核心算法——(1) 光谱级 Doppler 色移、(2) 精确 Lorentz 几何变换（光行差 + 收缩 + Terrell 旋转）——忠实翻译进本 Three.js 应用，替换当前的近似实现，且仅在「第一人称 + 观察模式」下生效。

**Architecture:** 分两个正交组件。组件 1 是纯 fragment-shader 色彩函数（RGB→XYZ→高斯拟合 CIE 曲线→XYZ→RGB），抽成共享 GLSL 字符串模块，供全屏后处理与星空点云两处复用。组件 2 是 CPU 逐对象精确 boost：在 `terrell.js` 里新增畸变方向函数 + 重写 `terrellTransformMatrix` 的 Jacobian，在 `App.js` 里做门控 + 中心重定位 + β 一致性修正。全部效果用「实际物理速度」`actualBeta` 而非「目标 β」驱动。

**Tech Stack:** Three.js 185（`import * as THREE`，Node 可加载）、GLSL（ShaderMaterial）、Vite（`npm run dev`）、Node v24.17.0 内置 `node --test`（无第三方测试框架）。

## Global Constraints

以下约束对所有 Task 生效，逐字复制自 spec（含本次对初稿的修正）：

1. **忠实 Lorentz boost（÷γ，已修正）**：中心 `p`（camera→object）、速度方向 `v̂`、`β=v/c`、`γ=1/√(1−β²)` 时：
   ```
   p' = p + (1/γ − 1)(p·v̂)v̂ + (β/γ)·|p|·v̂
   ```
   （等价于 OpenRelativity 把速度旋转到 −Z 后 `z'=(z−β·|p|)/γ` 再转回。**γ 是「除」不是「乘」，β 项符号是「加」不是「减」**——这是对 spec 初稿两处错误的修正。）
2. **Jacobian（viewDir = object→camera 约定）**：`J = I + (1/γ−1)v̂v̂ᵀ − amp·(β/γ)·v̂·viewDirᵀ`，其中 `amp = terrellAmplification(mode)` ∈ {0, 1.0, 1.5}。`amp` 只缩放 Terrell 剪切项（`v̂·viewDirᵀ`），保证 `lorentzOnly` 退化为纯收缩 `1/γ`。
3. **门控**：所有相对论视觉效果仅在 `viewPerspective === 'firstPerson' && viewMode === 'observed'` 时启用；否则矩阵/星空/后处理全部回到无效果态。
4. **不改 UI**：沿用现有「显示模式」「Terrell 效果」下拉，不加新控件。`terrellAmplification(mode)` 返回 0 / 1.0 / 1.5 语义不变。
5. **β 一致性**：视觉效果统一用 `actualBeta = clamp((currentSpeed/maxSpeed)·state.beta, 0, 0.999)`，不用 `state.beta`（否则停船时效果残留）。
6. **光谱色移 GLSL 逐字移植** `skybox.shader`（去掉 UV/IR 项——本应用纯 RGB 无 UV/IR 纹理）。R/G/B 峰值/宽度 615/8、550/4、463/5。`shift = max(γ(1+βcosθ), 0.01)`（分母含 `param.z*shift`，必须 > 0）。`constrainRGB` 不启用（与源一致）。
7. **保留**：`terrellRotation` / `terrellRotationAngle`（`MeasurementPreview.js` 依赖它们，测量杆预览属于「其他功能」）、头灯 beaming（`pow(df,2.5)` + log tone-map）、时间膨胀、时空图、驾驶舱、移动/速度模型、行星跳转、音频。
8. **太阳（`sunGroup`）不做 Terrell 变换**：它当前不在 `solarSystem.planets` 里、未被变换，作为光照与参考锚点保持不变（spec 虽列「太阳」，但与当前架构不符；本计划保持太阳不变，避免改动光照/参考行为）。

---

## File Structure

- `src/physics/terrell.js` — 新增 `lorentzAberratedDirection`，重写 `terrellTransformMatrix`。
- `src/visual/spectralShift.glsl.js` — **新建**共享 GLSL 字符串模块（`SPECTRAL_SHIFT_GLSL`）。
- `src/visual/RelativisticPostProcess.js` — fragment 删除屏幕空间光行差（step 3–6），step 7 换光谱色移。
- `src/visual/StarField.js` — fragment `spectralTint` 换光谱色移。
- `src/core/App.js` — 门控 + 中心重定位 + β 一致性。
- `tests/terrell.test.mjs` — **新建**数值单测。

---

## Task 1: 精确 Lorentz boost（terrell.js）+ 数值单测

**Files:**
- Modify: `src/physics/terrell.js`
- Create: `tests/terrell.test.mjs`
- （`src/physics/relativity.js` 不变，仅消费其 `clampBeta` / `lorentzFactor`）

**Interfaces:**
- Consumes: `clampBeta(beta)`, `lorentzFactor(beta)` from `../physics/relativity.js`（已存在，签名不变）。
- Produces:
  - `lorentzAberratedDirection(p, velocityDir, beta) → THREE.Vector3`（单位方向 `dir(p')`，调用方需保证 `|p| > 0`）。
  - `terrellTransformMatrix(beta, viewDir, velocityDir, mode) → THREE.Matrix4`（3×3 线性部分 = Jacobian `J`，平移为 0）。
  - 保留不变：`terrellAmplification`、`terrellRotationAngle`、`terrellRotation`、`lorentzContractionScale`。

- [ ] **Step 1: 写失败的测试**

创建 `tests/terrell.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { lorentzAberratedDirection, terrellTransformMatrix } from '../src/physics/terrell.js';

const Z = new THREE.Vector3(0, 0, 1);

test('lorentzAberratedDirection: object ahead stays ahead', () => {
  const dir = lorentzAberratedDirection(new THREE.Vector3(0, 0, 10), Z, 0.5);
  assert.ok(dir.z > 0.999);
  assert.ok(Math.abs(dir.x) < 1e-6);
});

test('lorentzAberratedDirection: object behind stays behind', () => {
  const dir = lorentzAberratedDirection(new THREE.Vector3(0, 0, -10), Z, 0.5);
  assert.ok(dir.z < -0.999);
});

test('lorentzAberratedDirection: transverse object shifts toward velocity', () => {
  const dir = lorentzAberratedDirection(new THREE.Vector3(1, 0, 0), Z, 0.5);
  assert.ok(dir.z > 0); // 向运动方向前移
  assert.ok(dir.x > 0); // 仍大致朝 +x
});

test('terrellTransformMatrix: beta=0 returns identity', () => {
  const m = terrellTransformMatrix(0, new THREE.Vector3(0, 0, -1), Z, 'precise');
  const v = new THREE.Vector3(1, 2, 3).applyMatrix4(m);
  assert.ok(v.distanceTo(new THREE.Vector3(1, 2, 3)) < 1e-6);
});

test('terrellTransformMatrix: lorentzOnly contracts along velocity by 1/gamma', () => {
  const beta = 0.6;
  const gamma = 1 / Math.sqrt(1 - beta * beta);
  const m = terrellTransformMatrix(beta, new THREE.Vector3(0, 0, -1), Z, 'lorentzOnly');
  const along = new THREE.Vector3(0, 0, 5).applyMatrix4(m);
  assert.ok(Math.abs(along.z - 5 / gamma) < 1e-6); // 5 / 1.25 = 4
  assert.ok(Math.abs(along.x) < 1e-6);
});

test('terrellTransformMatrix: precise — object ahead scales along motion by (1+beta)/gamma', () => {
  const beta = 0.6;
  const gamma = 1 / Math.sqrt(1 - beta * beta);
  const viewDir = new THREE.Vector3(0, 0, -1); // object→camera，物体在前方
  const m = terrellTransformMatrix(beta, viewDir, Z, 'precise');
  const along = new THREE.Vector3(0, 0, 5).applyMatrix4(m);
  assert.ok(Math.abs(along.z - 5 * (1 + beta) / gamma) < 1e-6); // 5 * 1.6 / 1.25 = 6.4
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/terrell.test.mjs`
Expected: FAIL（`lorentzAberratedDirection` 未导出 / `terrellTransformMatrix` 旧数学给出 `5/1.25=4` 而非 `6.4`，precise 用例不通过）。

- [ ] **Step 3: 实现最小改动**

在 `src/physics/terrell.js` 做三处修改：

**(a) 模块临时缓存加一个 `abErr`**（替换第 18–19 行）：

```js
  rotMat: new THREE.Matrix4(),
  abErr: new THREE.Vector3()
};
```

**(b) 在 `terrellTransformMatrix` 之前新增 `lorentzAberratedDirection`**：

```js
/**
 * Relativistic aberration of a static object's centre.
 * p (camera→object) → p' = p + (1/γ − 1)(p·v̂)v̂ + (β/γ)·|p|·v̂
 * Returns the unit direction of p' (the apparent direction of the object).
 * Faithful to OpenRelativity relativity.shader: z' = (z − β·|p|)/γ in the
 * velocity-aligned (−Z) frame.
 *
 * @param {THREE.Vector3} p - world vector from camera to object (NOT normalised)
 * @param {THREE.Vector3} velocityDir - normalised velocity direction (world space)
 * @param {number} beta - v/c, clamped internally
 * @returns {THREE.Vector3} unit direction from camera to the object's apparent position
 */
export function lorentzAberratedDirection(p, velocityDir, beta) {
  const b = clampBeta(beta);
  const gamma = lorentzFactor(b);
  const invG = 1 / gamma;
  const r = p.length();
  const pDotV = p.dot(velocityDir);

  return _t.abErr
    .copy(p)
    .addScaledVector(velocityDir, (invG - 1) * pDotV)
    .addScaledVector(velocityDir, (b / gamma) * r)
    .normalize();
}
```

**(c) 重写 `terrellTransformMatrix`（替换第 133–164 行整个函数体）**：

```js
/**
 * Exact Lorentz-boost Jacobian for a static object (linearisation about its centre).
 *
 * In the velocity-aligned frame OpenRelativity applies z' = (z − β·|p|)/γ
 * (relativity.shader vert()); its Jacobian about the centre is
 *   J = I + (1/γ − 1)·v̂v̂ᵀ − (β/γ)·v̂·viewDirᵀ   (viewDir = object→camera, world)
 * The v̂v̂ᵀ term is the Lorentz contraction (scale 1/γ along velocity); the
 * v̂·viewDirᵀ term is the Terrell rotation (shear). The `mode` dropdown scales
 * the Terrell term by 0 / 1 / 1.5 (lorentzOnly / precise / enhanced), preserving
 * the existing dropdown semantics while the underlying math becomes exact.
 *
 * @param {number} beta - v/c, clamped to [0, 0.999]
 * @param {THREE.Vector3} viewDir - normalised direction from object to camera (world space)
 * @param {THREE.Vector3} velocityDir - normalised velocity direction (world space)
 * @param {'lorentzOnly'|'precise'|'enhanced'} mode
 * @returns {THREE.Matrix4} 4×4 matrix whose 3×3 linear part is J
 */
export function terrellTransformMatrix(beta, viewDir, velocityDir, mode) {
  const b = clampBeta(beta);
  const gamma = b > 0.0001 ? lorentzFactor(b) : 1;
  const invG = 1 / gamma;
  const a = invG - 1;                                  // contraction coefficient
  const c = terrellAmplification(mode) * (b / gamma);  // Terrell shear coefficient

  const vx = velocityDir.x, vy = velocityDir.y, vz = velocityDir.z;
  const dx = viewDir.x,     dy = viewDir.y,     dz = viewDir.z;

  // J = I + a·(v̂v̂ᵀ) − c·(v̂·viewDirᵀ)
  const m = new THREE.Matrix4();
  m.set(
    1 + a*vx*vx - c*vx*dx,   a*vx*vy - c*vx*dy,     a*vx*vz - c*vx*dz,   0,
    a*vy*vx - c*vy*dx,       1 + a*vy*vy - c*vy*dy, a*vy*vz - c*vy*dz,   0,
    a*vz*vx - c*vz*dx,       a*vz*vy - c*vz*dy,     1 + a*vz*vz - c*vz*dz, 0,
    0,                        0,                      0,                   1
  );
  return m;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/terrell.test.mjs`
Expected: PASS，6/6。

- [ ] **Step 5: 提交**

```bash
git add src/physics/terrell.js tests/terrell.test.mjs
git commit -m "feat(terrell): exact Lorentz boost (aberration + contraction + Terrell) + unit tests"
```

---

## Task 2: 共享光谱色移 GLSL 模块 + 后处理重写

**Files:**
- Create: `src/visual/spectralShift.glsl.js`
- Modify: `src/visual/RelativisticPostProcess.js:1-1`（import）、`:237-342`（`FRAGMENT_SHADER`）

**Interfaces:**
- Consumes: 无（纯 GLSL 字符串）。
- Produces: `SPECTRAL_SHIFT_GLSL`（一个包含 `spectralShift(vec3 rgb, float shift)` 及辅助函数的 GLSL 字符串，`#define` 常量 `xla…zc`、`RGBToXYZC`/`XYZToRGBC`/`weightFromXYZCurves`/`getXFromCurve`/`getYFromCurve`/`getZFromCurve`）。后续 Task 3 依赖它。

- [ ] **Step 1: 创建共享模块**

创建 `src/visual/spectralShift.glsl.js`：

```js
// Spectral Doppler colour shift — verbatim port of OpenRelativity skybox.shader
// (UV/IR terms omitted: this app renders pure RGB, no UV/IR textures).
// Shared by RelativisticPostProcess.js (full-screen) and StarField.js (points).

export const SPECTRAL_SHIFT_GLSL = /* glsl */ `
#define xla 0.39842970153455692
#define xlb 444.50376680864167
#define xlc -20.212233772937985
#define xha 1.1305579611073924
#define xhb 593.23109259420676
#define xhc 34.446036264605638
#define ya 1.0104130954965003
#define yb 556.12431133891937
#define yc 46.102600601714499
#define za 2.0586397904795373
#define zb 448.35859770333445
#define zc -22.546254030641482

vec3 RGBToXYZC(vec3 rgb) {
  vec3 xyz;
  xyz.x = 0.135134*rgb.r + 0.120531*rgb.g + 0.0570346*rgb.b;
  xyz.y = 0.0669015*rgb.r + 0.232950*rgb.g + 0.0291481*rgb.b;
  xyz.z = 0.0*rgb.r + 0.0000247454*rgb.g + 0.358275*rgb.b;
  return xyz;
}
vec3 XYZToRGBC(vec3 xyz) {
  vec3 rgb;
  rgb.r =  9.94832*xyz.x - 5.14725*xyz.y - 1.16493*xyz.z;
  rgb.g = -2.91664*xyz.x + 5.85296*xyz.y - 0.0379474*xyz.z;
  rgb.b =  0.000197335*xyz.x - 0.000398597*xyz.y + 2.79115*xyz.z;
  return rgb;
}
vec3 weightFromXYZCurves(vec3 xyz) {
  vec3 w;
  w.x =  0.0735764*xyz.x - 0.0380683*xyz.y - 0.00861569*xyz.z;
  w.y = -0.0665233*xyz.x + 0.1343700*xyz.y - 0.000341907*xyz.z;
  w.z =  0.00000345602*xyz.x - 0.0000069808*xyz.y + 0.0485362*xyz.z;
  return w;
}

float getXFromCurve(vec3 param, float shift) {
  float top1 = param.x * xla * exp(-(pow(param.y*shift - xlb, 2.0)
    / (2.0*(pow(param.z*shift,2.0)+pow(xlc,2.0))))) * sqrt(2.0*3.14159265358979323);
  float bottom1 = sqrt((1.0/pow(param.z*shift,2.0)) + (1.0/pow(xlc,2.0)));
  float top2 = param.x * xha * exp(-(pow(param.y*shift - xhb, 2.0)
    / (2.0*(pow(param.z*shift,2.0)+pow(xhc,2.0))))) * sqrt(2.0*3.14159265358979323);
  float bottom2 = sqrt((1.0/pow(param.z*shift,2.0)) + (1.0/pow(xhc,2.0)));
  return (top1/bottom1) + (top2/bottom2);
}
float getYFromCurve(vec3 param, float shift) {
  float top = param.x * ya * exp(-(pow(param.y*shift - yb, 2.0)
    / (2.0*(pow(param.z*shift,2.0)+pow(yc,2.0))))) * sqrt(2.0*3.14159265358979323);
  float bottom = sqrt((1.0/pow(param.z*shift,2.0)) + (1.0/pow(yc,2.0)));
  return top/bottom;
}
float getZFromCurve(vec3 param, float shift) {
  float top = param.x * za * exp(-(pow(param.y*shift - zb, 2.0)
    / (2.0*(pow(param.z*shift,2.0)+pow(zc,2.0))))) * sqrt(2.0*3.14159265358979323);
  float bottom = sqrt((1.0/pow(param.z*shift,2.0)) + (1.0/pow(zc,2.0)));
  return top/bottom;
}

vec3 spectralShift(vec3 rgb, float shift) {
  vec3 xyz = RGBToXYZC(rgb);
  vec3 w = weightFromXYZCurves(xyz);
  vec3 rParam = vec3(w.x, 615.0, 8.0);
  vec3 gParam = vec3(w.y, 550.0, 4.0);
  vec3 bParam = vec3(w.z, 463.0, 5.0);
  float invShift3 = pow(1.0/shift, 3.0);
  float xf = invShift3 * (getXFromCurve(rParam,shift) + getXFromCurve(gParam,shift) + getXFromCurve(bParam,shift));
  float yf = invShift3 * (getYFromCurve(rParam,shift) + getYFromCurve(gParam,shift) + getYFromCurve(bParam,shift));
  float zf = invShift3 * (getZFromCurve(rParam,shift) + getZFromCurve(gParam,shift) + getZFromCurve(bParam,shift));
  return XYZToRGBC(vec3(xf, yf, zf));
}
`;
```

- [ ] **Step 2: 在 RelativisticPostProcess.js 顶部 import**

在 `import * as THREE from 'three';` 之后加：

```js
import { SPECTRAL_SHIFT_GLSL } from './spectralShift.glsl.js';
```

- [ ] **Step 3: 重写 `FRAGMENT_SHADER`（替换第 237–342 行）**

删除屏幕空间光行差（step 3–6）与 `tanh` 色调（step 7），替换为光谱色移；step 9 的 UV 边缘淡出不再需要（无 remap）：

```js
const FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D uSampler;
uniform float     uBeta;
uniform float     uGamma;
uniform float     uFov;       // vertical FOV in radians
uniform float     uAspect;    // width / height
uniform vec3      uVelocityDirView; // velocity direction in VIEW space (normalised)
uniform float     uTransition;

varying vec2 vUv;

${SPECTRAL_SHIFT_GLSL}

void main() {
  // ---- early exit — no effect to apply --------------------------------------
  if (uTransition < 0.0005) {
    gl_FragColor = texture2D(uSampler, vUv);
    return;
  }

  vec4 src = texture2D(uSampler, vUv);

  // ---- ray direction in view space (for Doppler angle) ----------------------
  float halfH = tan(uFov * 0.5);
  float halfW = halfH * uAspect;
  vec3 rayDir = normalize(vec3(
    (vUv.x * 2.0 - 1.0) * halfW,
    (vUv.y * 2.0 - 1.0) * halfH,
    -1.0
  ));

  // ---- Doppler factor + spectral colour shift --------------------------------
  float cosThetaObs = dot(rayDir, uVelocityDirView);
  float df = uGamma * (1.0 + uBeta * cosThetaObs);
  vec3 shifted = spectralShift(src.rgb, max(df, 0.01));

  // ---- intensity beaming (headlight effect) ----------------------------------
  float rawBeaming = pow(clamp(df, 0.001, 100.0), 2.5);
  float beaming = log(1.0 + rawBeaming * 0.15) / log(1.0 + 100.0 * 0.15);
  shifted *= beaming;

  // ---- blend with original via uTransition -----------------------------------
  vec3 outColor = mix(src.rgb, shifted, uTransition);

  gl_FragColor = vec4(outColor, src.a);
}
`;
```

> 说明：uniform 集合不变（`uBeta/uGamma/uFov/uAspect/uVelocityDirView/uTransition` 仍全部用到），`render()` 方法无需改动。

- [ ] **Step 4: 手动验证（语法/无报错）**

Run: `npm run dev`，切到第一人称 + 观察模式，提高 β，确认控制台无 shader 编译错误，前方蓝紫、后方红移为连续光谱。切回测量模式效果淡出消失。

- [ ] **Step 5: 提交**

```bash
git add src/visual/spectralShift.glsl.js src/visual/RelativisticPostProcess.js
git commit -m "feat(visual): shared spectral-shift GLSL + post-process Doppler"
```

---

## Task 3: StarField 光谱 Doppler（复用共享 GLSL）

**Files:**
- Modify: `src/visual/StarField.js:1-1`（import）、`:157-195`（`STARFIELD_FRAGMENT_SHADER`）

**Interfaces:**
- Consumes: `SPECTRAL_SHIFT_GLSL` from `./spectralShift.glsl.js`（Task 2 产物）。

- [ ] **Step 1: import 共享 GLSL**

在 `import * as THREE from 'three';` 之后加：

```js
import { SPECTRAL_SHIFT_GLSL } from './spectralShift.glsl.js';
```

- [ ] **Step 2: 重写 `STARFIELD_FRAGMENT_SHADER`（替换第 157–195 行）**

删除 `spectralTint` 与 `shiftAmount`，改用 `spectralShift`：

```js
const STARFIELD_FRAGMENT_SHADER = `
varying vec3 vBaseColor;
varying float vDoppler;
varying float vAlpha;
varying float vBrightness;

${SPECTRAL_SHIFT_GLSL}

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(uv, uv);
  if (r2 > 1.0) discard;

  float core = exp(-5.0 * r2);
  float halo = exp(-1.5 * r2) * 0.30;
  float sprite = core + halo;

  vec3 shiftedColor = spectralShift(vBaseColor, max(vDoppler, 0.01));

  float alpha = clamp(vAlpha * sprite, 0.0, 1.0);
  vec3 color = shiftedColor * mix(0.65, vBrightness, 0.80);
  color *= (0.7 + core * 0.3);

  gl_FragColor = vec4(color, alpha);
}
`;
```

> 顶点着色器不变（光行差 + 多普勒仍在顶点算，`vDoppler` 传给片元）。`vDoppler = gamma*(1+beta*cosθ)` 已能 < 1，`max(vDoppler, 0.01)` 保证分母安全。

- [ ] **Step 3: 手动验证**

Run: `npm run dev`，观察模式提高 β，确认星星随速度连续蓝/红移（不再是三段线性 tint）。切回测量模式星星颜色恢复。

- [ ] **Step 4: 提交**

```bash
git add src/visual/StarField.js
git commit -m "feat(starfield): spectral Doppler via shared GLSL"
```

---

## Task 4: App.js 门控 + 中心重定位 + β 一致性

**Files:**
- Modify: `src/core/App.js:20`（import）、`:113-116`（构造函数临时向量）、`:637-713`（`_applyTerrellToScene`）、`:882-922`（update 内视觉效果段）、`:1023`（render 调用）

**Interfaces:**
- Consumes: `terrellTransformMatrix`, `lorentzAberratedDirection`（Task 1 产物）。
- Produces: 无新导出；`_applyTerrellToScene(beta)` 签名不变（仅内部数学 + 门控 + 重定位改变）。

- [ ] **Step 1: 扩展 import（第 20 行）**

```js
import { terrellTransformMatrix, lorentzAberratedDirection } from '../physics/terrell.js';
```

- [ ] **Step 2: 加一个临时向量（构造函数第 115 行后）**

```js
    this._terrellVelocityDir = new THREE.Vector3();
    this._terrellPlanetPos = new THREE.Vector3();
    this._terrellViewDir = new THREE.Vector3();
    this._terrellToPlanet = new THREE.Vector3();
    this._terrellActive = undefined; // undefined | true | false（β 跨阈值状态）
```

- [ ] **Step 3: 重写 `_applyTerrellToScene`（替换第 637–713 行）**

```js
  _applyTerrellToScene(beta) {
    const applyBoost = this.state.viewPerspective === 'firstPerson'
      && this.state.viewMode === 'observed';

    // ── β 跨阈值翻转：非活动稳态（β≈0 或非生效视角/模式）无需每帧重置矩阵 ──
    const terrellActive = applyBoost && beta >= 0.0001;
    if (!terrellActive) {
      if (this._terrellActive !== false) {
        this._terrellActive = false;
        if (this.solarSystem && this.solarSystem.planets) {
          for (const planet of this.solarSystem.planets) {
            for (const child of planet.group.children) {
              if (child.isMesh) {
                child.matrix.identity();
                child.matrixAutoUpdate = true;
              }
            }
          }
        }
        if (this.spacecraft.terrellGroup) {
          this.spacecraft.terrellGroup.matrix.identity();
          this.spacecraft.terrellGroup.matrixAutoUpdate = true;
        }
      }
      return;
    }

    this._terrellActive = true;

    const mode = this.state.terrellMode;
    const velocityDir = this._terrellVelocityDir.copy(this._velocityForward).normalize();
    const camPos = this._smoothCamPos;

    if (this.solarSystem && this.solarSystem.planets) {
      for (const planet of this.solarSystem.planets) {
        const planetWorldPos = this._terrellPlanetPos;
        planet.group.getWorldPosition(planetWorldPos);

        const toPlanet = this._terrellToPlanet.subVectors(planetWorldPos, camPos);
        const dist = toPlanet.length();
        if (dist < 1e-6) continue;

        const viewDir = this._terrellViewDir.subVectors(camPos, planetWorldPos).normalize();

        // 1. 光行差：中心重定位（保持距离不变，方向取光行差后方向）
        const aberratedDir = lorentzAberratedDirection(toPlanet, velocityDir, beta);
        planet.group.position.copy(camPos).addScaledVector(aberratedDir, dist);

        // 2. 形状：精确 Lorentz boost 的 Jacobian（收缩 + Terrell 旋转）
        const transform = terrellTransformMatrix(beta, viewDir, velocityDir, mode);
        for (const child of planet.group.children) {
          if (child.isMesh) {
            child.updateMatrix();
            child.matrix.premultiply(transform);
            child.matrixAutoUpdate = false;
          }
        }
      }
    }

    // 第一人称下飞船即观察者本体，不施加 boost；terrellGroup 保持 identity
    if (this.spacecraft.terrellGroup) {
      this.spacecraft.terrellGroup.matrix.identity();
      this.spacecraft.terrellGroup.matrixAutoUpdate = true;
    }
  }
```

> 关键差异（相对旧实现）：
> - `velocityDir` 从 `spacecraft.group.quaternion` 改为 `_velocityForward`（与 StarField/后处理一致）。
> - 门控改为 `firstPerson && observed`（旧的是「行星所有模式 + 飞船仅第三人称」）。
> - 行星中心先做光行差重定位，再套 Jacobian（旧实现只套收缩/旋转，不重定位）。
> - 删除旧的第 694–708 行「第三人称飞船」块；`effectiveMode` 不再需要（直接 `this.state.terrellMode`）。
> - 行星 `update()` 每帧会从 `angle` 重设 `group.position`，故重定位自动被下一帧复位，无累积。

- [ ] **Step 4: update() 内视觉效果段改用 `actualBeta` + 门控（替换第 882–911 行）**

旧段（第 882–886 行用 `state.beta` 判 `usePostProcess`，第 896–900 行才算 `actualBeta`，第 909 行星空无门控）替换为：

```js
    // 实际物理速度（β 目标值 × 当前加速进度），所有视觉相对论效果都用它
    let actualBeta = 0;
    if (this.maxSpeed > 0) {
      actualBeta = (this.currentSpeed / this.maxSpeed) * this.state.beta;
    }
    actualBeta = THREE.MathUtils.clamp(actualBeta, 0.0, 0.999);

    const usePostProcess = this.state.viewMode === 'observed'
      && actualBeta > 0.001
      && this.state.viewPerspective === 'firstPerson'
      && this.postProcess;

    if (this.postProcess) {
      this.postProcess.setTransition(usePostProcess ? 1 : 0);
      this.postProcess.updateTransition(dt);
    }

    // 暗角（Vignette Overlay）跟着实际速度变化（若使用 PostProcess 屏效则关闭）
    const vignette = document.getElementById('tunnel-vignette');
    if (vignette) {
      vignette.style.opacity = usePostProcess ? '0' : Math.min(0.92, actualBeta * 1.1);
    }

    // 更新 StarField 的光行差、多普勒与头灯效应（仅第一人称 + 观察模式启用）
    const starfieldActive = this.state.viewPerspective === 'firstPerson'
      && this.state.viewMode === 'observed';
    const visualBeta = starfieldActive ? Math.max(0.0001, actualBeta) : 0.0001;
    const starfieldVelocityDir = this._velocityForward.clone().normalize();
    this.starField.setRelativisticState(visualBeta, starfieldVelocityDir);
```

> 注意：此替换删掉了原第 882 行的 `const b = this.state.beta;`（`b` 只被第 883–886 行与第 1023 行使用，两处都改为 `actualBeta`）。

- [ ] **Step 5: `_applyTerrellToScene` 与 render 改用 `actualBeta`**

第 922 行：

```js
    this._applyTerrellToScene(actualBeta);
```

第 1023 行：

```js
      this.postProcess.render(actualBeta, this.camera, this.scene, this.renderer, this._velocityForward);
```

- [ ] **Step 6: 手动验证**

Run: `npm run dev`，依次验证：
1. 第一人称 + 观察模式，加速：前方蓝紫连续谱、行星光行差 + 收缩 + Terrell 旋转自然连续、停船后效果随 `currentSpeed` 逐渐消失（β 一致性）。
2. 切到测量模式或第三人称：主场景所有相对论效果完全消失、无残留矩阵变换；测量杆预览窗口仍正常显示收缩教学。
3. 观察模式 + 第三人称：无效果（门控）。

- [ ] **Step 7: 提交**

```bash
git add src/core/App.js
git commit -m "feat(app): gate relativistic effects to first-person observed + beta consistency"
```

---

## 完成后的收尾

- 运行一次 `node --test` 确认单测仍绿。
- 全量手动回归一次 `npm run dev`（测量模式、第三人称、时空图、驾驶舱、音频均正常）。
- 暂缓（不属于本任务）：删除 App.js 里的 TEMP `[PERF]` 探测（第 718–729、827、874、914、932、954、1002、1011、1014、1017、1019、1027、1029–1043 行），等 reflow 修复验证后另行清理。
