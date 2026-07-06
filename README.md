# Relativistic Voyager Alpha

**相对论航行者：面向狭义相对论理解的近光速星际旅行沉浸式 3D 可视化交互系统**

这是一个基于 **Three.js + WebXR** 的扩展版 MVP / Alpha Prototype。它不是简单的 3D 星空演示，而是一个可以支撑研究 proposal、课堂展示和初步用户实验的交互式科学可视化原型。

## 1. 当前版本新增内容

相比最初 MVP，本版本新增：

- 速度控制：β = v/c，范围 0–0.99c
- 洛伦兹因子 γ 实时计算
- 地球参考系时间与飞船固有时间对比
- 地球参考系距离与飞船参考系距离对比
- 长度收缩测量杆
- 星空光行差近似表现
- 多普勒颜色变化近似表现
- Measured / Observed 双模式
- Earth / Ship / Side-by-side 参考系切换
- 学习任务系统 Mission System
- 概念解释层级 Concept Scaffolding
- 概念问答 Quiz System
- Minkowski 时空图面板
- 实验日志记录与 JSON / CSV 导出
- WebXR / VR 入口

## 2. 技术栈

- Three.js：3D 场景渲染
- WebXR：浏览器端 VR 支持
- Vite：前端开发与构建
- JavaScript ES Modules：模块化开发
- Canvas 2D：Minkowski 时空图

## 3. 运行方式

```bash
npm install
npm run dev
```

浏览器打开终端中显示的地址。

如果要在 VR 设备中访问，建议：

```bash
npm run dev -- --host 0.0.0.0
```

然后使用同一局域网下的 VR 浏览器访问该地址。WebXR 通常要求安全上下文，因此正式测试建议使用 HTTPS 或 localhost。

## 4. 目录结构

```text
src/
├── core/
│   └── App.js
├── physics/
│   └── relativity.js
├── visual/
│   ├── StarField.js
│   ├── Spacecraft.js
│   ├── MeasurementRod.js
│   ├── SceneObjects.js
│   └── SpacetimeDiagram.js
├── ui/
│   ├── ControlPanel.js
│   ├── Hud.js
│   ├── MissionSystem.js
│   ├── ConceptPanel.js
│   ├── QuizSystem.js
│   └── DataLogger.js
├── data/
│   ├── missions.js
│   ├── quizzes.js
│   └── concepts.js
├── main.js
└── style.css
```

## 5. 核心设计思想

### 5.1 Reference-frame switching as interaction design

用户可以在地球参考系、飞船参考系和并列比较模式之间切换。该设计用于帮助用户理解：狭义相对论的核心不是视觉奇观，而是不同惯性参考系对时间、距离和事件顺序的描述差异。

### 5.2 Measured vs Observed dual-mode visualization

系统区分：

- **Measured Mode**：某一参考系中的物理测量结果，例如长度收缩。
- **Observed Mode**：观察者接收到光信号后看到的视觉结果。

这个设计用于避免用户把“长度收缩”误解为普通视觉压扁。

### 5.3 Experience → Comparison → Explanation → Reflection

系统采用四步学习路径：

1. Experience：用户驾驶飞船并调节速度。
2. Comparison：用户比较地球时间、飞船时间和不同参考系距离。
3. Explanation：系统通过概念层级和公式解释现象。
4. Reflection：通过任务与问答检查用户理解。

## 6. 可用于用户实验的数据

系统记录以下事件：

- start
- speed_change
- speed_preset
- frame_change
- view_mode_change
- mission_complete
- quiz_answer
- reset
- pause_toggle

可以导出 JSON 或 CSV，用于后续分析。

## 7. 后续扩展建议

下一步可以继续加入：

- 更准确的 relativistic shader
- 光传播时间延迟
- Penrose-Terrell rotation
- 完整 pre-test / post-test 页面
- NASA-TLX / SUS / Presence 问卷
- 后端数据库
- 用户 ID 与实验条件分组
- 更精细的 VR 手柄交互
- 课堂教师控制模式
