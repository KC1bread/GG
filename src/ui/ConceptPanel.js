import { concepts } from '../data/concepts.js';

export class ConceptPanel {
  constructor(logger) {
    this.logger = logger;
    this.text = document.getElementById('concept-text');
    this.buttons = [...document.querySelectorAll('#concept-tabs [data-level]')];
    this.level = 1;
  }

  init() {
    this.buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.level = Number(btn.dataset.level);
        this.buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.logger.log('concept_level_change', { level: this.level });
        this.render();
      });
    });
    this.render();
  }

  render() {
    this.text.textContent = concepts[this.level];
  }
}
