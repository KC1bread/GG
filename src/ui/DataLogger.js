export class DataLogger {
  constructor() {
    this.sessionId = crypto?.randomUUID?.() ?? `session-${Date.now()}`;
    this.startedAt = new Date().toISOString();
    this.events = [];
  }

  log(type, payload = {}) {
    this.events.push({
      sessionId: this.sessionId,
      type,
      timestamp: new Date().toISOString(),
      t: performance.now(),
      ...payload
    });
  }

  exportJson() {
    const content = JSON.stringify({
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      exportedAt: new Date().toISOString(),
      events: this.events
    }, null, 2);
    this.download(`relativistic-voyager-${this.sessionId}.json`, content, 'application/json');
  }

  exportCsv() {
    const columns = ['sessionId', 'timestamp', 't', 'type', 'beta', 'gamma', 'frame', 'viewMode', 'missionId', 'quizId', 'answerIndex', 'isCorrect'];
    const rows = [columns.join(',')];
    for (const e of this.events) {
      rows.push(columns.map(c => JSON.stringify(e[c] ?? '')).join(','));
    }
    this.download(`relativistic-voyager-${this.sessionId}.csv`, rows.join('\n'), 'text/csv');
  }

  download(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}
