# Relativistic Voyager Alpha Design Specification

## 1. Alpha Prototype Goal

本 Alpha Prototype 的目标是从“可运行演示”升级为“可用于研究展示与初步用户实验的交互式原型”。它需要具备明确的学习路径、研究变量、可记录数据和可扩展架构。

## 2. 用户学习路径

```text
进入系统
  ↓
低速飞行，建立日常直觉
  ↓
逐步加速，观察 γ 值变化
  ↓
比较地球时间与飞船固有时间
  ↓
观察星空光行差与多普勒颜色偏移
  ↓
切换 Measured / Observed 模式
  ↓
切换 Earth / Ship / Side-by-side 参考系
  ↓
查看 Minkowski 时空图
  ↓
完成任务与概念问答
  ↓
导出交互日志用于分析
```

## 3. MVP+ 功能矩阵

| 模块 | MVP | Alpha 扩展 |
|---|---|---|
| 3D 场景 | 星空 + 飞船 | 星空、飞船、地球、目标恒星、测量杆、网格参考面 |
| 物理计算 | γ、时间膨胀 | γ、时间膨胀、长度收缩、参考系距离、ETA、多普勒因子、光行差近似 |
| 交互 | 速度滑块 | 速度预设、参考系切换、Measured/Observed 模式、暂停、重置 |
| 教学 | HUD 数值 | 分层概念解释、任务系统、概念问答 |
| 可视化 | 长度收缩 | 星空集中、颜色偏移、测量杆模式差异、Minkowski 时空图 |
| 数据 | 无或简单日志 | JSON/CSV 日志导出，可用于实验分析 |
| XR | VRButton | 支持 WebXR 入口，后续可扩展 VR 手柄任务 |

## 4. 研究变量

### Independent Variables

- 学习条件：传统 2D / 桌面 3D / WebXR 沉浸式
- 可视化模式：Measured only / Measured + Observed
- 参考系呈现：单参考系 / 可切换参考系 / 并列比较

### Dependent Variables

- 概念测试得分
- 误解纠正率
- 任务完成时间
- 参考系切换次数
- 问答正确率
- SUS 可用性
- NASA-TLX 认知负荷
- Presence / Engagement 评分

## 5. 当前版本的边界

当前版本只聚焦狭义相对论，不实现广义相对论。也就是说，本版本不模拟：

- 黑洞
- 引力透镜
- 引力时间膨胀
- 时空曲率
- 测地线
- 强引力场中的光线弯曲

这些内容可作为后续版本的 Future Work。

## 6. 下一阶段开发优先级

### Priority 1：增强物理表现

- 更准确的 Doppler shader
- 更准确的 stellar aberration
- 光传播时间延迟
- 物体视觉外观模拟

### Priority 2：增强教学研究功能

- Pre-test / Post-test 页面
- 自动评分
- 错误类型分类
- 任务完成路径记录
- 教师端演示模式

### Priority 3：增强 VR 交互

- VR 手柄射线选择
- VR 中的速度控制器
- 驾驶舱仪表盘
- 空间中的浮动解释卡片

### Priority 4：实验数据后端

- 用户 ID
- 实验条件分组
- 数据上传 API
- CSV/JSON 数据管理
