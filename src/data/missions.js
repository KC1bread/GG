export const missions = [
  {
    id: 'baseline',
    title: '任务 1：建立低速直觉基线',
    description: '将速度调到 0.1c 左右。观察 γ 是否接近 1，以及地球时间和飞船时间是否几乎相同。',
    targetBeta: 0.1,
    tolerance: 0.035,
    concept: '在低速世界中，相对论效应非常小，因此我们的日常直觉看起来是有效的。'
  },
  {
    id: 'time-dilation',
    title: '任务 2：观察时间膨胀',
    description: '将速度调到 0.8c 以上。比较地球时间和飞船固有时间，观察两者差异如何变大。',
    targetBeta: 0.8,
    tolerance: 0.04,
    concept: '从地球参考系看，高速飞船上的钟走得更慢；飞船乘员经历的是自身固有时间。'
  },
  {
    id: 'length-contraction',
    title: '任务 3：观察长度收缩',
    description: '切换到 Measured 模式，并将速度调到 0.9c。观察测量杆沿运动方向的收缩。',
    targetBeta: 0.9,
    tolerance: 0.04,
    requiredMode: 'measured',
    concept: '长度收缩是参考系中的测量结果，不是简单的视觉压扁。'
  },
  {
    id: 'observed-mode',
    title: '任务 4：区分测量与观察',
    description: '切换到 Observed 模式。比较视觉观察效果与 Measured 模式下的物理测量结果。',
    requiredMode: 'observed',
    targetBeta: 0.9,
    tolerance: 0.08,
    concept: '观察到的图像还会受到光传播时间、方向和视角影响，因此不完全等同于测量值。'
  },
  {
    id: 'frame-switching',
    title: '任务 5：比较参考系',
    description: '切换到并列比较模式。比较地球参考系距离和飞船参考系距离的差异。',
    targetBeta: 0.99,
    tolerance: 0.02,
    requiredFrame: 'sideBySide',
    concept: '同一段旅程在不同参考系下可以有不同的时间和距离描述，但这些描述并不互相矛盾。'
  }
];
