# VR 沉浸式体验设计文档

> 日期：2026-08-18
> 状态：设计已确认，待拆解实施计划
> 范围：VR（WebXR）沉浸体验的 3 项欠缺，**不改动桌面端现有 UI 与功能**

---

## 1. 背景与目标

当前软件（Relativistic Voyager Alpha）在 VR 体验上有 3 项欠缺：

1. **缺少 360° 沉浸探索** —— 戴上 VR 眼镜只能"观察"一张贴在眼前的画面，无法环视、无空间感。
2. **手柄无法操作** —— 已配对的手柄对软件没有任何输入作用。
3. **设备连接显示无效** —— 界面上的 VR 设备状态是写死的占位文案，不反映真实连接状态。

**目标**：让用户戴上 VR 眼镜后能 360° 无死角探索近光速飞行场景，用手柄（Quest / Index / Vive / PCVR 等任意标准 WebXR 手柄）驾驶飞船，且界面实时、真实地显示 VR 设备连接状态。

**范围约束（沿用既有约束精神）**：桌面端（非 VR）的 UI、键盘/鼠标交互、飞行模型、相对论渲染行为全部保持原样；所有 VR 改动仅在 `renderer.xr.isPresenting` 生效时激活。

---

## 2. 现状诊断（决定方案方向的事实）

项目是**纯 Three.js v0.185.1 + WebXR**（并非目录名暗示的 A-Frame）。WebXR 已部分接线，但缺三块关键拼图。

| 事实 | 位置 | 后果 |
|---|---|---|
| 已开启 WebXR，`VRButton` 已注入 | `src/core/App.js`（`setupThree` 内 `renderer.xr.enabled = true` + `VRButton.createButton`） | VR 会话能建立，但进去是"死画面" |
| 相机是单个 `PerspectiveCamera`，**无 rig 父节点**，每帧被手动 `position.copy()` + `lookAt()` 覆盖 | `src/core/App.js`（`update` 循环内） | 头部姿态与飞船运动脱钩 → 无法 360° 探索 |
| 输入只有键盘 + 鼠标，**零手柄代码** | `src/core/App.js`（`setupKeyboard` / `setupMouse`） | 手柄完全无响应 |
| "VR 设备状态"面板是**写死的静态文案**，从不更新 | `src/ui/PanelManager.js`（`vr-status` 面板创建逻辑） | 连接显示是摆设 |
| 全屏相对论后处理在 XR 下被**主动跳过** | `src/visual/RelativisticPostProcess.js`（`render` 内 `isPresenting` 守卫） | VR 下看不到像差/多普勒/头灯全屏效果 |
| 无 `vite.config.js`，`@vitejs/plugin-basic-ssl` 已装但未启用 | `package.json` | LAN/头显走 `http`，非安全上下文，WebXR 起不来 |

**关键机制（three.js WebXR 相机 rig）**：`WebXRManager.updateCamera(camera)` 读取 `camera.parent`，把头盔位姿（`view.transform.matrix`）与 `parent.matrixWorld` 组合后回写到相机。当 `camera.parent === null` 时，头盔位姿被当作**绝对变换**应用，与飞船的 `shipPosition`/`shipHeading` 无关——这正是"转头无响应、世界不随飞船动"的根因。正确做法是让应用相机成为"承载飞船位置+朝向的 rig Group"的**子节点**。

---

## 3. 问题一：360° 无死角沉浸探索

### 理解
相机没有挂在任何"载体"上（`camera.parent = null`），`update()` 每帧又无条件 `position.copy()` + `lookAt()` 覆盖。二者叠加：头盔位姿被当作绝对变换、且被手动覆盖，导致**飞船在飞、世界不动、转头没有正确映射**——用户看到的就是"一张贴在眼前的画面"。

### 解决方向
引入标准 WebXR **相机 rig（载体 + 头部两级结构）**，解耦"飞船位置/朝向"与"头部朝向"：rig 承载飞船，头盔位姿承载头部，二者相乘才是最终视角。

### 方案
1. 新增 `this.cameraRig = new THREE.Group()`，把 `this.camera` 作为 rig 子节点加入场景。
2. 每帧只在 **rig** 上写飞船位姿（`shipPosition` + `shipHeading` 四元数）；相机局部变换交给 XR。
3. `update()` 分支：`xr.isPresenting` 时**不再**手动 `position.copy()`/`lookAt()`（桌面模式保留现有逻辑）。
4. 不在 XR 里手动改 `camera.fov`（three.js 会用头盔投影矩阵覆盖，`updateUserCamera` 内部已处理）。
5. 第一人称驾驶舱已是 `attachTo(camera)` 子节点，天然跟随头部，只需确认在 rig 层级下正确。
6. **隐藏 2D UI**：进入 XR 时给 `<body>` 加类（如 `.xr-presenting`），CSS 隐藏面板/`#crosshair`/`#tunnel-vignette` 等 DOM 覆盖层。
7. 星空的光行差/多普勒/头灯在 `StarField` 材质 shader 里计算，与渲染路径无关，VR 下照常生效；全屏后处理 v1 接受缺失（见 §6）。

---

## 4. 问题二：通用手柄操作系统

### 理解
全项目输入只有键盘（写入 `this.keys`）和鼠标（`freeLookYaw/freeLookPitch`），没有任何 `getController` / Gamepad 代码，手柄无论怎么按都无反应。

### 解决方向
不直接读各家手柄，而是建立在 **WebXR 标准输入**之上（`inputSource.gamepad` 的 `buttons[]`/`axes[]` + `handedness`，three.js 的 `renderer.xr.getController(i)`/`getControllerGrip(i)` + `select/squeeze` 事件）。Quest Touch、Valve Index、Vive、PCVR 全部走同一套 WebXR 标准，天然"通用"。核心是**语义动作层**：把手柄原始信号映射成语义动作，写进与键盘相同的 `this.keys`，飞行模型零改动。

### 方案
1. 新建 `src/input/VRControllerInput.js`：初始化 `controllerL/R = renderer.xr.getController(0/1)` 并加入场景；监听 `selectstart/end`、`squeezestart/end`。
2. 每帧读 `gamepad`，做**动作映射**（建议默认值，可配置）：
   - 扳机（trigger/select）→ 前进（`keys.forward`）
   - 握持（grip/squeeze）→ 刹车/后退（`keys.backward`）
   - 左摇杆 X → 转向（`keys.left/right`）；左摇杆 Y → 升降（`keys.up/down`）
   - 右摇杆 Y 或按钮 → 加/减 β（`keys.shift/ctrl`）
   - A/X 键 → 行星跳跃（复用 `_handlePlanetJump(1..8)`）
3. 动作层与键盘**共享同一个 `this.keys`**（或提炼 `InputState`），`update()` 飞行逻辑一行不改。
4. **手柄射线交互**：从 `getController(0)` 的 target-ray 空间拉射线，命中行星时复用现有 `_showPlanetInfo`；加一小段 `Line`/光点可视化射线。
5. （可选延后）手柄 3D 模型（`XRControllerModelFactory` + GLTF），先用"射线+小方块"占位。
6. 桌面模式完全不受影响——手柄代码仅在 `xr.isPresenting` 时启用。

---

## 5. 问题三：VR 设备连接功能

### 理解
`src/ui/PanelManager.js` 的 `vr-status` 面板文案是写死的（"当前浏览器不支持 VR…将后续版本迭代开发"），`#vr-status-detail` 从不更新；`VRButton` 只是被搬进面板，没有任何检测/事件。所以"连接显示"是纯摆设。

### 解决方向
做**真实的能力检测 + 会话/输入源事件监听**，把设备状态实时渲染到面板，并让"进入 VR"按钮真正可用。

### 方案
1. **能力检测**：`navigator.xr` 存在 + `navigator.xr.isSessionSupported('immersive-vr')`，得到三态：`不支持 / 支持未连接 / 已连接(呈现中)`。
2. **事件监听**：`renderer.xr.addEventListener('sessionstart'/'sessionend')` + `inputsourceschange`，实时更新：设备名（`inputSource.profiles`）、左右手控制器数量。
3. **UI 联动**：更新 `#vr-status-detail` 文案 + 状态灯；"不支持"时禁用 VRButton 并给提示。
4. **HTTPS 前置（关键阻塞项）**：WebXR 要求安全上下文。新增 `vite.config.js`，启用已装好的 `@vitejs/plugin-basic-ssl`（或 `server.https`），头显/LAN 访问 `https://<ip>:5173`（首次需手动接受自签证书）。
5. **双端兼容**：Quest 独立浏览器与 PCVR（SteamVR + Chrome/Edge）走同一套 WebXR 代码；Quest 浏览器侧建议加 `optionalFeatures: ['local-floor','bounded-floor','hand-tracking']`。

---

## 6. 风险与约束

- **全屏相对论后处理在 VR 下缺失**：`RelativisticPostProcess` 是单 quad 全屏 pass，不适用于双眼渲染，现已在 XR 下跳过。v1 接受这一点（星空像差/多普勒/头灯仍由 `StarField` shader 提供）；若要 VR 里也有全屏相对论效果，需另做"双眼后处理"，单独立项。
- **性能**：VR 要求 72–90fps 且双眼各渲染一遍。当前 `[PERF]` 探针已显示卡顿，24000 星点 + 8 行星每帧 Terrell 矩阵在 VR 双渲染下压力翻倍——进 VR 前建议先清掉 `[PERF]` 临时探针并做性能基线。
- **不改动桌面体验**：所有 VR 改动限定在 `xr.isPresenting` 分支内，桌面键盘/鼠标、DOM UI 原样保留。

---

## 7. 实施顺序（依赖关系）

1. **问题三的 HTTPS + 连接检测**（`vite.config.js` + 面板状态）→ 先确保"能进 VR"。
2. **问题一的相机 rig + 隐藏 DOM** → 进入后能 360° 环视、世界随飞船动。
3. **问题二的手柄输入抽象 + 射线交互** → 能用手柄飞行/操作。
4. （可选延后）手柄 3D 模型、VR 内 3D 化 UI、双眼相对论后处理。

---

## 8. 范围外（本次不做）

- VR 内的全屏相对论后处理（双眼后处理）
- 手柄 3D 模型（GLTF）加载
- VR 内 3D 化 / 可交互的 HUD 与信息面板
- 手部追踪（hand-tracking）的手势交互（仅作为 optionalFeature 预留）
