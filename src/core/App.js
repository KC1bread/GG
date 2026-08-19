import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

import { PanelManager } from '../ui/PanelManager.js';
import { DataLogger } from '../ui/DataLogger.js';
import { Hud } from '../ui/Hud.js';
import { ControlPanel } from '../ui/ControlPanel.js';
import { MeasurementPreview } from '../ui/MeasurementPreview.js';
import { StarField } from '../visual/StarField.js';
import { Spacecraft } from '../visual/Spacecraft.js';
import { CockpitInterior } from '../visual/CockpitInterior.js';
import { DualClockPanel } from '../ui/DualClockPanel.js';
import { SpacetimeDiagram } from '../visual/SpacetimeDiagram.js';
import { SpacetimeHelp } from '../ui/SpacetimeHelp.js';
import { MeasurementHelp } from '../ui/MeasurementHelp.js';
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
 * - W / ArrowUp   : move forward  (nose / velocity direction) + ignite thrust flame
 * - S / ArrowDown : move backward
 * - A / ArrowLeft : turn left  (changes heading / velocity, not look)
 * - D / ArrowRight: turn right (changes heading / velocity, not look)
 * - Q             : move up
 * - E             : move down
 * - Shift         : increase speed (beta)
 * - Ctrl          : decrease speed (beta)
 * - V             : toggle first-person / third-person view
 * - P             : toggle inspect look (pointer lock). Esc recenters.
 * - Right mouse   : hold to peek; release recenters look to heading
 * - C             : recenter look to ship heading
 * - Speed = beta (0–0.99) × maxSpeed
 *
 * Look vs motion: camera yaw/pitch is independent of ship heading.
 * Relativistic aberration / Doppler follow velocity, not look direction.
 * Camera: first-person (cockpit) and third-person chase cam.
 * Planet info: click any planet to see details.
 */
export class RelativisticVoyagerApp {
  constructor() {
    this.state = {
      beta: 0,
      frame: 'earth',
      viewMode: 'measured',
      effectMode: 'teaching',
      terrellMode: 'precise',   // 'lorentzOnly' | 'precise' | 'enhanced'
      viewPerspective: 'thirdPerson',
      highSpeedEffectsGuideEnabled: false,
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

    // Free-look state — independent of heading / velocity
    this.freeLookYaw = 0;          // horizontal angle offset from ship heading
    this.freeLookPitch = 0;        // vertical angle (-π/2 … π/2)
    this._freeLookActive = false;  // right mouse button held
    this._freeLookToggled = false; // P-key toggle — persists until pressed again
    this._lookReturning = false;   // lerp look back to heading after peek
    this._mouseSensitivity = 0.004;
    this._shipForward = new THREE.Vector3(0, 0, -1);
    this._lookDir = new THREE.Vector3(0, 0, -1);
    this._lookAtPoint = new THREE.Vector3();
    this._velView = new THREE.Vector3();
    this.cockpitRig = null;

    // Raycaster for planet click detection
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this._smoothCamPos = new THREE.Vector3();
    this.clock = new THREE.Clock();

    // Terrell 临时对象复用（避免每帧 GC 分配）
    this._terrellVelocityDir = new THREE.Vector3();
    this._terrellPlanetPos = new THREE.Vector3();
    this._terrellViewDir = new THREE.Vector3();
    this._terrellActive = undefined; // undefined | true | false（β 跨阈值状态）
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
    this.starField = new StarField({ count: 72000, radius: 3000 });
    this.starField.addTo(this.scene);

    // Spacecraft — scaled down 10× (0.12 vs original 1.2)
    this.spacecraft = new Spacecraft();
    this.spacecraft.group.scale.setScalar(0.12);
    this.spacecraft.addTo(this.scene);
    this.spacecraft.setWorldPosition(
      this.shipPosition.x, this.shipPosition.y, this.shipPosition.z
    );

    // Cockpit interior — locked to ship heading, not camera look
    this.cockpitRig = new THREE.Group();
    this.scene.add(this.cockpitRig);
    this.cockpit = new CockpitInterior();
    this.cockpit.attachTo(this.cockpitRig);
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

    this.spacetimeDiagram = new SpacetimeDiagram(this.state);
    this.comparisonEarthSpacetime = null;
    this.comparisonShipSpacetime  = null;

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
      mode: document.getElementById('rod-panel-mode'),
      parallelCurrent: document.getElementById('rod-panel-parallel-current'),
      perpendicularCurrent: document.getElementById('rod-panel-perpendicular-current')
    };

    // ── 双测量尺交互式概念解说（点击杆/标签弹卡，仅单模式） ──
    this.measurementHelp = new MeasurementHelp();
    this.measurementHelp.init();
    if (this.measurementPreviewCanvas && this.measurementPreview) {
      this.measurementHelp.attachPreview(this.measurementPreviewCanvas, this.measurementPreview);
    }

    // ── 并列对比面板（sideBySide 模式） ──
    this.comparisonEarthCanvas = document.getElementById('comparison-earth-canvas');
    this.comparisonShipCanvas  = document.getElementById('comparison-ship-canvas');
    if (this.comparisonEarthCanvas && this.comparisonShipCanvas) {
      this.comparisonEarthPreview = new MeasurementPreview(this.comparisonEarthCanvas);
      this.comparisonShipPreview  = new MeasurementPreview(this.comparisonShipCanvas);
    }
    this.comparisonEls = {
      modeEarth:     document.getElementById('comp-mode-earth'),
      modeShip:      document.getElementById('comp-mode-ship'),
      parallelEarth: document.getElementById('comp-parallel-earth'),
      perpEarth:     document.getElementById('comp-perp-earth'),
      parallelShip:  document.getElementById('comp-parallel-ship'),
      perpShip:      document.getElementById('comp-perp-ship'),
    };

    // Bottom-bar based panel management (v2)
    this.panelManager = new PanelManager();
    this.panelManager.init();

    // ── 时空图交互式概念说明（ⓘ + 图例点击） ──
    this.spacetimeHelp = new SpacetimeHelp(this.state);
    this.spacetimeHelp.init();
    if (this.spacetimeDiagram && this.spacetimeDiagram.canvas) {
      this.spacetimeDiagram.canvas.addEventListener('click', (e) => {
        this.spacetimeHelp?.onDiagramClick(e, this.spacetimeDiagram);
      });
    }

    // 飞船控制面板标题旁添加状态栏切换按钮
    const cpBtnGroup = document.querySelector('#control-panel .panel-titlebar-btns');
    if (cpBtnGroup) {
      const toggleBadgeBtn = document.createElement('button');
      toggleBadgeBtn.className = 'panel-action-btn';
      toggleBadgeBtn.textContent = '●';
      toggleBadgeBtn.title = '切换顶部信息状态栏';
      toggleBadgeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const badge = document.getElementById('mode-badge');
        if (badge) badge.classList.toggle('hidden');
      });
      cpBtnGroup.insertBefore(toggleBadgeBtn, cpBtnGroup.firstChild);
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
    this.highSpeedEffectsGuideEl = document.getElementById('high-speed-effects-guide');
    this.highSpeedGuideReadouts = {
      beta: document.getElementById('high-speed-guide-beta'),
      gamma: document.getElementById('high-speed-guide-gamma'),
      shift: document.getElementById('high-speed-guide-shift'),
      effect: document.getElementById('high-speed-guide-effect')
    };
    this.lookHeadingHud = {
      root: document.getElementById('crosshair'),
      marker: document.getElementById('heading-marker'),
      edge: document.getElementById('heading-edge'),
      edgeArrow: document.querySelector('#heading-edge .heading-edge-arrow'),
      edgeLabel: document.querySelector('#heading-edge .heading-edge-label'),
      hint: document.getElementById('look-offset-hint')
    };

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

    if (key === 't' || key === 'T') {
      if (pressed && !this.keys.ctrl) {
        const next = this.state.effectMode === 'teaching' ? 'physical' : 'teaching';
        this._setEffectMode(next);
      }
      return;
    }

    if ((key === 'c' || key === 'C') && !this.keys.ctrl) {
      if (pressed) {
        this._lookReturning = false;
        this._recenterLook();
      }
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

    this._recenterLook();

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

  _setEffectMode(mode) {
    const next = mode === 'teaching' ? 'teaching' : 'physical';
    if (this.state.effectMode === next) return;
    this.state.effectMode = next;
    this.logger.log('effect_mode_change', { effectMode: next });
    this.hud?.update();
    this.panelManager?._updateCustomControlStates?.();
  }

  toggleHighSpeedEffectsGuide(forceValue) {
    const nextValue = typeof forceValue === 'boolean'
      ? forceValue
      : !this.state.highSpeedEffectsGuideEnabled;
    this.state.highSpeedEffectsGuideEnabled = nextValue;
    this.panelManager?._updateCustomControlStates?.();
    this.logger.log('high_speed_effects_guide_toggle', { enabled: nextValue });
    return nextValue;
  }

  _getShipForward(out) {
    return out.set(
      -Math.sin(this.shipHeading),
      0,
      -Math.cos(this.shipHeading)
    );
  }

  _getLookDirection(out) {
    const totalYaw = this.shipHeading + this.freeLookYaw;
    const cosPitch = Math.cos(this.freeLookPitch);
    return out.set(
      -Math.sin(totalYaw) * cosPitch,
      Math.sin(this.freeLookPitch),
      -Math.cos(totalYaw) * cosPitch
    );
  }

  _recenterLook() {
    this.freeLookYaw = 0;
    this.freeLookPitch = 0;
    this._lookReturning = false;
  }

  _toggleFreeLook() {
    this._freeLookToggled = !this._freeLookToggled;
    const canvas = this.renderer.domElement;

    if (this._freeLookToggled) {
      this._lastMouseX = undefined;
      this._lastMouseY = undefined;
      this._lookReturning = false;
      canvas.style.cursor = 'none';
      canvas.requestPointerLock?.();
      this.logger.log('freelook_toggle', { active: true });
    } else {
      this._recenterLook();
      canvas.style.cursor = '';
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock?.();
      }
      this.logger.log('freelook_toggle', { active: false });
    }
  }

  _updateLookHeadingHud() {
    const hud = this.lookHeadingHud;
    if (!hud?.root) return;

    const isFP = this.state.viewPerspective === 'firstPerson';
    hud.root.classList.toggle('hidden', !isFP);
    if (!isFP) return;

    const align = THREE.MathUtils.clamp(
      this._lookDir.dot(this._velocityForward), -1, 1
    );
    const offsetDeg = THREE.MathUtils.radToDeg(Math.acos(align));
    const offAxis = offsetDeg > 8;
    hud.root.classList.toggle('off-axis', offAxis);

    if (hud.hint) {
      hud.hint.classList.toggle('hidden', !offAxis);
      if (offAxis) {
        const deg = Math.round(offsetDeg);
        if (this._freeLookToggled) {
          hud.hint.textContent = `观察中 · 偏离航向 ${deg}° · C 或 Esc 回正`;
        } else if (this._freeLookActive) {
          hud.hint.textContent = `偏离航向 ${deg}° · 松开右键回正`;
        } else {
          hud.hint.textContent = `偏离航向 ${deg}° · C 回正`;
        }
      }
    }

    if (!hud.marker || !hud.edge) return;

    if (!offAxis) {
      hud.marker.classList.add('hidden');
      hud.edge.classList.add('hidden');
      return;
    }

    this._velView.copy(this._velocityForward)
      .transformDirection(this.camera.matrixWorldInverse);
    const inFront = this._velView.z < -0.02;
    const fov = this.camera.fov * Math.PI / 180;
    const halfH = Math.tan(fov * 0.5);
    const halfW = halfH * this.camera.aspect;
    const ndcX = inFront ? (this._velView.x / -this._velView.z) / halfW : 0;
    const ndcY = inFront ? (this._velView.y / -this._velView.z) / halfH : 0;
    const onScreen = inFront && Math.abs(ndcX) < 0.9 && Math.abs(ndcY) < 0.9;

    if (onScreen) {
      hud.marker.style.left = `${(ndcX * 0.5 + 0.5) * 100}%`;
      hud.marker.style.top = `${(-ndcY * 0.5 + 0.5) * 100}%`;
      hud.marker.classList.remove('hidden');
      hud.edge.classList.add('hidden');
      return;
    }

    hud.marker.classList.add('hidden');
    let dx = inFront ? ndcX : this._velView.x;
    let dy = inFront ? ndcY : this._velView.y;
    const mag = Math.hypot(dx, dy);
    const behind = !inFront && mag < 0.08;
    if (behind) {
      dx = 0;
      dy = -1;
    } else if (mag > 0.0001) {
      dx /= mag;
      dy /= mag;
    } else {
      dx = 0;
      dy = -1;
    }

    const margin = 56;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const x = THREE.MathUtils.clamp(w * 0.5 + dx * (w * 0.5 - margin), margin, w - margin);
    const y = THREE.MathUtils.clamp(h * 0.5 - dy * (h * 0.5 - margin), margin, h - margin);
    hud.edge.style.left = `${x}px`;
    hud.edge.style.top = `${y}px`;
    if (hud.edgeArrow) {
      const angle = Math.atan2(-dy, dx);
      hud.edgeArrow.style.transform = `rotate(${angle}rad)`;
    }
    if (hud.edgeLabel) {
      hud.edgeLabel.textContent = behind ? '航向在身后' : '航向';
    }
    hud.edge.classList.remove('hidden');
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
        this._lookReturning = false;
        this._lastMouseX = e.clientX;
        this._lastMouseY = e.clientY;
        e.preventDefault();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) {
        this._freeLookActive = false;
        if (!this._freeLookToggled) this._lookReturning = true;
      }
    });

    window.addEventListener('mousemove', (e) => {
      const locked = document.pointerLockElement === canvas;
      if (!this._freeLookToggled && !this._freeLookActive && !locked) return;

      let dx;
      let dy;
      if (locked) {
        dx = e.movementX;
        dy = e.movementY;
      } else {
        if (this._lastMouseX === undefined) {
          this._lastMouseX = e.clientX;
          this._lastMouseY = e.clientY;
          return;
        }
        dx = e.clientX - this._lastMouseX;
        dy = e.clientY - this._lastMouseY;
        this._lastMouseX = e.clientX;
        this._lastMouseY = e.clientY;
      }

      if (dx !== 0 || dy !== 0) this._lookReturning = false;

      this.freeLookYaw -= dx * this._mouseSensitivity;
      this.freeLookPitch -= dy * this._mouseSensitivity;
      this.freeLookPitch = Math.max(
        -Math.PI / 2 + 0.02,
        Math.min(Math.PI / 2 - 0.02, this.freeLookPitch)
      );
    });

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === canvas) return;
      if (!this._freeLookToggled) return;
      this._freeLookToggled = false;
      this._recenterLook();
      canvas.style.cursor = '';
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
      this.spacetimeDiagram?.resize();
      this.comparisonEarthSpacetime?.resize();
      this.comparisonShipSpacetime?.resize();
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
    this.spacetimeHelp?.onFrameChange();
    // 测量尺弹层：同步显示模式（平行尺标题颜色 黄=Measured / 蓝=Observed）
    this.measurementHelp?.setViewMode(this.state.viewMode);
    // 并列模式不启用测量尺弹层
    if (this.state.frame === 'sideBySide') {
      this.measurementHelp?.hide();
    }
    this._updateTerrellVisibility();
    this.panelManager?._updateCustomControlStates?.();
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

    if (this.measurementPanelEls.mode) this.measurementPanelEls.mode.textContent = this._modeLabel();
    this.measurementPanelEls.parallelCurrent.textContent = parallelLength.toFixed(2);
    this.measurementPanelEls.perpendicularCurrent.textContent = perpendicularLength.toFixed(2);
  }

  /** 当前显示模式 + Terrell 档位（简略文字，仅双测量尺面板使用） */
  _modeLabel() {
    if (this.state.viewMode !== 'observed') return 'Measured';
    const names = { lorentzOnly: '纯长度收缩', precise: 'P-T 精确', enhanced: '增强教学' };
    return `Observed · ${names[this.state.terrellMode] || this.state.terrellMode}`;
  }

  // ---- Terrell transform application -----------------------------------------

  _applyTerrellToScene(beta) {
    const mode = this.state.terrellMode;
    const isEarthFrame = this.state.frame === 'earth';
    const isObserved = this.state.viewMode === 'observed';
    const effectiveMode = (isObserved && isEarthFrame) ? mode : 'lorentzOnly';

    // ── β 跨阈值翻转：非活动稳态（β≈0）无需每帧重置矩阵 ──
    const terrellActive = beta >= 0.0001;
    if (!terrellActive) {
      if (this._terrellActive !== false) {
        this._terrellActive = false;
        // 从活动翻转到非活动：一次性把矩阵重置为 identity
        if (this.solarSystem && this.solarSystem.planets) {
          for (const planet of this.solarSystem.planets) {
            for (const child of planet.group.children) {
              if (child.isMesh) {
                child.matrix.identity();
                child.matrixAutoUpdate = true;
              }
            }
          }
        }
        if (this.spacecraft.terrellGroup) {
          this.spacecraft.terrellGroup.matrix.identity();
          this.spacecraft.terrellGroup.matrixAutoUpdate = true;
        }
      }
      return;
    }

    this._terrellActive = true;

    const velocityDir = this._terrellVelocityDir.set(0, 0, -1)
      .applyQuaternion(this.spacecraft.group.quaternion)
      .normalize();

    if (this.solarSystem && this.solarSystem.planets) {
      for (const planet of this.solarSystem.planets) {
        const planetWorldPos = this._terrellPlanetPos;
        planet.group.getWorldPosition(planetWorldPos);
        const viewDir = this._terrellViewDir
          .subVectors(this._smoothCamPos, planetWorldPos)
          .normalize();

        const transform = terrellTransformMatrix(
          beta, viewDir, velocityDir, effectiveMode
        );
        for (const child of planet.group.children) {
          if (child.isMesh) {
            child.updateMatrix();
            child.matrix.premultiply(transform); // 等价于 multiplyMatrices(transform, child.matrix)，省去 clone
            child.matrixAutoUpdate = false;
          }
        }
      }
    }

    if (this.state.viewPerspective === 'thirdPerson' && isEarthFrame) {
      const shipWorldPos = this._terrellPlanetPos;
      this.spacecraft.group.getWorldPosition(shipWorldPos);
      const viewDir = this._terrellViewDir
        .subVectors(this._smoothCamPos, shipWorldPos)
        .normalize();

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
    // ── TEMP 性能探测（定位卡顿根因用，测完删除） ──
    if (!this._perf) {
      this._perf = { sections: {}, frames: 0, lastLog: performance.now() };
    }
    this._perf._frameStart = performance.now();
    this._perf._markT = this._perf._frameStart;
    const _perfMark = (name) => {
      const now = performance.now();
      const d = now - this._perf._markT;
      this._perf.sections[name] = (this._perf.sections[name] || 0) + d;
      this._perf._markT = now;
    };

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

      // Velocity follows the ship's nose only. Free-look never steers.
      if (this._jumpState === 'idle') {
        this._getShipForward(this._shipForward);
        this._velocityForward.copy(this._shipForward);

        if (this.currentSpeed > 0.0001) {
          this.shipPosition.addScaledVector(this._shipForward, this.currentSpeed * dt);
        }

        if (this.keys.backward) {
          this.shipPosition.addScaledVector(this._shipForward, -this.currentSpeed * 0.6 * dt);
          this.currentSpeed = Math.max(0, this.currentSpeed - this.decelRate * 1.5 * dt);
        }
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

    _perfMark('flight');

    // Apply ship transform
    this.spacecraft.setWorldPosition(
      this.shipPosition.x, this.shipPosition.y, this.shipPosition.z
    );
    this.spacecraft.setHeading(this.shipHeading);

    // ---- Simulation time -----------------------------------------------------
    if (!this.state.paused && this.currentSpeed > 0.001) {
      this.state.earthTime +=
        dt * this.state.timeScale * Math.max(0.2, this.state.beta * 12);
      const maxTime = this.spacetimeDiagram.getMaxTime();
      if (Number.isFinite(maxTime) && this.state.earthTime >= maxTime) {
        this.state.earthTime = 0;
        this.logger.log('arrival_loop_reset', { beta: this.state.beta, gamma: r.gamma });
      }
    }

    // ---- Camera --------------------------------------------------------------
    if (
      this._lookReturning
      && !this._freeLookActive
      && !this._freeLookToggled
    ) {
      const k = 1 - Math.exp(-12 * dt);
      this.freeLookYaw += (0 - this.freeLookYaw) * k;
      this.freeLookPitch += (0 - this.freeLookPitch) * k;
      if (Math.abs(this.freeLookYaw) < 0.003 && Math.abs(this.freeLookPitch) < 0.003) {
        this._recenterLook();
      }
    }

    this._getLookDirection(this._lookDir);

    if (this.state.viewPerspective === 'firstPerson') {
      const fpOffset = this.firstPersonOffset.clone();
      fpOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.shipHeading);
      const fpCamPos = this.shipPosition.clone().add(fpOffset);

      this._smoothCamPos.lerp(fpCamPos, this.cameraLerp * 2.0);
      this.camera.position.copy(this._smoothCamPos);

      this._lookAtPoint.copy(this.camera.position).add(this._lookDir);
      this.camera.lookAt(this._lookAtPoint);
    } else {
      const totalYaw = this.shipHeading + this.freeLookYaw;
      const euler = new THREE.Euler(this.freeLookPitch, totalYaw, 0, 'YXZ');
      const rotatedOffset = this.cameraLocalOffset.clone().applyEuler(euler);
      const desiredCamPos = this.shipPosition.clone().add(rotatedOffset);

      this._smoothCamPos.lerp(desiredCamPos, this.cameraLerp);
      this.camera.position.copy(this._smoothCamPos);
      this.camera.lookAt(this.shipPosition);
    }

    if (this.cockpitRig) {
      this.cockpitRig.position.copy(this.camera.position);
      this.cockpitRig.rotation.set(0, this.shipHeading, 0);
    }
    this.camera.updateMatrixWorld();
    this._updateLookHeadingHud();

    _perfMark('camera');

    // ---- Relativistic visual effects & Post-process ----------------------------
    const b = this.state.beta;
    const lookVelAlign = THREE.MathUtils.clamp(
      this._lookDir.dot(this._velocityForward), -1, 1
    );
    // Full-screen warp/beaming is a forward-view effect. Fade it out when
    // looking sideways or backward so StarField redshift is not crushed.
    const alongVelocity = THREE.MathUtils.smoothstep(lookVelAlign, 0.15, 0.7);
    const usePostProcess = this.state.viewMode === 'observed'
      && b > 0.001
      && this.state.viewPerspective === 'firstPerson'
      && this.postProcess;

    if (this.postProcess) {
      this.postProcess.setTransition(usePostProcess ? alongVelocity : 0);
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

    const ppBlend = this.postProcess ? this.postProcess.transitionValue : 0;
    const vignette = document.getElementById('tunnel-vignette');
    if (vignette) {
      const vignetteAmount = alongVelocity * Math.min(0.92, actualBeta * 1.1);
      vignette.style.opacity = ppBlend > 0.01 ? '0' : String(vignetteAmount);
    }

    const guideStrength = (
      this.state.highSpeedEffectsGuideEnabled
      && this.state.viewPerspective === 'firstPerson'
      && this.currentSpeed > 0.001
    )
      ? THREE.MathUtils.smoothstep(actualBeta, 0.08, 0.32)
      : 0;
    const forwardShiftFactor = r.gamma * (1 + actualBeta);
    const guide = this.highSpeedEffectsGuideEl;
    if (guide) {
      guide.style.opacity = guideStrength.toFixed(3);
      guide.classList.toggle('active', guideStrength > 0.01);
      guide.classList.toggle('teach-on', this.state.effectMode === 'teaching');
    }
    if (this.highSpeedGuideReadouts.beta) {
      this.highSpeedGuideReadouts.beta.textContent = actualBeta.toFixed(3);
    }
    if (this.highSpeedGuideReadouts.gamma) {
      this.highSpeedGuideReadouts.gamma.textContent = r.gamma.toFixed(2);
    }
    if (this.highSpeedGuideReadouts.shift) {
      this.highSpeedGuideReadouts.shift.textContent = guideStrength > 0.01
        ? `${Math.max(1, forwardShiftFactor).toFixed(2)}×`
        : '1.00×';
    }
    if (this.highSpeedGuideReadouts.effect) {
      this.highSpeedGuideReadouts.effect.textContent =
        this.state.effectMode === 'teaching' ? '教学模式' : '显示模式';
    }

    // Aberration / Doppler follow velocity, not camera look.
    const visualBeta = Math.max(0.0001, actualBeta);
    this.starField.setCenter(
      this.camera.position.x,
      this.camera.position.y,
      this.camera.position.z
    );
    this.starField.setRelativisticState(visualBeta, this._velocityForward);
    this.starField.setEffectMode(this.state.effectMode);
    // =========================================================================

    _perfMark('fx');

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

    _perfMark('solar');

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
    _perfMark('preview');

    // ── 统一面板：单画布/双画布切换（双测量尺 + 时空图） ──
    const isSideBySide = this.state.frame === 'sideBySide';
    const measPanel = document.getElementById('measurement-panel');
    const measSingle = document.getElementById('measurement-single-view');
    const measDual   = document.getElementById('measurement-dual-view');
    if (measPanel)  measPanel.classList.toggle('dual', isSideBySide);
    if (measSingle) measSingle.classList.toggle('hidden', isSideBySide);
    if (measDual)   measDual.classList.toggle('hidden', !isSideBySide);

    const stPanel = document.getElementById('spacetime-panel');
    const stSingle = document.getElementById('spacetime-single-view');
    const stDual   = document.getElementById('spacetime-dual-view');
    if (stPanel)  stPanel.classList.toggle('dual', isSideBySide);
    if (stSingle) stSingle.classList.toggle('hidden', isSideBySide);
    if (stDual)   stDual.classList.toggle('hidden', !isSideBySide);

    // ── 并列对比 ──
    if (isSideBySide) {
      if (this.comparisonEarthPreview && this.comparisonShipPreview) {
        // 并列模式不能直接用 effectiveMode（它基于 state.frame='sideBySide' 恒为 lorentzOnly），
        // 需按每个画布的实际参考系单独计算：地球画布 → observed 时启用 Terrell，飞船画布 → 恒不转
        const observed = this.state.viewMode === 'observed';
        const earthRodState = {
          ...rodPhysicsState,
          frame: 'earth',
          terrellMode: observed ? this.state.terrellMode : 'lorentzOnly'
        };
        const shipRodState = { ...rodPhysicsState, frame: 'ship', terrellMode: 'lorentzOnly' };
        this.comparisonEarthPreview.update({ physicsState: earthRodState, shipPosition: this.shipPosition, visible: true });
        this.comparisonShipPreview.update({ physicsState: shipRodState, shipPosition: this.shipPosition, visible: true });

        const earthParallel = 5 * (lengthContractionRatio(this.state.beta));
        if (this.comparisonEls.modeEarth)    this.comparisonEls.modeEarth.textContent    = this._modeLabel();
        if (this.comparisonEls.modeShip)     this.comparisonEls.modeShip.textContent     = this._modeLabel();
        if (this.comparisonEls.parallelEarth) this.comparisonEls.parallelEarth.textContent = earthParallel.toFixed(2);
        if (this.comparisonEls.parallelShip)  this.comparisonEls.parallelShip.textContent  = '5.00';
        if (this.comparisonEls.perpEarth)     this.comparisonEls.perpEarth.textContent     = '5.00';
        if (this.comparisonEls.perpShip)      this.comparisonEls.perpShip.textContent      = '5.00';
      }

      // ── 侧边栏双时空图（懒加载） ──
      if (!this.comparisonEarthSpacetime) {
        const earthCanvas = document.getElementById('spacetime-earth-canvas');
        const shipCanvas  = document.getElementById('spacetime-ship-canvas');
        if (earthCanvas && shipCanvas) {
          this.comparisonEarthSpacetime = new SpacetimeDiagram(this.state, { canvas: earthCanvas, frame: 'earth' });
          this.comparisonShipSpacetime  = new SpacetimeDiagram(this.state, { canvas: shipCanvas, frame: 'ship' });
        }
      }
      this.comparisonEarthSpacetime?.update();
      this.comparisonShipSpacetime?.update();
    }

    // Cockpit interior
    this.cockpit.update(dt, this.state.beta);
    _perfMark('cockpit');

    // Engine audio
    if (this.state.paused) {
      this.engineAudio.mute();
    } else {
      this.engineAudio.update(this.currentSpeed / this.maxSpeed, this.keys.forward);
    }
    this.hud.update();
    _perfMark('hud');

    this.dualClock.update(r);
    _perfMark('clock');

    if (!isSideBySide) this.spacetimeDiagram.update();
    _perfMark('spacetime');

    _perfMark('panels');

    // ---- Final render --------------------------------------------------------
    if (this.postProcess && this.postProcess.transitionValue > 0.0005) {
      this.postProcess.render(
        b, this.camera, this.scene, this.renderer, this._velocityForward,
        this.state.effectMode === 'teaching' ? 1 : 0
      );
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    _perfMark('render');

    // ── TEMP 性能汇总（每 2s 打印一次） ──
    {
      const p = this._perf;
      p.frames++;
      p._frameMs = (p._frameMs || 0) + (performance.now() - p._frameStart);
      if (performance.now() - p.lastLog >= 2000) {
        const n = p.frames;
        const fps = (n * 1000) / (performance.now() - p.lastLog);
        const parts = Object.entries(p.sections)
          .map(([k, v]) => `${k}:${(v / n).toFixed(2)}ms`)
          .join('  ');
        console.log(`[PERF] fps=${fps.toFixed(1)}  ` + parts);
        this._perf = { sections: {}, frames: 0, lastLog: performance.now() };
      }
    }
  }
}
