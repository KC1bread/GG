/**
 * strings — 双语字典（zh 中文[默认，保留少量专业英文词] / en 纯英文）
 * 所有文本统一以 key 检索；UI 静态文本 + 内容弹层文案都在此文件。
 */
import { CONTENT_STRINGS } from './strings-content.js';

const UI = {
  // ── 开场 ──
  'intro.title': { zh: 'Relativistic Voyager', en: 'Relativistic Voyager' },
  'intro.subtitle': {
    zh: '相对论航行者：近光速星际旅行沉浸式 3D 可视化交互系统',
    en: 'An immersive 3D visualization of near-light-speed interstellar travel, built on special relativity'
  },
  'intro.start': { zh: '开始任务', en: 'Start Mission' },
  'lang.en': { zh: 'EN', en: 'EN' },
  'lang.zh': { zh: '中文', en: 'CN' },
  'lang.switchTitle': { zh: '切换语言', en: 'Switch language' },

  // ── 飞船控制 ──
  'ctl.title': { zh: '飞船控制', en: 'Ship Controls' },
  'ctl.speed': { zh: '速度 β = v/c', en: 'Speed β = v/c' },
  'ctl.reset': { zh: '重置', en: 'Reset' },
  'ctl.frame': { zh: '参考系', en: 'Reference Frame' },
  'ctl.frame.earth': { zh: '地球参考系 Earth frame', en: 'Earth frame' },
  'ctl.frame.ship': { zh: '飞船参考系 Ship frame', en: 'Ship frame' },
  'ctl.frame.side': { zh: '并列比较 Side-by-side', en: 'Side-by-side' },
  'ctl.perspective': { zh: '视角 Perspective', en: 'Perspective' },
  'ctl.persp.third': { zh: '第三人称 Third-person', en: 'Third-person' },
  'ctl.persp.first': { zh: '第一人称 First-person', en: 'First-person' },
  'ctl.persp.note': {
    zh: '第一人称：屏幕中央是视线，橙色「航向」是飞行方向。按住右键偷看（松开回正）；P 持续观察；C 回正；A/D 转向。',
    en: 'First-person: the screen center is your line of sight; the orange "Heading" marker is the flight direction. Hold right mouse button to peek (release to recenter); P keeps observing; C recenters; A/D turn.'
  },
  'ctl.viewmode': { zh: '显示模式', en: 'View Mode' },
  'ctl.viewmode.measured': { zh: 'measured：物理测量模式', en: 'Measured' },
  'ctl.viewmode.observed': { zh: 'observed：视觉观察模式', en: 'Observed' },
  'ctl.terrell': { zh: 'Terrell 效果', en: 'Terrell Effect' },
  'ctl.terrell.lorentz': { zh: '纯 Lorentz 收缩', en: 'Lorentz Contraction Only' },
  'ctl.terrell.precise': { zh: 'Penrose-Terrell 精确', en: 'Penrose-Terrell Precise' },
  'ctl.terrell.enhanced': { zh: '增强教学', en: 'Enhanced Teaching' },

  // ── 双测量尺面板 ──
  'meas.title': { zh: '双测量尺', en: 'Measurement Rulers' },
  'meas.reset': { zh: '复位视角', en: 'Reset View' },
  'meas.mode': { zh: '当前模式', en: 'Mode' },
  'meas.parallelLen': { zh: '当前平行尺长度', en: 'Parallel length' },
  'meas.perpLen': { zh: '当前垂直尺长度', en: 'Perpendicular length' },
  'meas.frame.earth': { zh: '🌍 地球参考系', en: '🌍 Earth frame' },
  'meas.frame.ship': { zh: '🚀 飞船参考系', en: '🚀 Ship frame' },

  // ── HUD ──
  'hud.title': { zh: 'Relativity HUD', en: 'Relativity HUD' },
  'hud.beta': { zh: '速度 β', en: 'Speed β' },
  'hud.gamma': { zh: '洛伦兹因子 γ', en: 'Lorentz factor γ' },
  'hud.earthTime': { zh: '地球时间', en: 'Earth time' },
  'hud.shipTime': { zh: '飞船固有时间', en: 'Ship proper time' },
  'hud.earthDist': { zh: '地球系距离', en: 'Earth-frame distance' },
  'hud.shipDist': { zh: '飞船系距离', en: 'Ship-frame distance' },
  'hud.eta': { zh: '到达 ETA', en: 'ETA' },
  'hud.lengthRatio': { zh: '长度收缩比例', en: 'Length contraction ratio' },
  'hud.unitYears': { zh: '年', en: 'years' },
  'hud.unitLy': { zh: 'ly', en: 'ly' },

  // ── 顶部徽章 ──
  'badge.frame.earth': { zh: 'Earth', en: 'Earth' },
  'badge.frame.ship': { zh: 'Ship', en: 'Ship' },
  'badge.frame.side': { zh: 'Side-by-side', en: 'Side-by-side' },
  'badge.terrell.lorentzOnly': { zh: '纯长度收缩', en: 'Lorentz only' },
  'badge.terrell.precise': { zh: 'Penrose-Terrell 精确', en: 'Penrose-Terrell precise' },
  'badge.terrell.enhanced': { zh: '增强教学', en: 'Enhanced teaching' },
  'badge.effect.teaching': { zh: '教学模式', en: 'Teaching mode' },
  'badge.effect.physical': { zh: '显示模式', en: 'Display mode' },

  // ── 双时钟 ──
  'clock.earth': { zh: '🌍 地球钟 t', en: '🌍 Earth clock t' },
  'clock.ship': { zh: '🚀 飞船钟 τ', en: '🚀 Ship clock τ' },
  'clock.unitYear': { zh: '年', en: 'yr' },
  'clock.earthHint': { zh: '坐标时间 · 走得较快', en: 'Coordinate time · runs faster' },
  'clock.shipHint': { zh: '固有时间 · 走得较慢', en: 'Proper time · runs slower' },
  'clock.gap': { zh: '地球多过的岁月：', en: 'Earth leads by:' },

  // ── 时空图 ──
  'st.title': { zh: 'Minkowski 时空图', en: 'Minkowski Spacetime Diagram' },

  // ── 实验记录 ──
  'log.title': { zh: '实验记录', en: 'Experiment Log' },
  'log.exportJson': { zh: '导出 JSON', en: 'Export JSON' },
  'log.exportCsv': { zh: '导出 CSV', en: 'Export CSV' },
  'log.note': {
    zh: '记录速度调节、参考系切换、模式切换与学习行为。',
    en: 'Records speed changes, reference-frame switches, mode switches, and learning activities.'
  },

  // ── 准星 / 航向 ──
  'ch.look': { zh: '视线', en: 'Look' },
  'ch.heading': { zh: '航向', en: 'Heading' },
  'ch.headingBehind': { zh: '航向在身后', en: 'Heading behind' },

  // ── 高速视效概念释义 ──
  'guide.aberration': { zh: '光行差', en: 'Aberration' },
  'guide.teachmode': { zh: '教学模式', en: 'Teaching Mode' },
  'guide.doppler': { zh: '多普勒频移', en: 'Doppler Shift' },
  'guide.headlight': { zh: '暗角与头灯效应', en: 'Vignette & Headlight Effect' },
  'guide.p1': {
    zh: '高速前进时，来自前方的星光会被"挤"向视野中心，所以你会看到正前方更密、边缘更空。显示模式与教学模式的聚拢幅度基本相同。',
    en: 'At high speed, starlight from ahead is concentrated toward the center of your view, so the center looks denser and the edges emptier. Teaching and display modes collapse the field at roughly the same rate.'
  },
  'guide.p2': {
    zh: '教学档不额外挤星空，而是把后方、稀疏处的红移星放大、加亮、加红，方便在约 0.8c 回头观察。',
    en: 'Teaching mode does not compress the star field further; instead it enlarges, brightens, and reddens the redshifted stars behind you, making them easy to inspect at about 0.8c.'
  },
  'guide.teachSteps': {
    zh: '建议步骤：底栏打开「教学模式」→ 加速到 0.8c → 朝银心密集方向飞 → 转头看后方。底栏「学习教学」里可同时打开本释义。',
    en: 'Suggested steps: enable "Teaching Mode" in the bottom bar → accelerate to 0.8c → fly toward the dense galactic core → look back. Keep this guide open from "Learning & Teaching" in the bottom bar.'
  },
  'guide.p3': {
    zh: '迎面而来的光波被压缩，前方颜色更容易偏蓝；身后则会被拉长，趋向红移。教学档会把这种红移画得更显眼，物理读数不变。',
    en: 'Incoming light waves are compressed, so colors ahead shift toward blue; behind, they are stretched toward red. Teaching mode makes this redshift more prominent without changing the physical readings.'
  },
  'guide.p4': {
    zh: '能量更集中在前向视锥，边缘看起来更暗，中央更亮，像被"拉进"一条高速光隧道。',
    en: 'Energy concentrates into a forward cone: the edges look darker and the center brighter, like being pulled into a high-speed tunnel of light.'
  },
  'guide.forwardShift': { zh: '前向蓝移', en: 'Forward blueshift' },
  'guide.effect': { zh: '视效', en: 'Effect' },
  'guide.effect.teaching': { zh: '教学模式', en: 'Teaching Mode' },
  'guide.effect.physical': { zh: '显示模式', en: 'Display Mode' },

  // ── 航向提示（第一人称） ──
  'hint.observing': { zh: '观察中 · 偏离航向 {deg}° · C 或 Esc 回正', en: 'Observing · {deg}° off heading · C or Esc to recenter' },
  'hint.peek': { zh: '偏离航向 {deg}° · 松开右键回正', en: '{deg}° off heading · release right mouse to recenter' },
  'hint.off': { zh: '偏离航向 {deg}° · C 回正', en: '{deg}° off heading · C to recenter' },

  // ── 行星信息卡 ──
  'planet.diameter': { zh: '直径 Diameter', en: 'Diameter' },
  'planet.distSun': { zh: '与太阳距离', en: 'Distance from Sun' },
  'planet.period': { zh: '公转周期', en: 'Orbital period' },
  'planet.temp': { zh: '温度', en: 'Temperature' },
  'planet.moons': { zh: '卫星 Moons', en: 'Moons' },

  // ── 底栏 / 面板管理 ──
  'pm.group.simulation': { zh: '🚀仿真控制', en: '🚀 Simulation' },
  'pm.group.observation': { zh: '📊数据观测', en: '📊 Data & Observation' },
  'pm.group.education': { zh: '📚学习教学', en: '📚 Learning & Teaching' },
  'pm.group.visualization': { zh: '📈可视化工具', en: '📈 Visualization' },
  'pm.group.vr': { zh: '🥽VR设备', en: '🥽 VR Devices' },
  'pm.panel.control': { zh: '飞船控制', en: 'Ship Controls' },
  'pm.panel.hud': { zh: 'Relativity HUD', en: 'Relativity HUD' },
  'pm.panel.log': { zh: '实验记录', en: 'Experiment Log' },
  'pm.panel.teaching': { zh: '教学模式', en: 'Teaching Mode' },
  'pm.panel.guide': { zh: '高速视效概念释义', en: 'High-Speed Effects Guide' },
  'pm.panel.spacetime': { zh: 'Minkowski 时空图', en: 'Minkowski Diagram' },
  'pm.panel.measurement': { zh: '双测量尺', en: 'Measurement Rulers' },
  'pm.panel.vr': { zh: 'VR状态提示', en: 'VR Status' },
  'pm.collapse': { zh: '收起底栏', en: 'Collapse bar' },
  'pm.expand': { zh: '展开底栏', en: 'Expand bar' },
  'pm.minAll': { zh: '— 全部最小化', en: '— Minimize All' },
  'pm.closeAll': { zh: '× 全部关闭', en: '× Close All' },
  'pm.minAllTitle': { zh: '一键全部最小化', en: 'Minimize all panels' },
  'pm.closeAllTitle': { zh: '一键全部关闭', en: 'Close all panels' },
  'pm.minimize': { zh: '最小化', en: 'Minimize' },
  'pm.close': { zh: '关闭', en: 'Close' },
  'pm.openX': { zh: '打开 {label}', en: 'Open {label}' },
  'pm.toggleX': { zh: '切换 {label}', en: 'Toggle {label}' },
  'pm.expandX': { zh: '展开 {label}', en: 'Expand {label}' },
  'pm.collapseX': { zh: '收起 {label}', en: 'Collapse {label}' },
  'pm.restoreX': { zh: '恢复 {label}', en: 'Restore {label}' },
  'pm.topmostX': { zh: '{label} (已打开，点击置顶)', en: '{label} (open — click to raise)' },
  'pm.badge.toggle': { zh: '切换顶部信息状态栏', en: 'Toggle top status bar' },
  'pm.guide.on': { zh: '打开 高速视效概念释义', en: 'Open High-Speed Effects Guide' },
  'pm.guide.off': { zh: '关闭 高速视效概念释义', en: 'Close High-Speed Effects Guide' },
  'pm.teaching.on': { zh: '打开教学模式', en: 'Enable Teaching Mode' },
  'pm.teaching.off': { zh: '关闭教学模式（切回显示模式）', en: 'Disable Teaching Mode (back to Display Mode)' },
  'pm.vr.title': { zh: 'VR状态检测', en: 'VR Status' },
  'pm.vr.status': { zh: 'VR 设备状态', en: 'VR Device Status' },
  'pm.vr.unsupported': {
    zh: '当前浏览器不支持 VR / WebXR，或未检测到 VR 设备。',
    en: 'VR / WebXR is not supported by this browser, or no VR device was detected.'
  },
  'pm.vr.note1': {
    zh: '如需体验沉浸式 VR 交互，请使用支持 WebXR 的浏览器（如 Chrome）并连接兼容的 VR 头显设备。',
    en: 'For an immersive VR experience, use a WebXR-capable browser (e.g. Chrome) with a compatible VR headset.'
  },
  'pm.vr.note2': {
    zh: 'VR 完整沉浸式交互方案将在后续版本迭代开发。',
    en: 'Full immersive VR interaction will be developed in a later version.'
  }
};

// 合并为按语言索引的字典
export const STRINGS = { zh: {}, en: {} };
for (const langKey of ['zh', 'en']) {
  for (const group of [UI, CONTENT_STRINGS]) {
    for (const key of Object.keys(group)) {
      const entry = group[key];
      if (typeof entry === 'string') {
        // 单语言字符串（罕见兜底）
        STRINGS[langKey][key] = entry;
      } else if (entry && typeof entry === 'object') {
        STRINGS[langKey][key] = entry[langKey] ?? entry.zh ?? entry.en ?? key;
      }
    }
  }
}
