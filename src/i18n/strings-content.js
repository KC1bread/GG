/**
 * strings-content — 弹层解说 / 图例 / 学习数据 的双语文案
 * （与 strings.js 合并后由 i18n.js 使用；zh = 中英结合版文案转正为中文版）
 */

// ── 双测量尺概念解说（HTML body，支持 <strong>/<br>/emoji） ──
const MEASUREMENT_HELP = {
  'mhelp.parallel.title': {
    zh: '平行尺',
    en: 'Parallel Rod'
  },
  'mhelp.parallel.body': {
    zh:
      '<strong>平行尺：沿飞船运动方向</strong>' +
      '<br>🌍 地球参考系中，沿运动方向缩短至 √(1−β²) 倍；' +
      '🚀 飞船参考系中与飞船相对静止，长度不变。' +
      '<br><strong>Measured（测量模式）</strong>：地球参考系下展示纯长度收缩，' +
      '实际长度 = 固有长度 × √(1−β²)。' +
      '<br><strong>Observed（观察模式）</strong>：地球参考系下叠加 Penrose-Terrell 旋转，' +
      '光传播延迟与光行差使尺子呈与视角相关的倾斜。' +
      '<div class="st-help-sub"><strong>纯长度收缩</strong>：仅展示测量收缩，不旋转。</div>' +
      '<div class="st-help-sub"><strong>P-T 精确</strong>：旋转角按 θ = asin(β·sinα) 计算。</div>' +
      '<div class="st-help-sub"><strong>增强教学</strong>：旋转角 ×1.5 放大，便于观察。</div>',
    en:
      '<strong>Parallel rod: along the direction of motion</strong>' +
      '<br>🌍 In the Earth frame it contracts along the motion to √(1−β²) of its proper length; ' +
      '🚀 in the Ship frame it is at rest with the ship, so its length stays unchanged.' +
      '<br><strong>Measured</strong>: pure length contraction in the Earth frame — ' +
      'length = proper length × √(1−β²).' +
      '<br><strong>Observed</strong>: Penrose-Terrell rotation is added in the Earth frame; ' +
      'light-travel delay and aberration tilt the rod depending on the viewing angle.' +
      '<div class="st-help-sub"><strong>Lorentz only</strong>: measurement contraction only, no rotation.</div>' +
      '<div class="st-help-sub"><strong>P–T precise</strong>: rotation angle θ = asin(β·sinα).</div>' +
      '<div class="st-help-sub"><strong>Enhanced teaching</strong>: rotation angle ×1.5 for easier viewing.</div>'
  },
  'mhelp.perp.title': {
    zh: '垂直尺',
    en: 'Perpendicular Rod'
  },
  'mhelp.perp.body': {
    zh:
      '<strong>垂直尺：垂直于运动方向</strong>' +
      '<br>垂直方向不发生长度收缩，在任意参考系中长度恒为固有长度 5.00，' +
      '作为参照与平行尺对比。',
    en:
      '<strong>Perpendicular rod: perpendicular to the direction of motion</strong>' +
      '<br>No length contraction occurs perpendicular to the motion; the length stays at the ' +
      'proper length 5.00 in any frame, serving as a reference against the parallel rod.'
  },
  'mhelp.aria': {
    zh: '测量尺概念说明',
    en: 'Measurement ruler help'
  },
  'rod.parallel': {
    zh: '平行尺',
    en: 'Parallel rod'
  },
  'rod.perpendicular': {
    zh: '垂直尺',
    en: 'Perpendicular rod'
  }
};

// ── 时空图概念解说 ──
const SPACETIME_HELP = {
  'sthelp.btn': {
    zh: '时空图概念说明',
    en: 'Spacetime diagram help'
  },
  'sthelp.aria': {
    zh: '概念说明',
    en: 'Concept info'
  },
  'sthelp.close': {
    zh: '关闭',
    en: 'Close'
  },
  'sthelp.info.title': {
    zh: '什么是时空图？',
    en: 'What is a spacetime diagram?'
  },
  'sthelp.info.earth.body': {
    zh:
      '时空图（Minkowski Diagram）是一种利用"空间（x）"和"时间（ct）"描述物体运动状态的可视化工具。' +
      '在地球参考系中，地球保持静止，因此地球世界线始终竖直；飞船向右运动，因此飞船世界线向右倾斜，' +
      '速度越接近光速，世界线越接近光锥。' +
      '通过观察世界线、光锥和同时线，可以直观理解狭义相对论中的时间膨胀以及不同速度下的运动关系。',
    en:
      'A spacetime diagram (Minkowski Diagram) is a tool that visualizes motion using space (x) and time (ct). ' +
      'In the Earth frame, Earth is at rest, so its worldline stays vertical; the ship moves to the right, so its ' +
      'worldline tilts right, approaching the light cone as speed approaches c. ' +
      'By examining worldlines, the light cone, and simultaneity lines, you can intuitively grasp time dilation ' +
      'and the relationship between motion at different speeds in special relativity.'
  },
  'sthelp.info.ship.body': {
    zh:
      '时空图（Minkowski Diagram）仍然描述物体在时空中的运动，只是观察者变成了飞船。' +
      '在飞船参考系中，飞船保持静止，因此飞船世界线始终竖直；地球相对飞船向左运动，因此地球世界线向左倾斜。' +
      '由于参考系发生改变，同时线的方向也会改变，这体现了狭义相对论中的"同时性的相对性"。' +
      '通过切换参考系，可以观察同一运动过程在不同观察者眼中的时空几何关系。',
    en:
      'The spacetime diagram (Minkowski Diagram) still describes motion through spacetime, but now the observer ' +
      'is the ship. In the ship frame, the ship is at rest, so its worldline stays vertical; Earth moves left ' +
      'relative to the ship, so its worldline tilts left. ' +
      'Because the reference frame changes, the simultaneity lines tilt as well — this is the relativity of ' +
      'simultaneity in special relativity. ' +
      'Switching frames lets you see how the same motion looks as spacetime geometry to different observers.'
  },
  'sthelp.c.earthWorldline.title': { zh: '地球世界线', en: 'Earth worldline' },
  'sthelp.c.earthWorldline.body': {
    zh:
      '表示地球在时空中的运动轨迹。' +
      '在地球参考系中，地球保持静止，因此世界线竖直。' +
      '在飞船参考系中，地球相对飞船向左运动，因此世界线向左倾斜。',
    en:
      'Shows Earth\'s trajectory through spacetime. ' +
      'In the Earth frame, Earth is at rest, so its worldline is vertical. ' +
      'In the ship frame, Earth moves left relative to the ship, so its worldline tilts left.'
  },
  'sthelp.c.shipWorldline.title': { zh: '飞船世界线', en: 'Ship worldline' },
  'sthelp.c.shipWorldline.body': {
    zh:
      '表示飞船在时空中的运动轨迹。' +
      '在地球参考系中，飞船速度越大，世界线越接近光锥。' +
      '在飞船参考系中，飞船始终认为自己静止，因此世界线与 ct′ 轴重合。',
    en:
      'Shows the ship\'s trajectory through spacetime. ' +
      'In the Earth frame, the faster the ship moves, the closer its worldline gets to the light cone. ' +
      'In the ship frame, the ship always considers itself at rest, so its worldline coincides with the ct′ axis.'
  },
  'sthelp.c.lightCone.title': { zh: '光锥', en: 'Light cone' },
  'sthelp.c.lightCone.body': {
    zh:
      '光锥表示光在时空中的传播方向。' +
      '任何具有质量的物体，其世界线都必须位于光锥内部，因此飞船速度可以无限接近光速，但永远不会超过光速。' +
      '光锥在所有惯性参考系中保持不变。',
    en:
      'The light cone shows the direction light travels in spacetime. ' +
      'Any object with mass must keep its worldline inside the light cone, so the ship can approach but never ' +
      'reach or exceed the speed of light. ' +
      'The light cone is the same in every inertial frame.'
  },
  'sthelp.c.simultaneity.title': { zh: '同时线', en: 'Simultaneity line' },
  'sthelp.c.simultaneity.body': {
    zh:
      '同时线表示某一参考系认为"同时发生"的所有事件。' +
      '在地球参考系中，同时线保持水平。' +
      '在飞船参考系中，同时线发生倾斜，体现了狭义相对论中"同时性的相对性"。',
    en:
      'A simultaneity line connects all events that one frame considers "simultaneous". ' +
      'In the Earth frame, simultaneity lines stay horizontal. ' +
      'In the ship frame, they tilt — this is the relativity of simultaneity in special relativity.'
  },
  'sthelp.c.eventPoint.title': { zh: '事件点', en: 'Event point' },
  'sthelp.c.eventPoint.body': {
    zh:
      '事件点表示飞船当前所在的时空位置。' +
      '随着飞船运动，事件点沿飞船世界线移动，用于表示当前时刻对应的空间位置和时间。',
    en:
      'The event point marks the ship\'s current location in spacetime. ' +
      'As the ship moves, the event point travels along the ship\'s worldline, showing the position and time ' +
      'of the current moment.'
  },
  'sthelp.c.velocityRef.title': { zh: '速度参考线', en: 'Velocity reference line' },
  'sthelp.c.velocityRef.body': {
    zh:
      '速度参考线反映飞船当前速度在时空图中的倾斜程度：速度越大，线条越倾斜，越接近光锥。',
    en:
      'The velocity reference line reflects how steeply the ship\'s current speed appears in the diagram: ' +
      'the higher the speed, the more tilted the line, approaching the light cone.'
  },
  'st.legend.earthWL': { zh: '地球世界线', en: 'Earth worldline' },
  'st.legend.shipWL': { zh: '飞船世界线', en: 'Ship worldline' },
  'st.legend.cone': { zh: '光锥', en: 'Light cone' },
  'st.legend.shipSim': { zh: '飞船系同时线', en: 'Ship simultaneity' },
  'st.legend.earthSim': { zh: '地球系同时线', en: 'Earth simultaneity' },
  'st.legend.velRef': { zh: '速度参考线', en: 'Velocity reference' }
};

export const CONTENT_STRINGS = {
  ...MEASUREMENT_HELP,
  ...SPACETIME_HELP
};
