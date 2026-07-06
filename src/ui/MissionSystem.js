import { missions } from '../data/missions.js';

export class MissionSystem {
  constructor(state, logger) {
    this.state = state;
    this.logger = logger;
    this.index = 0;
    this.completed = new Set();
    this.title = document.getElementById('mission-title');
    this.description = document.getElementById('mission-description');
    this.progressBar = document.querySelector('#mission-progress span');
    this.nextBtn = document.getElementById('next-mission-btn');
  }

  init() {
    this.nextBtn.addEventListener('click', () => {
      this.index = (this.index + 1) % missions.length;
      this.logger.log('mission_next', { missionId: this.current().id });
      this.render();
    });
    this.render();
  }

  current() {
    return missions[this.index];
  }

  evaluate() {
    const m = this.current();
    let score = 0;
    if (typeof m.targetBeta === 'number') {
      const delta = Math.abs(this.state.beta - m.targetBeta);
      score += Math.max(0, 1 - delta / (m.tolerance * 4));
    } else {
      score += 0.5;
    }
    if (m.requiredMode) score += this.state.viewMode === m.requiredMode ? 1 : 0;
    if (m.requiredFrame) score += this.state.frame === m.requiredFrame ? 1 : 0;

    const maxScore = 1 + (m.requiredMode ? 1 : 0) + (m.requiredFrame ? 1 : 0);
    const progress = Math.min(1, score / maxScore);

    if (progress >= 0.95 && !this.completed.has(m.id)) {
      this.completed.add(m.id);
      this.logger.log('mission_complete', {
        missionId: m.id,
        beta: this.state.beta,
        frame: this.state.frame,
        viewMode: this.state.viewMode
      });
    }
    return progress;
  }

  update() {
    const progress = this.evaluate();
    this.progressBar.style.width = `${Math.round(progress * 100)}%`;
    if (progress >= 0.95) {
      this.description.innerHTML = `${this.current().description}<br><strong>完成：</strong>${this.current().concept}`;
    }
  }

  render() {
    const m = this.current();
    this.title.textContent = m.title;
    this.description.textContent = m.description;
    this.progressBar.style.width = '0%';
  }
}
