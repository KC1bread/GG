export class ControlPanel {
  constructor(state, logger) {
    this.state = state;
    this.logger = logger;
    this.onChange = () => {};
  }

  init() {
    this.slider = document.getElementById('speed-slider');
    this.frameSelect = document.getElementById('frame-select');
    this.viewModeSelect = document.getElementById('view-mode-select');
    this.perspectiveSelect = document.getElementById('perspective-select');
    this.resetBtn = document.getElementById('reset-btn');
    this.startBtn = document.getElementById('start-btn');

    this.startBtn.addEventListener('click', () => {
      document.getElementById('intro-panel').classList.add('hidden');
      document.getElementById('mode-badge').classList.remove('hidden');
      window.rvApp?.panelManager?.showBottomBar();
      this.logger.log('start');
    });

    this.slider.addEventListener('input', () => {
      this.state.beta = Number(this.slider.value);
      this.logger.log('speed_change', this.snapshot());
      this.onChange();
    });

    document.querySelectorAll('[data-beta]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.beta = Number(btn.dataset.beta);
        this.slider.value = String(this.state.beta);
        this.logger.log('speed_preset', this.snapshot());
        this.onChange();
      });
    });

    this.frameSelect.addEventListener('change', () => {
      this.state.frame = this.frameSelect.value;
      this.logger.log('frame_change', this.snapshot());
      this.onChange();
    });

    this.viewModeSelect.addEventListener('change', () => {
      this.state.viewMode = this.viewModeSelect.value;
      this.logger.log('view_mode_change', this.snapshot());
      this.onChange();
    });

    this.perspectiveSelect.addEventListener('change', () => {
      const mode = this.perspectiveSelect.value;
      const app = window.rvApp;
      if (app && app._setPerspective) {
        app._setPerspective(mode);
      } else {
        this.state.viewPerspective = mode;
      }
      this.logger.log('perspective_change', this.snapshot());
      this.onChange();
    });

    this.resetBtn.addEventListener('click', () => {
      this.state.beta = 0;
      this.state.earthTime = 0;
      this.slider.value = '0';
      this.logger.log('reset', this.snapshot());
      this.onChange();
    });

    document.getElementById('export-json-btn').addEventListener('click', () => this.logger.exportJson());
    document.getElementById('export-csv-btn').addEventListener('click', () => this.logger.exportCsv());
  }

  snapshot() {
    return {
      beta: this.state.beta,
      frame: this.state.frame,
      viewMode: this.state.viewMode,
      effectMode: this.state.effectMode,
      viewPerspective: this.state.viewPerspective
    };
  }
}
