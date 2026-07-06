import { quizzes } from '../data/quizzes.js';

export class QuizSystem {
  constructor(state, logger) {
    this.state = state;
    this.logger = logger;
    this.index = 0;
    this.questionEl = document.getElementById('quiz-question');
    this.optionsEl = document.getElementById('quiz-options');
    this.feedbackEl = document.getElementById('quiz-feedback');
    this.nextBtn = document.getElementById('next-quiz-btn');
  }

  init() {
    this.nextBtn.addEventListener('click', () => {
      this.index = (this.index + 1) % quizzes.length;
      this.logger.log('quiz_next', { quizId: this.current().id });
      this.render();
    });
    this.render();
  }

  current() {
    return quizzes[this.index];
  }

  render() {
    const q = this.current();
    this.questionEl.textContent = q.question;
    this.optionsEl.innerHTML = '';
    this.feedbackEl.textContent = '';
    q.options.forEach((option, index) => {
      const btn = document.createElement('button');
      btn.textContent = option;
      btn.addEventListener('click', () => this.answer(index));
      this.optionsEl.appendChild(btn);
    });
  }

  answer(index) {
    const q = this.current();
    const isCorrect = index === q.answer;
    this.feedbackEl.textContent = `${isCorrect ? '✓ 正确。' : '✗ 需要再想想。'}${q.feedback}`;
    this.logger.log('quiz_answer', {
      quizId: q.id,
      answerIndex: index,
      isCorrect,
      beta: this.state.beta,
      frame: this.state.frame,
      viewMode: this.state.viewMode
    });
  }
}
