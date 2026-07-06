import * as THREE from 'three';

/**
 * Spacecraft — a detailed relativistic starship model.
 *
 * Model orientation: nose faces -Z, engines face +Z.
 * Position set via setWorldPosition(), heading via setHeading().
 * Heading = Y-rotation; 0 = facing -Z (toward target star).
 *
 * Exhaust flame: animated flickering jet that ONLY appears when the ship
 * is actively thrusting forward. When idle, the flame is off.
 */
export class Spacecraft {
  constructor() {
    this.group = new THREE.Group();
    this._buildHull();
    this._buildNacelles();
    this._buildCockpit();
    this._buildEngines();
    this._buildFlame();
    this._buildParticleTrail();

    this.group.scale.setScalar(1.2);

    // Flame & animation state
    this._flameTime = 0;
    this._wasThrusting = false;
    this._currentPitchX = 0;   // smooth pitch tracking for vertical movement
  }

  // ── Main hull ──────────────────────────────────────────────────────────────

  _buildHull() {
    const hullGroup = new THREE.Group();

    const bodyGeo = new THREE.CylinderGeometry(0.16, 0.24, 1.6, 12);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xcfd8ff, roughness: 0.3, metalness: 0.4
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI / 2;

    const ridgeGeo = new THREE.BoxGeometry(0.08, 1.3, 0.06);
    const ridgeMat = new THREE.MeshStandardMaterial({
      color: 0xe8eeff, roughness: 0.25, metalness: 0.5
    });
    const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
    ridge.position.y = 0.18;

    const bellyGeo = new THREE.BoxGeometry(0.14, 1.0, 0.04);
    const belly = new THREE.Mesh(bellyGeo, ridgeMat);
    belly.position.y = -0.16;

    const noseGeo = new THREE.ConeGeometry(0.18, 0.5, 16);
    const noseMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.2, metalness: 0.3
    });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -1.05;

    // Hull panel lines
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const panelGeo = new THREE.BoxGeometry(0.005, 1.3, 0.02);
      const panelMat = new THREE.MeshBasicMaterial({ color: 0x334466 });
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.x = Math.cos(angle) * 0.17;
      panel.position.y = Math.sin(angle) * 0.17;
      hullGroup.add(panel);
    }

    hullGroup.add(body, ridge, belly, nose);
    this.hullGroup = hullGroup;
    this.group.add(hullGroup);
  }

  // ── Nacelles ───────────────────────────────────────────────────────────────

  _buildNacelles() {
    const nacelleMat = new THREE.MeshStandardMaterial({
      color: 0x9fb7ff, roughness: 0.4, metalness: 0.3
    });
    const nacelleTipMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.25, metalness: 0.4
    });

    [-1, 1].forEach((side) => {
      const nacelleGroup = new THREE.Group();
      const cylGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.9, 12);
      const cyl = new THREE.Mesh(cylGeo, nacelleMat);
      cyl.rotation.x = Math.PI / 2;
      nacelleGroup.add(cyl);

      const tipGeo = new THREE.ConeGeometry(0.07, 0.2, 12);
      const tip = new THREE.Mesh(tipGeo, nacelleTipMat);
      tip.rotation.x = -Math.PI / 2;
      tip.position.z = -0.55;
      nacelleGroup.add(tip);

      const capGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.1, 12);
      const cap = new THREE.Mesh(capGeo, nacelleMat);
      cap.rotation.x = Math.PI / 2;
      cap.position.z = 0.5;
      nacelleGroup.add(cap);

      nacelleGroup.position.set(side * 0.32, -0.06, 0.15);
      this.group.add(nacelleGroup);

      const pylonGeo = new THREE.BoxGeometry(0.03, 0.15, 0.3);
      const pylonMat = new THREE.MeshStandardMaterial({
        color: 0x8899cc, roughness: 0.35, metalness: 0.35
      });
      const pylon = new THREE.Mesh(pylonGeo, pylonMat);
      pylon.position.set(side * 0.32, -0.12, 0.15);
      this.group.add(pylon);
    });
  }

  // ── Cockpit ────────────────────────────────────────────────────────────────

  _buildCockpit() {
    const cockpitGroup = new THREE.Group();

    const windowGeo = new THREE.SphereGeometry(0.11, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x88ccff, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.55
    });
    const window = new THREE.Mesh(windowGeo, windowMat);
    window.rotation.x = -Math.PI / 2;
    window.position.y = 0.20;
    window.position.z = -0.5;

    const frameGeo = new THREE.TorusGeometry(0.11, 0.015, 8, 16);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0xccccdd, roughness: 0.3, metalness: 0.6
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.copy(window.position);
    frame.rotation.x = Math.PI / 2;

    cockpitGroup.add(window, frame);
    this.group.add(cockpitGroup);
  }

  // ── Engine nozzles ─────────────────────────────────────────────────────────

  _buildEngines() {
    const nozzleMat = new THREE.MeshStandardMaterial({
      color: 0x556688, roughness: 0.25, metalness: 0.7
    });
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x4488ff, transparent: true, opacity: 0.5
    });

    const mainNozzleGeo = new THREE.TorusGeometry(0.14, 0.04, 12, 20);
    const mainNozzle = new THREE.Mesh(mainNozzleGeo, nozzleMat);
    mainNozzle.position.z = 0.88;
    const innerGlowGeo = new THREE.TorusGeometry(0.10, 0.03, 8, 16);
    const innerGlow = new THREE.Mesh(innerGlowGeo, glowMat);
    innerGlow.position.z = 0.88;
    this.group.add(mainNozzle, innerGlow);

    [-1, 1].forEach((side) => {
      const sideNozzleGeo = new THREE.TorusGeometry(0.05, 0.02, 8, 12);
      const sideNozzle = new THREE.Mesh(sideNozzleGeo, nozzleMat);
      sideNozzle.position.set(side * 0.32, -0.06, 0.62);
      this.group.add(sideNozzle);
    });
  }

  // ── Exhaust flame (animated, thrust-only) ──────────────────────────────────

  _buildFlame() {
    // Main flame — cone shape, initially invisible
    const flameGeo = new THREE.ConeGeometry(0.16, 0.8, 16);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x66ccff, transparent: true, opacity: 0, depthWrite: false
    });
    this.mainFlame = new THREE.Mesh(flameGeo, flameMat);
    this.mainFlame.rotation.x = Math.PI / 2;
    this.mainFlame.position.z = 1.2;
    this.mainFlame.visible = false;

    // Inner bright core
    const innerFlameGeo = new THREE.ConeGeometry(0.08, 1.0, 12);
    const innerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xfff8e0, transparent: true, opacity: 0, depthWrite: false
    });
    this.innerFlame = new THREE.Mesh(innerFlameGeo, innerFlameMat);
    this.innerFlame.rotation.x = Math.PI / 2;
    this.innerFlame.position.z = 1.25;
    this.innerFlame.visible = false;

    // Outer glow layer
    const outerFlameGeo = new THREE.ConeGeometry(0.22, 1.2, 16);
    const outerFlameMat = new THREE.MeshBasicMaterial({
      color: 0x4499ff, transparent: true, opacity: 0, depthWrite: false
    });
    this.outerFlame = new THREE.Mesh(outerFlameGeo, outerFlameMat);
    this.outerFlame.rotation.x = Math.PI / 2;
    this.outerFlame.position.z = 1.3;
    this.outerFlame.visible = false;

    this.group.add(this.mainFlame, this.innerFlame, this.outerFlame);
  }

  // ── Particle trail ─────────────────────────────────────────────────────────

  _buildParticleTrail() {
    const count = 120;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 0.35;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 0.35;
      positions[i * 3 + 2] = 1.6 + Math.random() * 5.0;
      colors[i * 3] = 0.4 + Math.random() * 0.3;
      colors[i * 3 + 1] = 0.6 + Math.random() * 0.4;
      colors[i * 3 + 2] = 1.0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.04, vertexColors: true, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending
    });

    this.trailPoints = new THREE.Points(geo, mat);
    this.trailBasePositions = new Float32Array(positions);
    this.trailPoints.visible = false;
    this.group.add(this.trailPoints);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  addTo(scene) {
    scene.add(this.group);
  }

  setWorldPosition(x, y, z) {
    this.group.position.set(x, y, z);
  }

  getWorldPosition(target) {
    return target.copy(this.group.position);
  }

  setHeading(angle) {
    this.group.rotation.y = angle;
  }

  getForwardDirection(target) {
    target.set(0, 0, -1);
    target.applyQuaternion(this.group.quaternion);
    return target;
  }

  /**
   * Per-frame update: flame animation (thrust-only), trail, pitch.
   *
   * @param {number}  beta          — current speed (0–0.99), used for pitch
   * @param {boolean} isThrusting   — true when ship is actively accelerating forward
   * @param {number}  verticalInput — -1 (descending), 0 (level), +1 (ascending)
   */
  update(beta, isThrusting = false, verticalInput = 0) {
    this._flameTime += 0.016; // ~60fps step

    // Pitch — nose tilts up at high speed + vertical input tilts ship
    const verticalPitchTarget = verticalInput * 0.35;   // ±20° at full vertical
    const speedPitchTarget = -beta * 0.12;               // slight nose-up from speed
    const targetPitchX = speedPitchTarget + verticalPitchTarget;
    this._currentPitchX += (targetPitchX - this._currentPitchX) * 0.12;
    this.group.rotation.x = this._currentPitchX;

    // ── Flame animation (only when thrusting) ────────────────────────────────
    if (isThrusting) {
      // Smooth ignition
      this.mainFlame.visible = true;
      this.innerFlame.visible = true;
      this.outerFlame.visible = true;
      this.trailPoints.visible = true;

      // Flicker using multiple sine waves for organic fire look
      const f = this._flameTime;
      const flicker = 1.0
        + Math.sin(f * 18.7) * 0.15
        + Math.sin(f * 23.3 + 2.1) * 0.12
        + Math.sin(f * 31.1 + 4.5) * 0.08
        + Math.sin(f * 41.7 + 1.3) * 0.05;
      const flickerInner = 1.0
        + Math.sin(f * 15.3 + 1.5) * 0.10
        + Math.sin(f * 27.9 + 3.2) * 0.07;

      const thrustPower = 1.0; // full thrust when moving forward

      // Main flame — scale and flicker
      const mainScale = flicker * thrustPower;
      this.mainFlame.scale.set(
        1.0 + Math.sin(f * 22.0) * 0.08,
        mainScale * (0.7 + beta * 1.5),
        1.0 + Math.cos(f * 19.0) * 0.08
      );
      this.mainFlame.material.opacity = Math.min(0.7, 0.35 + mainScale * 0.5);

      // Inner flame — bright white-hot core
      const innerScale = flickerInner * thrustPower;
      this.innerFlame.scale.set(
        1.0 + Math.sin(f * 25.0) * 0.05,
        innerScale * (0.5 + beta * 1.2),
        1.0 + Math.cos(f * 21.0) * 0.05
      );
      this.innerFlame.material.opacity = Math.min(0.8, 0.4 + innerScale * 0.55);

      // Color shifts with flicker — blue to white to slight yellow
      const flickVal = flicker * 0.5 + 0.5; // 0–1
      const cr = 0.5 + flickVal * 0.5;
      const cg = 0.7 + flickVal * 0.3;
      const cb = 0.85 + (1 - flickVal) * 0.15;
      this.mainFlame.material.color.setRGB(cr, cg, cb);

      // Outer glow
      this.outerFlame.scale.set(
        1.0 + Math.sin(f * 14.0) * 0.1,
        mainScale * (0.6 + beta * 1.0),
        1.0 + Math.cos(f * 12.0) * 0.1
      );
      this.outerFlame.material.opacity = Math.min(0.35, 0.1 + mainScale * 0.35);

    } else {
      // ── Flame off ──────────────────────────────────────────────────────────
      // Quick fade-out
      const fadeSpeed = 0.15;
      this.mainFlame.material.opacity = Math.max(0,
        this.mainFlame.material.opacity - fadeSpeed);
      this.innerFlame.material.opacity = Math.max(0,
        this.innerFlame.material.opacity - fadeSpeed);
      this.outerFlame.material.opacity = Math.max(0,
        this.outerFlame.material.opacity - fadeSpeed);
      this.trailPoints.material.opacity = Math.max(0,
        this.trailPoints.material.opacity - fadeSpeed);

      if (this.mainFlame.material.opacity <= 0.01) {
        this.mainFlame.visible = false;
        this.innerFlame.visible = false;
        this.outerFlame.visible = false;
        this.trailPoints.visible = false;
      }

      // Shrink flame when fading
      this.mainFlame.scale.set(0.3, 0.3, 0.3);
      this.innerFlame.scale.set(0.2, 0.2, 0.2);
      this.outerFlame.scale.set(0.3, 0.3, 0.3);
    }

    // ── Trail particles — only active when thrusting ─────────────────────────
    if (isThrusting) {
      const posArr = this.trailPoints.geometry.attributes.position.array;
      for (let i = 0; i < posArr.length / 3; i++) {
        const t = i / (posArr.length / 3);
        const life = (this._flameTime * 0.8 + i * 0.03) % 1.5;
        posArr[i * 3 + 2] = this.trailBasePositions[i * 3 + 2] + beta * 8 * t + life * 4;
        posArr[i * 3] = this.trailBasePositions[i * 3] * (1 + beta * 1.5 * t)
          + Math.sin(life * 8 + i) * 0.08;
        posArr[i * 3 + 1] = this.trailBasePositions[i * 3 + 1] * (1 + beta * 1.5 * t)
          + Math.cos(life * 7 + i) * 0.08;
      }
      this.trailPoints.geometry.attributes.position.needsUpdate = true;
      this.trailPoints.material.opacity = Math.min(0.6, 0.2 + beta * 0.5);
    }
  }
}
