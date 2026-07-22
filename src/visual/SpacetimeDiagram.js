/**
 * SpacetimeDiagram — Minkowski ct-x 时空图
 *
 * ── 参考系分支 ──
 *  earth 模式：正交 ct/x 轴，地球世界线垂直，飞船世界线右偏
 *  ship 模式：斜交 ct'/x' 轴（洛伦兹坐标系），隐藏正交轴
 *    · ct' 轴（= 黄色飞船世界线）向右倾斜 θ = arctan(β)
 *    · x' 轴向左上方倾斜 θ，与 ct' 轴以 45° 光锥严格对称
 *    · 地球世界线向左反向倾斜（洛伦兹剪切几何）
 *    · 同时虚线 ∥ x' 轴，速度参考线 ∥ x' 轴
 *    · 光锥永久保持 45°，不拉伸不旋转
 */

export const DIAGRAM_MAX_EARTH_TIME = 4.24; // ly / c = light-year travel time

export class SpacetimeDiagram {
  constructor(state, opts = {}) {
    this.state = state;
    this.canvas = opts.canvas || document.getElementById('spacetime-canvas');
    this._frameOverride = opts.frame || null;  // sideBySide 时覆盖参考系
    this.ctx = this.canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
  }

  /** Returns the earth-time value at which the event point reaches the top of the diagram. */
  getMaxTime() {
    return DIAGRAM_MAX_EARTH_TIME;
  }

  update() {
    const ctx = this.ctx;
    const rectWidth  = this.canvas.clientWidth || parseInt(this.canvas.getAttribute('width')) || 260;
    const rectHeight = this.canvas.clientHeight || parseInt(this.canvas.getAttribute('height')) || 520;
    if (rectWidth < 10 || rectHeight < 10) return;

    // DPR 适配：仅刷新缓冲尺寸，CSS 样式由 width:100% 或属性默认值控制
    const logicalW = rectWidth;
    const logicalH = rectHeight;
    const targetBufW = Math.round(logicalW * this.dpr);
    const targetBufH = Math.round(logicalH * this.dpr);
    if (this.canvas.width !== targetBufW || this.canvas.height !== targetBufH) {
      this.canvas.width  = targetBufW;
      this.canvas.height = targetBufH;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(this.dpr, this.dpr);

    const w = rectWidth;
    const h = rectHeight;

    const top    = 18;
    const bottomNoteHeight = 42;
    const legendHeight     = 50;
    const paddingX = 18;
    const originY = h - bottomNoteHeight - legendHeight - 18;
    const origin  = { x: w / 2, y: originY };
    const availY  = origin.y - top;
    const availX  = Math.min(origin.x - paddingX, w / 2 - paddingX);
    const conePx  = Math.min(availX, availY);
    const beta    = Math.max(0.0001, this.state.beta);
    const progress = Math.min(1, this.state.earthTime / DIAGRAM_MAX_EARTH_TIME);
    const isShip  = (this._frameOverride || this.state.frame) === 'ship';
    const theta   = Math.atan(beta);

    // 当前事件在飞船世界线 (= ct' 轴) 上的位置
    const eventY = origin.y - conePx * progress;
    const eventX = origin.x + beta * conePx * progress;

    // ── 背景 ──
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#07111f';
    ctx.fillRect(0, 0, w, h);

    // ═══════════════════════════════════════════════════════════
    //  光锥 — 两个模式共用，永久 45°
    // ═══════════════════════════════════════════════════════════
    ctx.strokeStyle = '#8899bb';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x - conePx, origin.y - conePx);
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x + conePx, origin.y - conePx);
    ctx.stroke();
    ctx.setLineDash([]);

    // ═══════════════════════════════════════════════════════════
    //  分支：earth 模式 vs ship 模式
    // ═══════════════════════════════════════════════════════════

    if (isShip) {
      // ────────────────────────────────────────────────────────
      //  飞船参考系：隐藏原始 ct/x 轴，绘制斜交 ct'/x' 轴
      //  右上象限（从原点向右上方）：
      //    x' 轴 —— 从水平向上偏 θ，端点 (ox + conePx, oy - β·conePx)
      //    45° 光锥 —— 端点 (ox + conePx, oy - conePx)
      //    ct' 轴 —— 从垂直向右偏 θ，端点 (ox + β·conePx, oy - conePx)
      //    x' 与 ct' 对称于 45° 光锥
      // ────────────────────────────────────────────────────────

      const axisColor = '#9fb7ff';

      // ── ① x' 轴（飞船空间轴）：向右上倾斜 θ ──
      //    方向 (1, -β) 在像素空间
      const xPrimeEndX = origin.x + conePx;
      const xPrimeEndY = origin.y - beta * conePx;
      ctx.strokeStyle = axisColor;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(xPrimeEndX, xPrimeEndY);
      ctx.stroke();

      ctx.fillStyle = axisColor;
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText("x'", xPrimeEndX + 4, xPrimeEndY + 6);

      // ── ② ct' 轴（飞船时间轴）= 黄色飞船世界线 ──
      //    方向 (β, -1) 在像素空间，与 x' 轴对称于 45° 光锥
      const shipEndX = origin.x + beta * conePx;
      const shipEndY = origin.y - conePx;

      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(shipEndX, shipEndY);
      ctx.stroke();

      ctx.fillStyle = '#facc15';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText("ct'", shipEndX + 8, shipEndY + 6);

      // ── ③ 地球世界线：向左上反向倾斜（飞船系中地球以 -β 运动） ──
      //    方向 (-β, -1) 在像素空间
      const earthLen = conePx * 0.85;
      const earthEndX = origin.x - beta * earthLen;
      const earthEndY = origin.y - earthLen;
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(earthEndX, earthEndY);
      ctx.stroke();

      ctx.fillStyle = '#7dd3fc';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('Earth', earthEndX - 6, earthEndY + 6);

      // ── ④ 当前事件白色圆点 ──
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(eventX, eventY, 5, 0, Math.PI * 2);
      ctx.fill();

      // ── ⑤ 飞船 β 标签 ──
      if (progress > 0.005) {
        ctx.save();
        const labelText = `Ship β=${beta.toFixed(2)}`;
        ctx.fillStyle = '#facc15';
        ctx.font = '12px sans-serif';
        const textW = ctx.measureText(labelText).width;
        const pad = 10;
        let textX, textY;
        if (eventX + pad + textW < w - paddingX) {
          textX = eventX + pad;
          textY = eventY - pad;
          ctx.textAlign = 'left';
        } else {
          textX = eventX - pad;
          textY = eventY - pad;
          ctx.textAlign = 'right';
        }
        ctx.textBaseline = 'bottom';
        ctx.fillText(labelText, textX, textY);
        ctx.restore();
      }

      // ── ⑥ 同时虚线（浅冰蓝色 #a8d8ff，短间隔 ∥ x' 轴） ──
      ctx.save();
      ctx.strokeStyle = '#a8d8ff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 4]);
      const simHalf = w * 0.38;
      ctx.beginPath();
      ctx.moveTo(eventX - simHalf, eventY + beta * simHalf);
      ctx.lineTo(eventX + simHalf, eventY - beta * simHalf);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // ── ⑦ 速度参考虚线（淡黄色，长间隔 ∥ x' 轴，无钳位防斜率破坏） ──
      if (beta > 0.005 && progress > 0.001) {
        ctx.save();
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([6, 3]);
        const refHalf = w * 0.35;
        ctx.beginPath();
        ctx.moveTo(eventX - refHalf, eventY + beta * refHalf);
        ctx.lineTo(eventX + refHalf, eventY - beta * refHalf);
        ctx.stroke();
        ctx.restore();
      }

    } else {
      // ────────────────────────────────────────────────────────
      //  地球参考系：正交坐标轴（原有逻辑，保持不动）
      // ────────────────────────────────────────────────────────

      // 坐标轴 — ct 轴长度与 ship 模式统一（conePx），确保并列对比时高度一致
      const axisColor = '#9fb7ff';
      ctx.strokeStyle = axisColor;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(origin.x, origin.y - conePx);
      ctx.moveTo(paddingX, origin.y);
      ctx.lineTo(w - paddingX, origin.y);
      ctx.stroke();

      ctx.fillStyle = axisColor;
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('ct', origin.x + 8, origin.y - conePx + 6);
      ctx.fillText('x', w - paddingX - 12, origin.y - 8);

      // 地球世界线（长度同样 conePx 对齐）
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(origin.x, origin.y - conePx + 8);
      ctx.stroke();
      ctx.fillStyle = '#7dd3fc';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Earth', origin.x - 38, origin.y - conePx + 24);

      // 飞船世界线（右偏）
      const shipEndX = origin.x + beta * conePx;
      const shipEndY = origin.y - conePx;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(shipEndX, shipEndY);
      ctx.stroke();

      // 事件白点
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(eventX, eventY, 5, 0, Math.PI * 2);
      ctx.fill();

      // 飞船标签
      if (progress > 0.005) {
        ctx.save();
        const labelText = `Ship β=${beta.toFixed(2)}`;
        ctx.fillStyle = '#facc15';
        ctx.font = '12px sans-serif';
        const textW = ctx.measureText(labelText).width;
        const pad = 10;
        let textX, textY;
        if (eventX + pad + textW < w - paddingX) {
          textX = eventX + pad;
          textY = eventY - pad;
          ctx.textAlign = 'left';
        } else {
          textX = eventX - pad;
          textY = eventY - pad;
          ctx.textAlign = 'right';
        }
        ctx.textBaseline = 'bottom';
        ctx.fillText(labelText, textX, textY);
        ctx.restore();
      }

      // 同时线（地球系 → 水平紫色）
      ctx.save();
      ctx.strokeStyle = '#b8a0e0';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(Math.max(34, 20), eventY);
      ctx.lineTo(Math.min(w - 34, w - 20), eventY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // 速度参考线
      if (beta > 0.005 && progress > 0.001) {
        ctx.save();
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(eventX, eventY);

        const extPx = conePx * 0.3;
        let refEndX = eventX + beta * extPx;
        let refEndY = eventY - extPx;

        const leftBound = 34, rightBound = w - 34;
        const topBound = top, bottomBound = origin.y;
        let scale = 1;
        if (refEndX < leftBound)  scale = Math.min(scale, (leftBound - eventX) / (refEndX - eventX));
        if (refEndX > rightBound) scale = Math.min(scale, (rightBound - eventX) / (refEndX - eventX));
        if (refEndY < topBound)   scale = Math.min(scale, (topBound - eventY) / (refEndY - eventY));
        if (refEndY > bottomBound) scale = Math.min(scale, (bottomBound - eventY) / (refEndY - eventY));

        ctx.lineTo(
          eventX + (refEndX - eventX) * scale,
          eventY + (refEndY - eventY) * scale
        );
        ctx.stroke();
        ctx.restore();
      }
    }

    // ═══════════════════════════════════════════════════════════
    //  图例（两个模式共用，同时线颜色随模式变化）
    // ═══════════════════════════════════════════════════════════
    const legendData = [
      { color: '#7dd3fc', width: 3,   dash: false, label: '地球世界线' },
      { color: '#facc15', width: 3,   dash: false, label: '飞船世界线' },
      { color: '#8899bb', width: 1.5, dash: true,  label: '光锥' },
    ];

    if (isShip) {
      legendData.push({ color: '#a8d8ff', width: 1.5, dash: true, label: '飞船系同时线' });
    } else {
      legendData.push({ color: '#b8a0e0', width: 1.5, dash: true, label: '地球系同时线' });
    }

    if (beta > 0.005) {
      legendData.push({
        color: 'rgba(250, 204, 21, 0.45)',
        width: 1.2,
        dash: true,
        label: '速度参考线'
      });
    }

    const legPad   = 8;
    const legGapX  = 14;
    const legItemH = 18;
    const col1W    = 90;
    const col2W    = 90;
    const legRows  = Math.ceil(legendData.length / 2);
    const legBoxW  = col1W + legGapX + col2W + legPad * 2;
    const legBoxH  = legRows * legItemH + legPad * 2;

    const legX = w / 2;
    const legY = originY + 20;
    const legLX = legX - legBoxW / 2;
    const legTY = legY;

    ctx.save();
    ctx.fillStyle = 'rgba(7, 17, 31, 0.70)';
    this._roundRect(ctx, legLX, legTY, legBoxW, legBoxH, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(159, 183, 255, 0.18)';
    ctx.lineWidth = 0.5;
    this._roundRect(ctx, legLX, legTY, legBoxW, legBoxH, 6);
    ctx.stroke();

    ctx.font = '11px sans-serif';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < legendData.length; i++) {
      const item = legendData[i];
      const col  = i % 2;
      const row  = Math.floor(i / 2);
      const colOff = col === 0 ? 0 : col1W + legGapX;
      const y = legTY + legPad + row * legItemH + legItemH / 2;
      const sx = legLX + legPad + colOff;

      ctx.strokeStyle = item.color;
      ctx.lineWidth   = item.width;
      ctx.setLineDash(item.dash ? [3, 4] : []);
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.lineTo(sx + 18, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#c8d6f0';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, sx + 24, y);
    }
    ctx.restore();
  }

  /** 圆角矩形路径 */
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
