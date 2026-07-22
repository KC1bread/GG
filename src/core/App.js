import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

import { PanelManager } from '../ui/PanelManager.js';
import { DataLogger } from '../ui/DataLogger.js';
import { Hud } from '../ui/Hud.js';
import { ControlPanel } from '../ui/ControlPanel.js';
import { MissionSystem } from '../ui/MissionSystem.js';
import { ConceptPanel } from '../ui/ConceptPanel.js';
import { QuizSystem } from '../ui/QuizSystem.js';
import { MeasurementPreview } from '../ui/MeasurementPreview.js';
import { StarField } from '../visual/StarField.js';
import { Spacecraft } from '../visual/Spacecraft.js';
import { CockpitInterior } from '../visual/CockpitInterior.js';
import { DualClockPanel } from '../ui/DualClockPanel.js';
import { SpacetimeDiagram } from '../visual/SpacetimeDiagram.js';
import { SolarSystem, PLANET_INFO } from '../visual/SolarSystem.js';
import { addReferenceScene } from '../visual/SceneObjects.js';
import { EngineAudio } from '../audio/EngineAudio.js';
import { computeRelativityState, DEFAULT_TARGET_DISTANCE_LY, lengthContractionRatio } from '../physics/relativity.js';
import { terrellTransformMatrix } from '../physics/terrell.js';
import { RelativisticPostProcess } from '../visual/RelativisticPostProcess.js';

/**
 * RelativisticVoyagerApp — main application controller.
 *
 * Flight model:
 * - W / ArrowUp   : move forward  (nose direction) + ignite thrust flame
 * - S / ArrowDown : move backward
 * - A / ArrowLeft : turn left
 * - D / ArrowRight: turn right
 * - Q             : move up
 * - E             : move down
 * - Shift         : increase speed (beta)
 * - Ctrl          : decrease speed (beta)
 * - V             : toggle first-person / third-person view
 * - Speed = beta (0–0.99) × maxSpeed
 *
 * Camera: supports first-person (cockpit) and third-person chase cam.
 * Star field: rich, static, centered at origin.
 * Planet info: click any planet to see details.
 */
export class RelativisticVoyagerApp {
  constructor() {
    this.state = {
      beta: 0,
      frame: 'earth',
      viewMode: 'measured',
      terrellMode: 'precise',   // 'lorentzOnly' | 'precise' | 'enhanced'
      viewPerspective: 'thirdPerson',
      paused: false,
      earthTime: 0,
      earthDistance: DEFAULT_TARGET_DISTANCE_LY,
      timeScale: 0.025
    };

    // Ship state — starts near Mercury's orbit
    this.shipPosition = new THREE.Vector3(0, 0.5, 200);
    this.shipHeading = 0;  // Y-rotation (0 = facing -Z)

    // Camera offset in ship-local space (small — ship is scaled down 10×)
    this.cameraLocalOffset = new THREE.Vector3(0, 0.4, 1.2);

    // First-person cockpit camera offset (ship-local space, ship scale 0.12)
    this.firstPersonOffset = new THREE.Vector3(0, 0.06, -0.05);

    // Keyboard state
    this.keys = {
      forward: false, backward: false,
      left: false, right: false,
      up: false, down: false,
      shift: false, ctrl: false
    };

    // Tuning — scaled for the large (100×) solar system
    this.maxSpeed = 30;       // scene units / sec at beta=1
    this.turnRate = 1.8;      // radians / sec
    this.cameraLerp = 0.15;   // camera follow smoothness
    this.betaRampRate = 0.25; // beta units / sec when Shift/Ctrl held
    this.verticalSpeed = 8;   // scene units / sec for Q/E

    // Smooth acceleration / deceleration
    this.currentSpeed = 0;
    this.accelRate = 12;      // scene units / sec²
    this.decelRate = 16;      // scene units / sec²

    // Planet-jump state machine — keys 1-8 warp to planets
    this._jumpState = 'idle';        // 'idle' | 'accelerating' | 'cruising'
    this._jumpTargetIndex = -1;

    // Engine audio — initialised on first user interaction
    this.engineAudio = new EngineAudio();

    // Relativistic visual effects
    this.baseFov = 65;        // camera FOV at rest
    this._velocityForward = new THREE.Vector3(0, 0, -1); // ship velocity direction
    this.postProcess = null;  // relativistic full-screen shader

    // Free-look state — toggle with P key, mouse to look around
    this.freeLookYaw = 0;          // horizontal angle offset from ship heading
    this.freeLookPitch = 0;        // vertical angle (-π/2 … π/2)
    this._freeLookActive = false;  // right mouse button held
    this._freeLookToggled = false; // P-key toggle — persists until pressed again
    this._mouseSensitivity = 0.004;

    // Raycaster for planet click detection
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this._smoothCamPos = new THREE.Vector3();
    this.clock = new THREE.Clock();
  }

  // ============================================================================

  init() {
    this.logger = new DataLogger();
    this.setupThree();
    this.setupScene();
    this.setupUi();
    this.setupKeyboard();
    this.setupMouse();
    this.setupResize();
    this.logger.log('app_init');
    this.renderer.setAnimationLoop(() => this.update());
  }

  // ---- Three.js / renderer / camera ------------------------------------------

  setupThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020613);

    this.camera = new THREE.PerspectiveCamera(
      this.baseFov, window.innerWidth / window.innerHeight, 0.1, 8000
    );

    this._smoothCamPos.copy(this.shipPosition).add(this.cameraLocalOffset);
    this.camera.position.copy(this._smoothCamPos);
    this.camera.lookAt(this.shipPosition);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.xr.enabled = true;
    this.renderer.shadowMap.enabled = true;
    document.getElementById('app-root').appendChild(this.renderer.domElement);
    document.body.appendChild(VRButton.createButton(this.renderer));

    // Relativistic post-process (full-screen aberration + Doppler + beaming)
    this.postProcess = new RelativisticPostProcess();
    this.postProcess.init(this.renderer, this.camera);
  }

  // ---- Scene objects ---------------------------------------------------------

  setupScene() {
    // Solar system — Sun + 8 planets at 100× scale, static at origin
    this.solarSystem = new SolarSystem();
    this.solarSystem.addTo(this.scene);

    // Reference scene: target star + lighting (no grid, no standalone Earth)
    this.refs = addReferenceScene(this.scene);

    // Star field — 新版高性能点云星空 (支持 Shader 内实时光行差/多普勒/头灯效应)
    this.starField = new StarField({ count: 24000, radius: 3000 });
    this.starField.addTo(this.scene);

    // Spacecraft — scaled down 10× (0.12 vs original 1.2)
    this.spacecraft = new Spacecraft();
    this.spacecraft.group.scale.setScalar(0.12);
    this.spacecraft.addTo(this.scene);
    this.spacecraft.setWorldPosition(
      this.shipPosition.x, this.shipPosition.y, this.shipPosition.z
    );

    // Cockpit interior — attached to camera, shown only in first-person
    this.cockpit = new CockpitInterior();
    this.cockpit.attachTo(this.camera);
    this.cockpit.hide();
  }

  // ---- UI --------------------------------------------------------------------

  setupUi() {
    this.hud = new Hud(this.state);
    this.dualClock = new DualClockPanel(this.state);
    this.dualClock.init();
    this.controlPanel = new ControlPanel(this.state, this.logger);
    this.controlPanel.onChange = () => this.onStateChanged();
    this.controlPanel.init();

    this.missionSystem = new MissionSystem(this.state, this.logger);
    this.missionSystem.init();

    this.conceptPanel = new ConceptPanel(this.logger);
    this.conceptPanel.init();

    this.quizSystem = new QuizSystem(this.state, this.logger);
    this.quizSystem.init();

    this.spacetimeDiagram = new SpacetimeDiagram(this.state);

    // ── 双测量尺 3D 预览 ──
    this.measurementPreviewCanvas = document.getElementById('measurement-preview-canvas');
    if (this.measurementPreviewCanvas) {
      this.measurementPreview = new MeasurementPreview(this.measurementPreviewCanvas);
    }
    this.measurementResetBtn = document.getElementById('measurement-reset-btn');
    if (this.measurementResetBtn) {
      this.measurementResetBtn.addEventListener('click', () => {
        this.measurementPreview?.resetView();
        this.comparisonEarthPreview?.resetView();
        this.comparisonShipPreview?.resetView();
      });
    }
    this.measurementPanelEls = {
      parallelLabel: document.getElementById('rod-panel-parallel-label'),
      parallelBase: document.getElementById('rod-panel-parallel-base'),
      parallelCurrent: document.getElementById('rod-panel-parallel-current'),
      perpendicularLabel: document.getElementById('rod-panel-perpendicular-label'),
      perpendicularBase: document.getElementById('rod-panel-perpendicular-base'),
      perpendicularCurrent: document.getElementById('rod-panel-perpendicular-current')
    };

    // ── 并列对比面板（sideBySide 模式） ──
    this.comparisonEarthCanvas = document.getElementById('comparison-earth-canvas');
    this.comparisonShipCanvas  = document.getElementById('comparison-ship-canvas');
    if (this.comparisonEarthCanvas && this.comparisonShipCanvas) {
      this.comparisonEarthPreview = new MeasurementPreview(this.comparisonEarthCanvas);
      this.comparisonShipPreview  = new MeasurementPreview(this.comparisonShipCanvas);
    }
    this.comparisonEls = {
      parallelEarth: document.getElementById('comp-parallel-earth'),
      perpEarth:     document.getElementById('comp-perp-earth'),
      parallelShip:  document.getElementById('comp-parallel-ship'),
      perpShip:      document.getElementById('comp-perp-ship'),
    };

    // Draggable / minimizable / closable panels
    this.panelManager = new PanelManager();
    this.panelManager.init([
      '#control-panel', '#hud-panel', '#measurement-panel', '#mission-panel',
      '#concept-panel', '#quiz-panel', '#spacetime-panel', '#log-panel'
    ]);

    // Orbit speed slider
    const orbitSlider = document.getElementById('orbit-speed-slider');
    const orbitVal = document.getElementById('orbit-speed-val');
    if (orbitSlider && orbitVal) {
      orbitSlider.addEventListener('input', () => {
        const v = parseFloat(orbitSlider.value);
        this.solarSystem.orbitSpeedMultiplier = v;
        orbitVal.textContent = v.toFixed(2) + '×';
      });
    }

    // ── Terrell mode selector ──
    const terrellSelect = document.getElementById('terrell-mode-select');
    const terrellLabel = document.getElementById('terrell-mode-label');
    if (terrellSelect) {
      terrellSelect.addEventListener('change', () => {
        this.state.terrellMode = terrellSelect.value;
      });
    }
    this._terrellSelect = terrellSelect;
    this._terrellLabel = terrellLabel;

    this.onStateChanged();
  }

  // ---- Keyboard ---------------------------------------------------------------

  setupKeyboard() {
    const down = (e) => this._setKey(e.key, true);
    const up   = (e) => this._setKey(e.key, false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
  }

  _setKey(key, pressed) {
    if (pressed && !this.engineAudio.initialised) {
      this.engineAudio.init();
    }

    if (key === 'v' || key === 'V') {
      if (pressed) this._togglePerspective();
      return;
    }

    if (key === 'p' || key === 'P') {
      if (pressed) this._toggleFreeLook();
      return;
    }

    const digitKeys = ['1','2','3','4','5','6','7','8'];
    const dIdx = digitKeys.indexOf(key);
    if (dIdx !== -1 && pressed) {
      this._handlePlanetJump(dIdx);
      return;
    }

    if (key === 'ArrowUp'    || key === 'w' || key === 'W') this.keys.forward  = pressed;
    if (key === 'ArrowDown'  || key === 's' || key === 'S') this.keys.backward = pressed;
    if (key === 'ArrowLeft'  || key === 'a' || key === 'A') this.keys.left     = pressed;
    if (key === 'ArrowRight' || key === 'd' || key === 'D') this.keys.right    = pressed;
    if (key === 'q' || key === 'Q') this.keys.up   = pressed;
    if (key === 'e' || key === 'E') this.keys.down = pressed;
    if (key === 'Shift')   this.keys.shift = pressed;
    if (key === 'Control') this.keys.ctrl  = pressed;
  }

  _togglePerspective() {
    const next = this.state.viewPerspective === 'thirdPerson'
      ? 'firstPerson' : 'thirdPerson';
    this._setPerspective(next);
  }

  _setPerspective(mode) {
    if (this.state.viewPerspective === mode) return;
    this.state.viewPerspective = mode;

    const sel = document.getElementById('perspective-select');
    if (sel) sel.value = mode;

    this.freeLookYaw = 0;
    this.freeLookPitch = 0;

    if (mode === 'firstPerson') {
      this.camera.fov = 90;
      this.spacecraft.group.visible = false;
      this.cockpit.show();
    } else {
      this.camera.fov = this.baseFov;
      this.spacecraft.group.visible = true;
      this.cockpit.hide();
    }
    this.camera.updateProjectionMatrix();

    this.logger.log('perspective_change', {
      viewPerspective: mode,
      fov: this.camera.fov
    });
  }

  _toggleFreeLook() {
    this._freeLookToggled = !this._freeLookToggled;
    const canvas = this.renderer.domElement;

    if (this._freeLookToggled) {
      this._lastMouseX = undefined;
      this._lastMouseY = undefined;
      canvas.style.cursor = 'move';
      this.logger.log('freelook_toggle', { active: true });
    } else {
      canvas.style.cursor = '';
      this.logger.log('freelook_toggle', { active: false });
    }
  }

  // ---- Mouse / Planet click detection ----------------------------------------

  setupMouse() {
    const canvas = this.renderer.domElement;

    canvas.addEventListener('click', (e) => {
      if (e.target.closest('.panel') || e.target.closest('.panel-dock')) return;

      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);

      const planetMeshes = this.solarSystem.planets.map(p => p.mesh);
      const intersects = this.raycaster.intersectObjects(planetMeshes);

      if (intersects.length > 0) {
        const mesh = intersects[0].object;
        const planet = this.solarSystem.planets.find(p => p.mesh === mesh);
        if (planet) {
          this._showPlanetInfo(planet.name, e.clientX, e.clientY);
        }
      } else {
        this._hidePlanetInfo();
      }
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2) {
        this._freeLookActive = true;
        this._lastMouseX = e.clientX;
        this._lastMouseY = e.clientY;
        e.preventDefault();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) {
        this._freeLookActive = false;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this._freeLookToggled && !this._freeLookActive) return;

      if (this._lastMouseX === undefined) {
        this._lastMouseX = e.clientX;
        this._lastMouseY = e.clientY;
        return;
      }

      const dx = e.clientX - this._lastMouseX;
      const dy = e.clientY - this._lastMouseY;
      this._lastMouseX = e.clientX;
      this._lastMouseY = e.clientY;

      this.freeLookYaw -= dx * this._mouseSensitivity;
      this.freeLookPitch -= dy * this._mouseSensitivity;
      this.freeLookPitch = Math.max(
        -Math.PI / 2 + 0.02,
        Math.min(Math.PI / 2 - 0.02, this.freeLookPitch)
      );
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this._hidePlanetInfo();
        if (this._freeLookToggled) this._toggleFreeLook();
      }
    });
  }

  _showPlanetInfo(name, x, y) {
    const info = PLANET_INFO[name];
    if (!info) return;

    const card = document.getElementById('planet-info-card');
    card.innerHTML = `
      <div class="planet-info-header">
        <span class="planet-info-name">${info.nameCN} ${info.nameEN}</span>
        <span class="planet-info-type">${info.type}</span>
      </div>
      <div class="planet-info-body">
        <div class="planet-info-row"><span>直径 Diameter</span><span>${info.diameter}</span></div>
        <div class="planet-info-row"><span>与太阳距离</span><span>${info.distSun}</span></div>
        <div class="planet-info-row"><span>公转周期</span><span>${info.orbitalPeriod}</span></div>
        <div class="planet-info-row"><span>温度</span><span>${info.temperature}</span></div>
        <div class="planet-info-row"><span>卫星 Moons</span><span>${info.moons}</span></div>
        <div class="planet-info-fact">💡 ${info.fact}</div>
      </div>
    `;

    const cardW = 300;
    const cardH = 260;
    let left = x + 16;
    let top = y - cardH / 2;
    if (left + cardW > window.innerWidth - 16) left = x - cardW - 16;
    if (top < 16) top = 16;
    if (top + cardH > window.innerHeight - 16) top = window.innerHeight - cardH - 16;

    card.style.left = left + 'px';
    card.style.top = top + 'px';
    card.classList.remove('hidden');
  }

  _hidePlanetInfo() {
    const card = document.getElementById('planet-info-card');
    if (card) card.classList.add('hidden');
  }

  // ---- Resize ----------------------------------------------------------------

  setupResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      if (this.postProcess) this.postProcess.setSize(window.innerWidth, window.innerHeight);
      this.dualClock.resize();
      this.measurementPreview?.resize();
      this.comparisonEarthPreview?.resize();
      this.comparisonShipPreview?.resize();
    });
  }

  // ---- State change ----------------------------------------------------------

  _syncBetaSlider() {
    const slider = document.getElementById('speed-slider');
    if (slider) {
      slider.value = String(Math.round(this.state.beta * 1000) / 1000);
    }
  }

  // ==========================================================================
  //  Planet Jump — keys 1-8 warp to planets (first-person + observed only)
  // ==========================================================================

  _handlePlanetJump(planetIndex) {
    if (this.state.viewPerspective !== 'firstPerson' || this.state.viewMode !== 'observed') {
      return;
    }
    if (this._jumpState !== 'idle') return;

    this._jumpState = 'accelerating';
    this._jumpTargetIndex = planetIndex;
  }

  _updateJump(dt) {
    if (this._jumpState === 'idle') return;

    if (this.state.viewPerspective !== 'firstPerson' || this.state.viewMode !== 'observed') {
      this._jumpState = 'idle';
      this._jumpTargetIndex = -1;
      return;
    }

    if (this._jumpState === 'accelerating') {
      this.state.beta = Math.min(0.99, this.state.beta + 0.8 * dt);
      this._syncBetaSlider();

      const targetSpeed = this.state.beta * this.maxSpeed;
      if (this.currentSpeed < targetSpeed) {
        this.currentSpeed += this.accelRate * 8 * dt;
        if (this.currentSpeed > targetSpeed) this.currentSpeed = targetSpeed;
      }

      if (this.currentSpeed >= this.maxSpeed * 0.95) {
        this._jumpState = 'cruising';
        this.freeLookYaw = 0;
        this.freeLookPitch = 0;
      }
      return;
    }

    if (this._jumpState === 'cruising') {
      const planet = this.solarSystem.planets[this._jumpTargetIndex];
      if (!planet) { this._jumpState = 'idle'; return; }

      const planetPos = planet.group.position;
      const pRadius = planet.def.radius * 100;

      let safeRadius = pRadius;
      if (planet.def.hasRings) {
        safeRadius = pRadius * 2.2;
      }
      const buffer = 15;
      const targetDist = safeRadius + buffer;

      const toPlanet = new THREE.Vector3().subVectors(planetPos, this.shipPosition);
      const dist = toPlanet.length();

      if (dist <= targetDist + 2) {
        const dir = dist > 0.001 ? toPlanet.normalize() : new THREE.Vector3(0, 0, 1);
        const targetPos = planetPos.clone().add(dir.clone().multiplyScalar(-targetDist));
        targetPos.y = Math.max(0.5, targetPos.y);
        this.shipPosition.copy(targetPos);

        const lookDir = new THREE.Vector3().subVectors(planetPos, this.shipPosition).normalize();
        this.shipHeading = Math.atan2(-lookDir.x, -lookDir.z);
        this.freeLookYaw = 0;
        this.freeLookPitch = 0;

        const fpOffset = this.firstPersonOffset.clone();
        fpOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.shipHeading);
        this._smoothCamPos.copy(this.shipPosition.clone().add(fpOffset));

        this.currentSpeed = 0;
        this.state.beta = 0;
        this._syncBetaSlider();
        this._jumpState = 'idle';
        this._jumpTargetIndex = -1;
        return;
      }

      this.state.beta = 0.99;
      this._syncBetaSlider();
      this.currentSpeed = this.state.beta * this.maxSpeed;

      const moveDir = toPlanet.normalize();
      this.shipPosition.add(moveDir.clone().multiplyScalar(this.currentSpeed * dt));

      const planetHeading = Math.atan2(-moveDir.x, -moveDir.z);
      let headingDiff = planetHeading - this.shipHeading;
      while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
      while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
      this.shipHeading += headingDiff * Math.min(1, 4 * dt);

      this._velocityForward.copy(moveDir);
    }
  }

  onStateChanged() {
    const computed = computeRelativityState(this.state);
    this.logger.log('state_snapshot', {
      beta: computed.beta, gamma: computed.gamma,
      frame: this.state.frame, viewMode: this.state.viewMode
    });
    this._updateMeasurementPanel(computed);
    this.hud.update();
    this.spacetimeDiagram.update();
    this._updateTerrellVisibility();
  }

  _updateTerrellVisibility() {
    if (!this._terrellSelect || !this._terrellLabel) return;
    const visible = this.state.viewMode === 'observed';
    this._terrellSelect.style.display = visible ? '' : 'none';
    this._terrellLabel.style.display = visible ? '' : 'none';
  }

  _updateMeasurementPanel(relativityState) {
    if (!this.measurementPanelEls) return;

    const previewInfo = this.measurementPreview?.getInfo();
    const parallelLength = previewInfo?.parallel?.currentLength
      ?? 5 * (relativityState?.lengthRatio ?? 1);
    const perpendicularLength = previewInfo?.perpendicular?.currentLength ?? 5;
    const modeLabel = this.state.viewMode === 'measured' ? '测量模式' : '观察模式';
    this.measurementPanelEls.parallelLabel.textContent = `平行于运动方向 · ${modeLabel}`;
    this.measurementPanelEls.parallelBase.textContent = '5.00';
    this.measurementPanelEls.parallelCurrent.textContent = parallelLength.toFixed(2);
    this.measurementPanelEls.perpendicularLabel.textContent = '垂直于运动方向';
    this.measurementPanelEls.perpendicularBase.textContent = '5.00';
    this.measurementPanelEls.perpendicularCurrent.textContent = perpendicularLength.toFixed(2);
  }

  // ---- Terrell transform application -----------------------------------------

  _applyTerrellToScene(beta) {
    const mode = this.state.terrellMode;
    const isEarthFrame = this.state.frame === 'earth';
    const isObserved = this.state.viewMode === 'observed';
    const effectiveMode = (isObserved && isEarthFrame) ? mode : 'lorentzOnly';

    const velocityDir = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(this.spacecraft.group.quaternion)
      .normalize();

    if (this.solarSystem && this.solarSystem.planets) {
      for (const planet of this.solarSystem.planets) {
        const planetWorldPos = new THREE.Vector3();
        planet.group.getWorldPosition(planetWorldPos);
        const viewDir = this._smoothCamPos.clone().sub(planetWorldPos).normalize();

        if (beta < 0.0001) {
          planet.group.children.forEach(child => {
            if (child.isMesh) {
              child.matrix.identity();
              child.matrixAutoUpdate = true;
            }
          });
        } else {
          const transform = terrellTransformMatrix(
            beta, viewDir, velocityDir, effectiveMode
          );
          planet.group.children.forEach(child => {
            if (child.isMesh) {
              child.updateMatrix();
              const local = child.matrix.clone();
              child.matrix.multiplyMatrices(transform, local);
              child.matrixAutoUpdate = false;
            }
          });
        }
      }
    }

    if (this.state.viewPerspective === 'thirdPerson' && isEarthFrame && beta >= 0.0001) {
      const shipWorldPos = new THREE.Vector3();
      this.spacecraft.group.getWorldPosition(shipWorldPos);
      const viewDir = this._smoothCamPos.clone().sub(shipWorldPos).normalize();

      const transform = terrellTransformMatrix(
        beta, viewDir, velocityDir, effectiveMode
      );

      if (this.spacecraft.terrellGroup) {
        this.spacecraft.terrellGroup.matrix.copy(transform);
        this.spacecraft.terrellGroup.matrixAutoUpdate = false;
      }
    } else if (this.spacecraft.terrellGroup) {
      this.spacecraft.terrellGroup.matrix.identity();
      this.spacecraft.terrellGroup.matrixAutoUpdate = true;
    }
  }

  // ---- Main update loop ------------------------------------------------------

  update() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const r = computeRelativityState(this.state);
    const ratio = lengthContractionRatio(this.state.beta);
    const effectiveMode = (this.state.viewMode === 'observed' && this.state.frame === 'earth')
      ? this.state.terrellMode : 'lorentzOnly';

    // ---- Keyboard flight — smooth acceleration / deceleration ----------------
    if (!this.state.paused) {
      this._updateJump(dt);

      if (this._jumpState === 'idle') {
        if (this.keys.shift) {
          this.state.beta = Math.min(0.99, this.state.beta + this.betaRampRate * dt);
          this._syncBetaSlider();
        }
        if (this.keys.ctrl) {
          this.state.beta = Math.max(0, this.state.beta - this.betaRampRate * 1.4 * dt);
          this._syncBetaSlider();
        }

        const targetSpeed = this.keys.forward ? this.state.beta * this.maxSpeed : 0;

        if (this.currentSpeed < targetSpeed) {
          this.currentSpeed += this.accelRate * dt;
          if (this.currentSpeed > targetSpeed) this.currentSpeed = targetSpeed;
        } else if (this.currentSpeed > targetSpeed) {
          this.currentSpeed -= this.decelRate * dt;
          if (this.currentSpeed < targetSpeed) this.currentSpeed = targetSpeed;
        }
        if (this.currentSpeed < 0.0005) this.currentSpeed = 0;

        if (this.keys.left)  this.shipHeading += this.turnRate * dt;
        if (this.keys.right) this.shipHeading -= this.turnRate * dt;
      }

      let forward;
      if (this.state.viewPerspective === 'firstPerson') {
        const totalYaw = this.shipHeading + this.freeLookYaw;
        const cosPitch = Math.cos(this.freeLookPitch);
        forward = new THREE.Vector3(
          -Math.sin(totalYaw) * cosPitch,
          Math.sin(this.freeLookPitch),
          -Math.cos(totalYaw) * cosPitch
        );
      } else {
        forward = new THREE.Vector3(
          -Math.sin(this.shipHeading), 0, -Math.cos(this.shipHeading)
        );
      }
      this._velocityForward.copy(forward);

      if (this._jumpState === 'idle' && this.currentSpeed > 0.0001) {
        this.shipPosition.add(forward.clone().multiplyScalar(this.currentSpeed * dt));
        if (this.state.viewPerspective === 'firstPerson') {
          this.shipHeading += this.freeLookYaw;
          this.freeLookYaw = 0;
        }
      }

      if (this._jumpState === 'idle' && this.keys.backward) {
        this.shipPosition.add(forward.clone().multiplyScalar(-this.currentSpeed * 0.6 * dt));
        this.currentSpeed = Math.max(0, this.currentSpeed - this.decelRate * 1.5 * dt);
      }

      if (this._jumpState === 'idle') {
        if (this.keys.up)   this.shipPosition.y += this.verticalSpeed * dt;
        if (this.keys.down) this.shipPosition.y -= this.verticalSpeed * dt;
      }
      this.shipPosition.y = Math.max(-115, Math.min(2000, this.shipPosition.y));

      if (this._jumpState === 'idle') {
        const shipR = 2.5;

        const sunR = 120 + shipR;
        const sunDist = this.shipPosition.length();
        if (sunDist < sunR && sunDist > 0.001) {
          this.shipPosition.normalize().multiplyScalar(sunR);
          this.currentSpeed *= 0.2;
        }

        for (const p of this.solarSystem.planets) {
          const px = p.group.position.x, pz = p.group.position.z;
          const pR = p.def.radius * 100 + shipR;
          const dx = this.shipPosition.x - px;
          const dz = this.shipPosition.z - pz;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < pR && dist > 0.001) {
            const nx = dx / dist, nz = dz / dist;
            this.shipPosition.x = px + nx * pR;
            this.shipPosition.z = pz + nz * pR;
            this.currentSpeed *= 0.3;
          }
        }
      }
    }

    // Apply ship transform
    this.spacecraft.setWorldPosition(
      this.shipPosition.x, this.shipPosition.y, this.shipPosition.z
    );
    this.spacecraft.setHeading(this.shipHeading);

    // ---- Simulation time -----------------------------------------------------
    if (!this.state.paused && this.currentSpeed > 0.001) {
      this.state.earthTime +=
        dt * this.state.timeScale * Math.max(0.2, this.state.beta * 12);
      if (this.state.earthTime > r.etaEarth && Number.isFinite(r.etaEarth)) {
        this.state.earthTime = 0;
        this.logger.log('arrival_loop_reset', { beta: this.state.beta, gamma: r.gamma });
      }
    }

    // ---- Camera --------------------------------------------------------------
    if (this.state.viewPerspective === 'firstPerson') {
      const fpOffset = this.firstPersonOffset.clone();
      fpOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.shipHeading);
      const fpCamPos = this.shipPosition.clone().add(fpOffset);

      this._smoothCamPos.lerp(fpCamPos, this.cameraLerp * 2.0);
      this.camera.position.copy(this._smoothCamPos);

      const totalYaw = this.shipHeading + this.freeLookYaw;
      const cosPitch = Math.cos(this.freeLookPitch);
      const lookDir = new THREE.Vector3(
        -Math.sin(totalYaw) * cosPitch,
        Math.sin(this.freeLookPitch),
        -Math.cos(totalYaw) * cosPitch
      );
      this.camera.lookAt(this.camera.position.clone().add(lookDir));
    } else {
      const totalYaw = this.shipHeading + this.freeLookYaw;
      const euler = new THREE.Euler(this.freeLookPitch, totalYaw, 0, 'YXZ');
      const rotatedOffset = this.cameraLocalOffset.clone().applyEuler(euler);
      const desiredCamPos = this.shipPosition.clone().add(rotatedOffset);

      this._smoothCamPos.lerp(desiredCamPos, this.cameraLerp);
      this.camera.position.copy(this._smoothCamPos);
      this.camera.lookAt(this.shipPosition);
    }

    // ---- Relativistic visual effects & Post-process ----------------------------
    const crosshair = document.getElementById('crosshair');
    if (crosshair) {
      crosshair.classList.toggle('hidden', this.state.viewPerspective !== 'firstPerson');
    }

    const b = this.state.beta;
    const usePostProcess = this.state.viewMode === 'observed'
      && b > 0.001
      && this.state.viewPerspective === 'firstPerson'
      && this.postProcess;

    if (this.postProcess) {
      this.postProcess.setTransition(usePostProcess ? 1 : 0);
      this.postProcess.updateTransition(dt);
    }

    // =========================================================================
    // 💡 核心视觉解耦计算：将实际物理速度与新版 StarField 的相对论效果绑定
    // =========================================================================
    let actualBeta = 0;
    if (this.maxSpeed > 0) {
      actualBeta = (this.currentSpeed / this.maxSpeed) * this.state.beta;
    }
    actualBeta = THREE.MathUtils.clamp(actualBeta, 0.0, 0.999);

    // 暗角（Vignette Overlay）跟着实际速度变化（若使用 PostProcess 屏效则关闭）
    const vignette = document.getElementById('tunnel-vignette');
    if (vignette) {
      vignette.style.opacity = usePostProcess ? '0' : Math.min(0.92, actualBeta * 1.1);
    }

    // 更新新版 StarField 的光行差、多普勒与头灯效应
    let visualBeta = Math.max(0.0001, actualBeta);
    const starfieldVelocityDir = this._velocityForward.clone().normalize();
    this.starField.setRelativisticState(visualBeta, starfieldVelocityDir);
    // =========================================================================

    // ---- Animate solar system -------------------------------------------------
    if (this.solarSystem) {
      this.solarSystem.update(dt);
    }

    // ── Penrose-Terrell transforms ──
    this._applyTerrellToScene(r.beta);

    // ---- Visual modules -------------------------------------------------------
    this.starField.update(dt);
    
    let verticalInput = 0;
    if (this.keys.up)   verticalInput += 1;
    if (this.keys.down) verticalInput -= 1;
    this.spacecraft.update(this.state.beta, this.keys.forward, verticalInput);

    // ── Spacecraft base scale ──
    const baseScale = 0.12;
    this.spacecraft.group.scale.setScalar(baseScale);

    // ── 双测量尺预览（右下角 3D 小窗） ──
    const rodPhysicsState = {
      beta: this.state.beta,
      lengthRatio: ratio,
      viewMode: this.state.viewMode,
      frame: this.state.frame,
      terrellMode: effectiveMode,
      visible: true
    };

    this.measurementPreview?.update({
      physicsState: rodPhysicsState,
      shipPosition: this.shipPosition,
      visible: true
    });
    this._updateMeasurementPanel(r);

    // ── 单画布 / 双画布切换 ──
    const isSideBySide = this.state.frame === 'sideBySide';
    const measPanel = document.getElementById('measurement-panel');
    const measSingle = document.getElementById('measurement-single-view');
    const measDual   = document.getElementById('measurement-dual-view');
    if (measPanel)  measPanel.classList.toggle('dual', isSideBySide);
    if (measSingle) measSingle.classList.toggle('hidden', isSideBySide);
    if (measDual)   measDual.classList.toggle('hidden', !isSideBySide);

    // ── 并列对比 ──
    if (isSideBySide) {
      if (this.comparisonEarthPreview && this.comparisonShipPreview) {
        const earthRodState = { ...rodPhysicsState, frame: 'earth' };
        const shipRodState  = { ...rodPhysicsState, frame: 'ship' };
        this.comparisonEarthPreview.update({ physicsState: earthRodState, shipPosition: this.shipPosition, visible: true });
        this.comparisonShipPreview.update({ physicsState: shipRodState, shipPosition: this.shipPosition, visible: true });

        const earthParallel = 5 * (lengthContractionRatio(this.state.beta));
        if (this.comparisonEls.parallelEarth) this.comparisonEls.parallelEarth.textContent = earthParallel.toFixed(2);
        if (this.comparisonEls.parallelShip)  this.comparisonEls.parallelShip.textContent  = '5.00';
        if (this.comparisonEls.perpEarth)     this.comparisonEls.perpEarth.textContent     = '5.00';
        if (this.comparisonEls.perpShip)      this.comparisonEls.perpShip.textContent      = '5.00';
      }
    }

    // Cockpit interior
    this.cockpit.update(dt, this.state.beta);
    
    // Engine audio
    if (this.state.paused) {
      this.engineAudio.mute();
    } else {
      this.engineAudio.update(this.currentSpeed / this.maxSpeed, this.keys.forward);
    }
    this.hud.update();
    this.dualClock.update(r);
    this.missionSystem.update();
    this.spacetimeDiagram.update();

    // ---- Final render --------------------------------------------------------
    if (usePostProcess) {
      this.postProcess.render(b, this.camera, this.scene, this.renderer, this._velocityForward);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}