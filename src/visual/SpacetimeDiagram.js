export class SpacetimeDiagram {
  constructor(state) {
    this.state = state;
    this.canvas = document.getElementById('spacetime-canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  update() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#07111f';
    ctx.fillRect(0, 0, w, h);

    const origin = { x: w / 2, y: h - 36 };
    const top = 28;
    const axisColor = '#9fb7ff';
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x, top);
    ctx.moveTo(34, origin.y);
    ctx.lineTo(w - 34, origin.y);
    ctx.stroke();

    ctx.fillStyle = axisColor;
    ctx.font = '13px sans-serif';
    ctx.fillText('ct', origin.x + 8, top + 6);
    ctx.fillText('x', w - 48, origin.y - 8);

    // light cone x = ±ct
    ctx.strokeStyle = '#445b88';
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x - 115, top);
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x + 115, top);
    ctx.stroke();
    ctx.setLineDash([]);

    // Earth worldline
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x, top + 8);
    ctx.stroke();
    ctx.fillStyle = '#7dd3fc';
    ctx.fillText('Earth', origin.x + 8, top + 24);

    // Ship worldline: x = beta * ct
    const beta = Math.max(0.02, this.state.beta);
    const yTop = top + 8;
    const dy = origin.y - yTop;
    const xTop = origin.x + beta * 115;
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(xTop, yTop);
    ctx.stroke();
    ctx.fillStyle = '#facc15';
    ctx.fillText(`Ship β=${this.state.beta.toFixed(2)}`, Math.min(xTop + 6, w - 100), yTop + 18);

    // Event marker current progress
    const progress = Math.min(1, this.state.earthTime / 4.24);
    const eventY = origin.y - dy * progress;
    const eventX = origin.x + beta * 115 * progress;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eventX, eventY, 5, 0, Math.PI * 2);
    ctx.fill();

    // simultaneity cue, educational not exact Lorentz transform
    ctx.strokeStyle = this.state.frame === 'ship' ? '#facc15' : '#7dd3fc';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    if (this.state.frame === 'ship') {
      ctx.moveTo(60, eventY + beta * 35);
      ctx.lineTo(w - 60, eventY - beta * 35);
    } else {
      ctx.moveTo(60, eventY);
      ctx.lineTo(w - 60, eventY);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#d7e4ff';
    ctx.font = '12px sans-serif';
    ctx.fillText(this.state.frame === 'ship' ? 'ship-frame simultaneity cue' : 'earth-frame simultaneity cue', 16, h - 12);
  }
}
