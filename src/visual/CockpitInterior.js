import * as THREE from 'three';

/**
 * CockpitInterior — spacecraft cockpit interior shown in first-person view.
 *
 * Designed to be a child of the camera, so all positions are in camera-local
 * space: forward = -Z, up = +Y, right = +X.
 *
 * Elements:
 *  - Canopy frame (structural struts forming the window frame)
 *  - Dashboard / console with sci-fi details
 *  - Side pillars
 *  - Overhead panel
 *  - Subtle ambient glow from instruments
 */

// Apollo-era retro-futuristic colour palette
const FRAME_WHITE    = 0xf0efe8;  // warm off-white (capsule interior)
const PANEL_GREY     = 0x3a3e44;  // dark grey console panels
const ACCENT_ORANGE  = 0xe87830;  // Apollo burnt orange
const ACCENT_RED     = 0xcc3333;  // warning indicators
const ACCENT_GREEN   = 0x44cc88;  // nominal status
const ACCENT_BLUE    = 0x5599cc;  // nav displays
const COPPER_PIPE    = 0xc87850;  // exposed copper piping
const SILVER_TRIM    = 0xb8b8c0;  // metal edges & fasteners
const BLACK          = 0x111118;  // instrument faces
const GLOW_WARM      = 0x664422;  // incandescent instrument glow

export class CockpitInterior {
  constructor() {
    this.group = new THREE.Group();
    this._buildCanopyFrame();
    this._buildDashboard();
    this._buildSidePillars();
    this._buildOverheadPanel();
    this._buildExposedPipes();
    this._buildInstrumentGlow();
    this._buildHudReticle();
  }

  // ── Canopy window frame ────────────────────────────────────────────────────

  _buildCanopyFrame() {
    const frameMat = new THREE.MeshStandardMaterial({
      color: FRAME_WHITE, roughness: 0.35, metalness: 0.1
    });
    const orangeMat = new THREE.MeshStandardMaterial({
      color: ACCENT_ORANGE, roughness: 0.3, metalness: 0.1, emissive: ACCENT_ORANGE,
      emissiveIntensity: 0.08
    });

    // Top arch beam — chunkier, white
    const topBeamGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.80, 8);
    const topBeam = new THREE.Mesh(topBeamGeo, frameMat);
    topBeam.rotation.z = Math.PI / 2;
    topBeam.position.set(0, 0.38, -0.42);
    this.group.add(topBeam);

    // Orange accent stripe along top beam
    const stripeGeo = new THREE.CylinderGeometry(0.027, 0.027, 0.06, 8);
    const stripe = new THREE.Mesh(stripeGeo, orangeMat);
    stripe.rotation.z = Math.PI / 2;
    stripe.position.set(0, 0.39, -0.42);
    this.group.add(stripe);

    // Bottom sill — wider, white, with orange edge
    const sillGeo = new THREE.BoxGeometry(0.70, 0.04, 0.06);
    const sill = new THREE.Mesh(sillGeo, frameMat);
    sill.position.set(0, -0.28, -0.38);
    this.group.add(sill);

    // Orange trim strip on sill
    const sillTrimGeo = new THREE.BoxGeometry(0.72, 0.012, 0.015);
    const sillTrim = new THREE.Mesh(sillTrimGeo, orangeMat);
    sillTrim.position.set(0, -0.26, -0.40);
    this.group.add(sillTrim);

    // A-pillars — chunkier, white
    this._addStrut(-0.32, -0.27, -0.38, -0.37, 0.36, -0.44, frameMat, 0.024);
    this._addStrut(0.32, -0.27, -0.38, 0.37, 0.36, -0.44, frameMat, 0.024);

    // Rivets along top beam
    const rivetGeo = new THREE.SphereGeometry(0.005, 4, 4);
    const rivetMat = new THREE.MeshStandardMaterial({
      color: SILVER_TRIM, roughness: 0.2, metalness: 0.8
    });
    for (let i = 0; i < 6; i++) {
      const rivet = new THREE.Mesh(rivetGeo, rivetMat);
      rivet.position.set(-0.30 + i * 0.12, 0.39, -0.42);
      this.group.add(rivet);
    }

    // Nose cone hint — now white (matches redesigned ship)
    const noseGeo = new THREE.ConeGeometry(0.05, 0.15, 8);
    const noseMat = new THREE.MeshStandardMaterial({
      color: FRAME_WHITE, roughness: 0.4, metalness: 0.15
    });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, -0.30, -0.55);
    this.group.add(nose);
  }

  /** Helper: add a cylindrical strut between two points */
  _addStrut(x1, y1, z1, x2, y2, z2, material, radius = 0.018) {
    const start = new THREE.Vector3(x1, y1, z1);
    const end = new THREE.Vector3(x2, y2, z2);
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(end, start);
    const length = dir.length();

    const geo = new THREE.CylinderGeometry(radius, radius, length, 6);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.copy(mid);

    // Align cylinder (Y-axis) to direction vector
    const quat = new THREE.Quaternion();
    quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.setRotationFromQuaternion(quat);

    this.group.add(mesh);
  }

  // ── Dashboard / console ────────────────────────────────────────────────────

  _buildDashboard() {
    const panelMat = new THREE.MeshStandardMaterial({
      color: PANEL_GREY, roughness: 0.55, metalness: 0.25
    });
    const orangeMat = new THREE.MeshStandardMaterial({
      color: ACCENT_ORANGE, roughness: 0.3, metalness: 0.1
    });
    const silverMat = new THREE.MeshStandardMaterial({
      color: SILVER_TRIM, roughness: 0.25, metalness: 0.7
    });
    const blackMat = new THREE.MeshStandardMaterial({
      color: BLACK, roughness: 0.5, metalness: 0.1
    });

    // Main console — chunky, thick panel
    const consoleGeo = new THREE.BoxGeometry(0.56, 0.10, 0.18);
    const console = new THREE.Mesh(consoleGeo, panelMat);
    console.position.set(0, -0.32, -0.30);
    console.rotation.x = -0.35;
    this.group.add(console);

    // Orange edge trim — top and bottom of console
    const trimTopGeo = new THREE.BoxGeometry(0.58, 0.012, 0.02);
    const trimTop = new THREE.Mesh(trimTopGeo, orangeMat);
    trimTop.position.set(0, -0.27, -0.32);
    trimTop.rotation.x = -0.35;
    this.group.add(trimTop);

    // ---- Analog instrument clusters (3 circular dials) ----
    const dialPositions = [-0.16, 0, 0.16];
    for (const dx of dialPositions) {
      // Dial bezel ring
      const bezelGeo = new THREE.TorusGeometry(0.035, 0.008, 6, 16);
      const bezel = new THREE.Mesh(bezelGeo, silverMat);
      bezel.position.set(dx, -0.275, -0.35);
      bezel.rotation.x = -0.35;
      this.group.add(bezel);

      // Dial face (dark circle)
      const faceGeo = new THREE.CylinderGeometry(0.030, 0.030, 0.004, 16);
      const face = new THREE.Mesh(faceGeo, blackMat);
      face.position.set(dx, -0.274, -0.355);
      face.rotation.x = -0.35;
      this.group.add(face);

      // Dial needle (thin orange line)
      const needleGeo = new THREE.BoxGeometry(0.003, 0.025, 0.002);
      const needle = new THREE.Mesh(needleGeo, orangeMat);
      needle.position.set(dx, -0.272, -0.357);
      needle.rotation.x = -0.35;
      needle.rotation.z = (Math.random() - 0.5) * 0.8; // random starting angle
      this.group.add(needle);
    }

    // ---- Throttle quadrant (left side) ----
    const throttleBaseGeo = new THREE.BoxGeometry(0.04, 0.07, 0.04);
    const throttleBase = new THREE.Mesh(throttleBaseGeo, panelMat);
    throttleBase.position.set(-0.23, -0.29, -0.28);
    throttleBase.rotation.x = -0.35;
    this.group.add(throttleBase);

    const leverGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.06, 6);
    const lever = new THREE.Mesh(leverGeo, silverMat);
    lever.position.set(-0.23, -0.27, -0.28);
    lever.rotation.x = -0.35 + 0.3; // tilted forward
    this.group.add(lever);

    const knobGeo = new THREE.SphereGeometry(0.01, 6, 6);
    const knob = new THREE.Mesh(knobGeo, orangeMat);
    knob.position.set(-0.23, -0.24, -0.28);
    this.group.add(knob);

    // ---- Toggle switches row ----
    for (let i = 0; i < 5; i++) {
      const sx = -0.12 + i * 0.06;
      const switchBaseGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.018, 6);
      const sw = new THREE.Mesh(switchBaseGeo, silverMat);
      sw.position.set(sx, -0.266, -0.345);
      sw.rotation.x = -0.35 + (Math.random() - 0.5) * 0.3;
      this.group.add(sw);
    }

    // ---- Apollo-style pushbutton indicators ----
    const indicators = [
      { x: -0.17, color: ACCENT_GREEN },
      { x: -0.08, color: ACCENT_ORANGE },
      { x: 0.0, color: ACCENT_BLUE },
      { x: 0.08, color: ACCENT_GREEN },
      { x: 0.17, color: ACCENT_RED },
    ];
    for (const ind of indicators) {
      // Bezel
      const bezelGeo = new THREE.TorusGeometry(0.009, 0.003, 4, 8);
      const bezel = new THREE.Mesh(bezelGeo, silverMat);
      bezel.position.set(ind.x, -0.265, -0.345);
      bezel.rotation.x = -0.35;
      this.group.add(bezel);
      // Lens
      const lensGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.004, 8);
      const lensMat = new THREE.MeshBasicMaterial({ color: ind.color });
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.position.set(ind.x, -0.264, -0.348);
      lens.rotation.x = -0.35;
      lens.userData.indicatorColor = ind.color;
      this.group.add(lens);
    }

    // Bottom edge trim
    const trimGeo = new THREE.BoxGeometry(0.56, 0.015, 0.03);
    const trimMat = new THREE.MeshStandardMaterial({
      color: SILVER_TRIM, roughness: 0.2, metalness: 0.8
    });
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.set(0, -0.37, -0.28);
    this.group.add(trim);
  }

  // ── Side pillars ───────────────────────────────────────────────────────────

  _buildSidePillars() {
    const pillarMat = new THREE.MeshStandardMaterial({
      color: FRAME_WHITE, roughness: 0.35, metalness: 0.1
    });
    const copperMat = new THREE.MeshStandardMaterial({
      color: COPPER_PIPE, roughness: 0.3, metalness: 0.85
    });
    const silverMat = new THREE.MeshStandardMaterial({
      color: SILVER_TRIM, roughness: 0.25, metalness: 0.7
    });
    const orangeMat = new THREE.MeshStandardMaterial({
      color: ACCENT_ORANGE, roughness: 0.3, metalness: 0.1
    });

    [-1, 1].forEach(side => {
      const sx = side * 0.36;

      // Chunky structural pillar
      const pillarGeo = new THREE.BoxGeometry(0.04, 0.44, 0.07);
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(sx, 0.04, -0.36);
      this.group.add(pillar);

      // Vertical copper pipe bundle (2 pipes per side)
      for (let p = 0; p < 2; p++) {
        const pipeGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.38, 6);
        const pipe = new THREE.Mesh(pipeGeo, copperMat);
        pipe.position.set(sx + (p === 0 ? -0.012 : 0.012), 0.04, -0.34);
        this.group.add(pipe);

        // Pipe clamp
        for (let cy = -0.12; cy <= 0.12; cy += 0.12) {
          const clampGeo = new THREE.TorusGeometry(0.011, 0.002, 4, 8);
          const clamp = new THREE.Mesh(clampGeo, silverMat);
          clamp.position.copy(pipe.position);
          clamp.position.y += cy;
          this.group.add(clamp);
        }
      }

      // Orange grab handle along inner face
      const handleGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.22, 6);
      const handle = new THREE.Mesh(handleGeo, orangeMat);
      handle.position.set(sx - side * 0.015, 0.08, -0.34);
      this.group.add(handle);

      // Side window frame edge
      const edgeMat = new THREE.MeshStandardMaterial({
        color: FRAME_WHITE, roughness: 0.35, metalness: 0.1
      });
      const vGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.32, 6);
      const vEdge = new THREE.Mesh(vGeo, edgeMat);
      vEdge.position.set(side * 0.38, 0.06, -0.40);
      this.group.add(vEdge);
    });
  }

  // ── Overhead panel ─────────────────────────────────────────────────────────

  _buildOverheadPanel() {
    const panelMat = new THREE.MeshStandardMaterial({
      color: PANEL_GREY, roughness: 0.55, metalness: 0.25
    });
    const orangeMat = new THREE.MeshStandardMaterial({
      color: ACCENT_ORANGE, roughness: 0.3, metalness: 0.1
    });
    const silverMat = new THREE.MeshStandardMaterial({
      color: SILVER_TRIM, roughness: 0.2, metalness: 0.8
    });

    // Overhead console
    const overheadGeo = new THREE.BoxGeometry(0.48, 0.04, 0.13);
    const overhead = new THREE.Mesh(overheadGeo, panelMat);
    overhead.position.set(0, 0.43, -0.34);
    this.group.add(overhead);

    // Orange trim strip along front edge
    const trimGeo = new THREE.BoxGeometry(0.50, 0.008, 0.015);
    const trim = new THREE.Mesh(trimGeo, orangeMat);
    trim.position.set(0, 0.41, -0.40);
    this.group.add(trim);

    // Circuit breaker panel — small dark rectangles with tiny switches
    for (let i = 0; i < 4; i++) {
      const bx = -0.14 + i * 0.09;
      const breakerGeo = new THREE.BoxGeometry(0.06, 0.018, 0.005);
      const breakerMat = new THREE.MeshStandardMaterial({
        color: BLACK, roughness: 0.3, metalness: 0.2
      });
      const breaker = new THREE.Mesh(breakerGeo, breakerMat);
      breaker.position.set(bx, 0.425, -0.395);
      this.group.add(breaker);

      // Tiny toggle
      const toggleGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.01, 4);
      const toggle = new THREE.Mesh(toggleGeo, silverMat);
      toggle.position.set(bx, 0.428, -0.40);
      this.group.add(toggle);
    }

    // Overhead grab handle (orange — zero-g handhold)
    const handleGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.28, 6);
    const handle = new THREE.Mesh(handleGeo, orangeMat);
    handle.position.set(0, 0.41, -0.36);
    handle.rotation.x = Math.PI / 2;
    this.group.add(handle);
  }

  // ── Instrument ambient glow ────────────────────────────────────────────────

  _buildInstrumentGlow() {
    // Warm incandescent glow on the dashboard (not cold LED blue)
    const glowGeo = new THREE.PlaneGeometry(0.46, 0.07);
    const glowMat = new THREE.MeshBasicMaterial({
      color: GLOW_WARM,
      transparent: true,
      opacity: 0.10,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.set(0, -0.30, -0.36);
    glow.rotation.x = -0.35;
    this.group.add(glow);
  }

  // ── HUD reticle (orange-tinted optical sight) ──────────────────────────────

  _buildHudReticle() {
    const retMat = new THREE.MeshBasicMaterial({
      color: ACCENT_ORANGE,
      transparent: true,
      opacity: 0.07,
      depthTest: false,
      depthWrite: false
    });

    const hGeo = new THREE.BoxGeometry(0.04, 0.0015, 0.0015);
    const hDash = new THREE.Mesh(hGeo, retMat);
    hDash.position.set(0, 0, -0.60);
    hDash.renderOrder = 999;
    hDash.material.depthTest = false;
    this.group.add(hDash);

    const vGeo = new THREE.BoxGeometry(0.0015, 0.04, 0.0015);
    const vDash = new THREE.Mesh(vGeo, retMat);
    vDash.position.set(0, 0, -0.60);
    vDash.renderOrder = 999;
    vDash.material.depthTest = false;
    this.group.add(vDash);
  }

  // ── Exposed ceiling pipes ──────────────────────────────────────────────────

  _buildExposedPipes() {
    const copperMat = new THREE.MeshStandardMaterial({
      color: COPPER_PIPE, roughness: 0.3, metalness: 0.85
    });
    const silverMat = new THREE.MeshStandardMaterial({
      color: SILVER_TRIM, roughness: 0.25, metalness: 0.7
    });

    // Horizontal ceiling pipe run — left to right across canopy top
    const ceilingPipeGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.55, 6);
    const ceilingPipe = new THREE.Mesh(ceilingPipeGeo, copperMat);
    ceilingPipe.rotation.z = Math.PI / 2;
    ceilingPipe.position.set(0, 0.44, -0.38);
    this.group.add(ceilingPipe);

    // Clamps on ceiling pipe
    for (let cx = -0.20; cx <= 0.20; cx += 0.13) {
      const clampGeo = new THREE.TorusGeometry(0.013, 0.002, 4, 8);
      const clamp = new THREE.Mesh(clampGeo, silverMat);
      clamp.position.set(cx, 0.44, -0.38);
      this.group.add(clamp);
    }

    // Small vertical feeder pipe from ceiling to overhead console
    const feederGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.06, 6);
    const feeder = new THREE.Mesh(feederGeo, copperMat);
    feeder.position.set(0, 0.42, -0.36);
    this.group.add(feeder);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Attach to the camera (adds as child so it follows the camera exactly) */
  attachTo(camera) {
    camera.add(this.group);
  }

  /** Detach from camera and optionally add to a scene */
  detachFrom(camera, scene) {
    camera.remove(this.group);
    if (scene) scene.add(this.group);
  }

  show() {
    this.group.visible = true;
  }

  hide() {
    this.group.visible = false;
  }

  /**
   * Per-frame update for animated elements (indicator light blinking, etc.)
   * @param {number} dt — delta time in seconds
   * @param {number} beta — current speed fraction (0–0.99)
   */
  update(dt, beta) {
    // Blink indicator lights at different rates
    this._blinkTime = (this._blinkTime || 0) + dt;

    for (const child of this.group.children) {
      if (child.userData.indicatorColor !== undefined) {
        const color = child.userData.indicatorColor;
        const rate = color === ACCENT_GREEN  ? 2.1 :
                     color === ACCENT_RED    ? 0.8 :
                     color === ACCENT_ORANGE ? 1.4 : 1.0;
        const val = 0.5 + 0.5 * Math.sin(this._blinkTime * rate * Math.PI * 2);
        child.material.opacity = 0.4 + val * 0.6;
        child.visible = val > 0.2;
      }
    }
  }
}
