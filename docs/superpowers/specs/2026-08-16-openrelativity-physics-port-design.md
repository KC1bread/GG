# 移植 OpenRelativity 真实实现 — 设计文档

> 日期：2026-08-16
> 目标：把 A Slower Speed of Light 背后的物理引擎 OpenRelativity 的两大核心算法，忠实**翻译**（Unity/C# → Three.js/GLSL，非复制粘贴）进本应用，替换当前的近似实现。

## 背景

A Slower Speed of Light（ASSoL）没有独立的游戏源码仓库；它的「真实实现」就是 MIT Game Lab 的开源引擎 **OpenRelativity**（Unity）。本设计把 OpenRelativity 的两个皇冠算法移植过来：

1. **光谱级 Doppler 色移** —— 替换当前的 `tanh` 色调近似。
2. **精确 Lorentz 几何变换** —— 用「光行差 + 长度收缩 + Terrell 旋转」三合一的精确 boost，替换当前「屏幕空间光行差 + CPU 收缩/角度近似」两套拼装。

## 范围与约束（用户确认）

- **仅在第一人称 + 观察模式（`viewMode === 'observed'`）下生效**。测量模式、第三人称均不启用这些效果。
- **不改动 UI**：沿用现有「显示模式」「Terrell 效果」下拉，不加任何新控件。
- **不改动其他功能**：不动时间膨胀、时空图、测量杆预览、驾驶舱、移动/速度模型、行星跳转、音频等。
- 因此 **相对论速度合成（velocity addition）从范围中移除** —— 它会改动移动/速度模型，属于「其他功能」。

## 待替换的现状

| 位置 | 当前近似 | 替换为 |
|---|---|---|
| `src/visual/RelativisticPostProcess.js` fragment step 3–6 | 屏幕空间光行差（逆相对论 ray remap） | 删除（被对象级 boost 取代） |
| 同上 step 7 | `tanh(log(df)*0.55)` 色调 Doppler | 光谱级色移（组件 1） |
| `src/physics/terrell.js` `terrellTransformMatrix` | 1/γ 收缩 + 旋转角 `amp·asin(β·sinα)` 近似 | 精确 Lorentz boost（组件 2） |
| `src/visual/StarField.js` `spectralTint` | 三段线性色调近似 | 光谱级色移（组件 1） |
| `src/core/App.js` `_applyTerrellToScene` | 行星所有模式应用、飞船仅第三人称 | 加门控 + 精确 boost + 光行差重定位（组件 2） |

---

## 组件 1 — 光谱级 Doppler 色移

### 算法（转录自 OpenRelativity `skybox.shader`）

输入：像素/星点基础色 RGB（0–1）与 Doppler 因子 `shift = γ(1 + βcosθ)`（`cosθ` = 视线方向与速度方向的点积；`shift > 1` 为前方蓝移）。

步骤：

1. **RGB → XYZ**（线性矩阵 `RGBToXYZC`）：
   ```
   x = 0.135134*r + 0.120531*g + 0.0570346*b
   y = 0.0669015*r + 0.232950*g + 0.0291481*b
   z = 0.000000*r + 0.0000247454*g + 0.358275*b
   ```
2. **XYZ → 三通道权重**（线性矩阵 `weightFromXYZCurves`）：
   ```
   wx =  0.0735764*x - 0.0380683*y - 0.00861569*z
   wy = -0.0665233*x + 0.1343700*y - 0.000341907*z
   wz =  0.00000345602*x - 0.0000069808*y + 0.0485362*z
   ```
3. **逐通道高斯拟合 CIE 色匹配曲线**，在「移动后的波长」`λ·shift` 处求值。R/G/B 通道峰值/宽度：**615/8、550/4、463/5**（nm）。
4. **合成**：`xf = (1/shift)³ · Σ getX(...)`，`yf`、`zf` 同理（只含 R/G/B 三项，UV/IR 项见下）。
5. **XYZ → RGB**（`XYZToRGBC`）：
   ```
   r =  9.94832*x - 5.14725*y - 1.16493*z
   g = -2.91664*x + 5.85296*y - 0.0379474*z
   b =  0.000197335*x - 0.000398597*y + 2.79115*z
   ```
6. `constrainRGB` 在 skybox 中被注释掉 → **不启用**（与源一致）。

### 高斯曲线常量（逐字，来自 `skybox.shader`）

```
xla = 0.39842970153455692   xlb = 444.50376680864167   xlc = -20.212233772937985
xha = 1.1305579611073924    xhb = 593.23109259420676   xhc =  34.446036264605638
ya  = 1.0104130954965003    yb  = 556.12431133891937   yc  =  46.102600601714499
za  = 2.0586397904795373    zb  = 448.35859770333445   zc  = -22.546254030641482
```

### 完整 GLSL 参考（逐字，转录自 `skybox.shader`，自包含）

```glsl
// —— 常量 ——
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

// —— 颜色空间转换 ——
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

// —— 高斯拟合曲线（getX 为双高斯，getY/getZ 为单高斯）——
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

// —— 光谱色移主函数（`shift` = γ(1+βcosθ)，输入 rgb ∈ [0,1]）——
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
```

> 注意：`getXFromCurve` 的 `param.z*shift` 出现在分母，`shift` 必须 > 0；调用侧保证 `shift = max(γ(1+βcosθ), 0.01)`。

### 适配（关键差异）

- **去掉 UV/IR 项**：OpenRelativity 用独立的 UV/IR 纹理把紫外/红外光折入可见光（`getXFromCurve(UVParam/IRParam, ...)`）。本应用是纯 RGB 渲染，无此类纹理，故 UV/IR 项恒为 0，只保留 R/G/B 三项高斯。
- 输入色即场景已渲染纹理色（0–1）；`XYZToRGBC` 输出可能越界（>1 或负），按源实现不 constrain（交由后续 beaming/显示处理）。

### 落地位置

- `RelativisticPostProcess.js` fragment：删除 step 7 的 `tanh` 色调，替换为上述光谱色移（用已算出的 `df` 作 `shift`）。
- `StarField.js` fragment：删除 `spectralTint`，替换为同一光谱色移（用 `vDoppler` 作 `shift`）。
- 两处共享同一段 GLSL 函数（抽成一个共享 GLSL 常量/字符串模块，避免重复）。

---

## 组件 2 — 精确 Lorentz 几何变换

### 权威公式（转录自 `relativity.shader` `vert()` + `RelativisticObject.cs`，静态物体 `viw=0`）

对每个静态世界帧物体，中心位置 `p`（相对相机）、速度方向 `v̂`、`β = v/c`、`γ = 1/√(1−β²)`：

```
p' = p + (1/γ − 1)(p·v̂)v̂ + (β/γ)·|p|·v̂
```

（OpenRelativity 实际是把速度旋转到 −Z 后 `z' = (z − β·|p|)/γ` 再转回；换算到世界系、速度方向 = v̂ 时等价于上式。**这是对初稿两处错误的修正：γ 方向是「除」不是「乘」；β 项符号是「加」不是「减」。**）

这一个公式同时精确产生：
- **光行差**：视方向从 `d̂ = p/|p|` 变为 `dir(p')`（前方/后方物体方向不变，横向物体向运动方向前移）。
- **长度收缩 + Terrell 旋转**：形状的线性化变换（中心处 Jacobian）`J = I + (1/γ−1)v̂v̂ᵀ + (β/γ)·v̂·d̂ᵀ`（`d̂ = p/|p|`，camera→object），对小角径物体精确。

### 逐对象实现（CPU，按对象中心算）

在 `App.js` 的 `_applyTerrellToScene` 中，对每个静态世界物体（行星/太阳/卫星）：

1. 取中心 `p`（`getWorldPosition` 相对 `_smoothCamPos`）。
2. **光行差**：把物体中心重定位到畸变后视方向 —— 保持距离 `|p|` 不变，方向改为 `dir(p')`，即物体移到 `cam + |p|·dir(p')`。
3. **形状**：直接应用线性化 Jacobian 矩阵 `J = I + (1/γ−1)v̂v̂ᵀ + (β/γ)·v̂·d̂ᵀ`（3×3，作为 Matrix4 的线性部分），替代当前 `amp·asin(β·sinα)` 近似。该 J 同时编码了收缩与 Terrell 旋转，无需再分解。

> 精度说明：`p' = …` 对单个点是精确的；物体形状用中心处的线性化（小角径近似），对远处行星几乎无差，仅极近的大物体有轻微误差。这是「CPU 逐对象」方案对「逐顶点 shader 注入」方案所做的权衡（用户已选定逐对象）。

### 变更文件

- `src/physics/terrell.js`：
  - 新增 `lorentzAberratedDirection(p, velocityDir, beta)` → 返回畸变后中心方向（单位向量 `dir(p')`）。
  - `terrellTransformMatrix` 内部数学替换为精确 boost 的 Jacobian（需要 `distance`/对象位置信息，签名相应扩展）。
- `src/core/App.js` `_applyTerrellToScene`：
  - 加门控（见下）。
  - 行星改用精确 boost + 光行差重定位（第一人称 + 观察模式门控；飞船即观察者本体，不单独变换）。
- `src/visual/RelativisticPostProcess.js` fragment：删除屏幕空间光行差（step 3–6），后处理只保留光谱 Doppler + 头灯 beaming。

---

## 门控（最终）

**生效条件：`viewPerspective === 'firstPerson' && viewMode === 'observed'`。**

- `_applyTerrellToScene`：仅在上述条件时应用精确 boost；否则把行星/飞船矩阵重置为 identity（现已有非活动稳态重置逻辑，复用）。
- `StarField`：仅在上述条件时 `setRelativisticState(visualBeta, ...)`；否则 `setRelativisticState(0.0001, ...)`（无偏移）。
- Post-process：已按此门控（`usePostProcess`），不变。

**行为变化说明**：此前「测量模式」与「第三人称」下主场景会显示 Lorentz 收缩；按新约束，这些模式现在**不再显示任何相对论效果**（测量杆预览窗口保持原样，仍显示收缩教学，属于「其他功能」）。

---

## 移除 / 保留

**移除**
- 后处理屏幕空间光行差（step 3–6）。
- `tanh` / `spectralTint` 色调 Doppler。
- `terrell.js` 的 `amp·asin(β·sinα)` 角度近似。

**保留**
- 头灯 beaming（`pow(df, 2.5)`，物理有据，与端口正交）。
- `terrellTransformMatrix` 对外调用点与 `_applyTerrellToScene` 架构（只换内部数学）。
- 测量杆预览机制、StarField 的生成/闪烁/可见性逻辑（只换颜色函数）。
- 驾驶舱、时间膨胀、时空图、行星跳转等（全部不动）。

---

## 测试

- **手动（`npm run dev`）**：第一人称 + 观察模式提高 β，验证：
  1. 前方蓝紫、后方红到红外（连续光谱，而非单色 tint）；
  2. 行星光行差 + 收缩 + Terrell 旋转连续自然；
  3. 切到测量模式或第三人称时效果完全消失、无残留矩阵变换。
- **数值单测（`terrell.js`）**：断言已知情形——
  1. 物体在前方时，沿运动方向的位移被 Jacobian 缩放到 `(1+β)/γ · L`；
  2. 光行差：前方/后方物体方向不变，横向物体向运动方向前移（`dir(p')·v̂ > 0`）；
  3. 光谱色移对 β=0 返回恒等（输出 ≈ 输入 RGB）。
