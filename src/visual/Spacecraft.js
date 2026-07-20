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
    this._buildWings();
    this._buildLandingGear();
    this._buildFlame();
    this._buildParticleTrail();

    this.group.scale.setScalar(1.2);

    // Move all children into a terrellGroup so Terrell transforms compose
    // independently of the group's position/heading/scale.
    this.terrellGroup = new THREE.Group();
    this.terrellGroup.name = 'terrellGroup';
    while (this.group.children.length > 0) {
      this.terrellGroup.add(this.group.children[0]);
    }
    this.group.add(this.terrellGroup);

    // Flame & animation state
    this._flameTime = 0;
    this._wasThrusting = false;
    this._currentPitchX = 0;   // smooth pitch tracking for vertical movement
  }

  // ── Main hull ──────────────────────────────────────────────────────────────

  _buildHull() {
    const hullGroup = new THREE.Group();

    // Apollo-era warm white hull
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0xf0efe8, roughness: 0.35, metalness: 0.1
    });
    const accentOrangeMat = new THREE.MeshStandardMaterial({
      color: 0xe87830, roughness: 0.3, metalness: 0.1, emissive: 0xe87830,
      emissiveIntensity: 0.05
    });

    // Main body — more segments for smoother silhouette
    const bodyGeo = new THREE.CylinderGeometry(0.16, 0.24, 1.6, 20);
    const body = new THREE.Mesh(bodyGeo, hullMat);
    body.rotation.x = Math.PI / 2;

    // Dorsal ridge
    const ridgeGeo = new THREE.BoxGeometry(0.08, 1.3, 0.06);
    const ridge = new THREE.Mesh(ridgeGeo, hullMat);
    ridge.position.y = 0.18;

    // Belly fairing
    const bellyGeo = new THREE.BoxGeometry(0.14, 1.0, 0.04);
    const belly = new THREE.Mesh(bellyGeo, hullMat);
    belly.position.y = -0.16;

    // Nose cone — beveled, white
    const noseGeo = new THREE.ConeGeometry(0.18, 0.5, 20);
    const nose = new THREE.Mesh(noseGeo, hullMat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -1.05;

    // Heat shield ring at nose joint (copper)
    const shieldGeo = new THREE.TorusGeometry(0.175, 0.015, 8, 20);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0xc87850, roughness: 0.3, metalness: 0.8
    });
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.position.z = -0.78;
    hullGroup.add(shield);

    // Apollo orange accent band — iconic stripe
    const stripeGeo = new THREE.CylinderGeometry(0.245, 0.245, 0.05, 24);
    const stripe = new THREE.Mesh(stripeGeo, accentOrangeMat);
    stripe.rotation.x = Math.PI / 2;
    stripe.position.z = -0.35;
    hullGroup.add(stripe);

    // Hull panel lines — thin dark seams
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const panelGeo = new THREE.BoxGeometry(0.004, 1.15, 0.015);
      const panelMat = new THREE.MeshBasicMaterial({ color: 0x2a2824 });
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.x = Math.cos(angle) * 0.18;
      panel.position.y = Math.sin(angle) * 0.18;
      panel.position.z = -0.05;
      hullGroup.add(panel);
    }

    // Cargo equipment modules on hull sides
    for (let side = -1; side <= 1; side += 2) {
      const moduleGeo = new THREE.BoxGeometry(0.06, 0.08, 0.12);
      const module = new THREE.Mesh(moduleGeo, hullMat);
      module.position.set(side * 0.22, -0.04, 0.15);
      hullGroup.add(module);

      // Module trim
      const trimGeo = new THREE.BoxGeometry(0.07, 0.012, 0.015);
      const trim = new THREE.Mesh(trimGeo, accentOrangeMat);
      trim.position.set(side * 0.22, 0.01, 0.15);
      hullGroup.add(trim);
    }

    hullGroup.add(body, ridge, belly, nose);
    this.hullGroup = hullGroup;
    this.group.add(hullGroup);
  }

  // ── Nacelles ───────────────────────────────────────────────────────────────

  _buildNacelles() {
    const nacelleMat = new THREE.MeshStandardMaterial({
      color: 0xf0efe8, roughness: 0.35, metalness: 0.1
    });
    const orangeMat = new THREE.MeshStandardMaterial({
      color: 0xe87830, roughness: 0.3, metalness: 0.1
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x3a3a3e, roughness: 0.4, metalness: 0.5
    });

    [-1, 1].forEach((side) => {
      const nacelleGroup = new THREE.Group();

      // Main nacelle body
      const cylGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.9, 16);
      const cyl = new THREE.Mesh(cylGeo, nacelleMat);
      cyl.rotation.x = Math.PI / 2;
      nacelleGroup.add(cyl);

      // Nose cone (front of nacelle)
      const tipGeo = new THREE.ConeGeometry(0.07, 0.2, 16);
      const tip = new THREE.Mesh(tipGeo, darkMat);
      tip.rotation.x = -Math.PI / 2;
      tip.position.z = -0.55;
      nacelleGroup.add(tip);

      // Orange intake ring at front
      const intakeGeo = new THREE.TorusGeometry(0.065, 0.012, 8, 16);
      const intake = new THREE.Mesh(intakeGeo, orangeMat);
      intake.position.z = -0.45;
      nacelleGroup.add(intake);

      // Rear cap
      const capGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.1, 16);
      const cap = new THREE.Mesh(capGeo, darkMat);
      cap.rotation.x = Math.PI / 2;
      cap.position.z = 0.5;
      nacelleGroup.add(cap);

      nacelleGroup.position.set(side * 0.32, -0.06, 0.15);
      this.group.add(nacelleGroup);

      // Pylon connecting nacelle to hull
      const pylonGeo = new THREE.BoxGeometry(0.03, 0.15, 0.3);
      const pylonMat = new THREE.MeshStandardMaterial({
        color: 0xd0ccc4, roughness: 0.3, metalness: 0.5
      });
      const pylon = new THREE.Mesh(pylonGeo, pylonMat);
      pylon.position.set(side * 0.32, -0.12, 0.15);
      this.group.add(pylon);
    });
  }

  // ── Cockpit ────────────────────────────────────────────────────────────────

  _buildCockpit() {
    const cockpitGroup = new THREE.Group();

    // Larger window dome
    const windowGeo = new THREE.SphereGeometry(0.14, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.5);
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x88bbee, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.5
    });
    const window = new THREE.Mesh(windowGeo, windowMat);
    window.rotation.x = -Math.PI / 2;
    window.position.y = 0.20;
    window.position.z = -0.48;

    // Thicker frame ring
    const frameGeo = new THREE.TorusGeometry(0.14, 0.022, 10, 20);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0xd0ccc4, roughness: 0.25, metalness: 0.7
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.copy(window.position);
    frame.rotation.x = Math.PI / 2;

    // Cross struts on window (X pattern — retro canopy)
    const strutMat = new THREE.MeshStandardMaterial({
      color: 0x3a3a3e, roughness: 0.3, metalness: 0.5
    });
    for (let angle = 0; angle < Math.PI; angle += Math.PI / 2) {
      const strutGeo = new THREE.BoxGeometry(0.006, 0.25, 0.005);
      const strut = new THREE.Mesh(strutGeo, strutMat);
      strut.position.copy(window.position);
      strut.position.y += 0.02;
      strut.rotation.z = angle;
      cockpitGroup.add(strut);
    }

    cockpitGroup.add(window, frame);
    this.group.add(cockpitGroup);
  }

  // ── Engine nozzles ─────────────────────────────────────────────────────────

  _buildEngines() {
    const nozzleMat = new THREE.MeshStandardMaterial({
      color: 0x3a3a3e, roughness: 0.2, metalness: 0.75
    });
    const copperMat = new THREE.MeshStandardMaterial({
      color: 0xc87850, roughness: 0.3, metalness: 0.8
    });

    // Main engine bell — hexagonal nozzle
    const bellGeo = new THREE.CylinderGeometry(0.08, 0.16, 0.45, 6);
    const bell = new THREE.Mesh(bellGeo, nozzleMat);
    bell.rotation.x = Math.PI / 2;
    bell.position.z = 0.88;
    this.group.add(bell);

    // Gimbal ring
    const gimbalGeo = new THREE.TorusGeometry(0.12, 0.018, 8, 16);
    const gimbal = new THREE.Mesh(gimbalGeo, copperMat);
    gimbal.position.z = 0.68;
    this.group.add(gimbal);

    // Exposed radial pipes from hull to engine
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const pipeGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.35, 6);
      const pipe = new THREE.Mesh(pipeGeo, copperMat);
      pipe.position.set(
        Math.cos(angle) * 0.14,
        Math.sin(angle) * 0.14,
        0.55
      );
      pipe.rotation.z = Math.PI / 2;
      pipe.rotation.y = angle;
      this.group.add(pipe);
    }

    // Side nacelle nozzles
    [-1, 1].forEach((side) => {
      const sideNozzleGeo = new THREE.CylinderGeometry(0.03, 0.05, 0.15, 6);
      const sideNozzle = new THREE.Mesh(sideNozzleGeo, nozzleMat);
      sideNozzle.rotation.x = Math.PI / 2;
      sideNozzle.position.set(side * 0.32, -0.06, 0.62);
      this.group.add(sideNozzle);
    });
  }

  // ── Wings / stabilizer fins ────────────────────────────────────────────────

  _buildWings() {
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xf0efe8, roughness: 0.35, metalness: 0.1
    });
    const orangeMat = new THREE.MeshStandardMaterial({
      color: 0xe87830, roughness: 0.3, metalness: 0.1
    });

    // Top vertical stabilizer
    const topFinGeo = new THREE.BoxGeometry(0.03, 0.28, 0.40);
    const topFin = new THREE.Mesh(topFinGeo, wingMat);
    topFin.position.set(0, 0.32, 0.35);
    this.group.add(topFin);
    // Orange tip
    const topTipGeo = new THREE.BoxGeometry(0.035, 0.04, 0.06);
    const topTip = new THREE.Mesh(topTipGeo, orangeMat);
    topTip.position.set(0, 0.44, 0.35);
    this.group.add(topTip);

    // Left & right horizontal stabilizers
    [-1, 1].forEach((side) => {
      const finGeo = new THREE.BoxGeometry(0.25, 0.025, 0.18);
      const fin = new THREE.Mesh(finGeo, wingMat);
      fin.position.set(side * 0.26, -0.06, 0.45);
      fin.rotation.z = side * 0.3; // slight dihedral
      this.group.add(fin);

      // Orange tip marking
      const tipGeo = new THREE.BoxGeometry(0.04, 0.03, 0.06);
      const tip = new THREE.Mesh(tipGeo, orangeMat);
      tip.position.set(side * 0.38, -0.04, 0.45);
      tip.rotation.z = side * 0.3;
      this.group.add(tip);
    });
  }

  // ── Landing gear (retracted, visible detail) ───────────────────────────────

  _buildLandingGear() {
    const strutMat = new THREE.MeshStandardMaterial({
      color: 0xd0ccc4, roughness: 0.3, metalness: 0.6
    });
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x3a3a3e, roughness: 0.4, metalness: 0.5
    });

    // 3 landing struts folded against the belly
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + Math.PI / 6;
      const sx = Math.cos(angle) * 0.14;
      const sy = Math.sin(angle) * 0.14;

      // Strut folded against hull
      const strutGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.22, 8);
      const strut = new THREE.Mesh(strutGeo, strutMat);
      strut.position.set(sx, sy - 0.18, 0.25);
      strut.rotation.x = Math.PI / 3;
      this.group.add(strut);

      // Foot pad
      const padGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.02, 10);
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(sx, sy - 0.28, 0.32);
      this.group.add(pad);
    }
  }

  // ── Exhaust flame (animated, thrust-only) ──────────────────────────────────

  _buildFlame() {
    // Main flame — warm orange/yellow (Apollo-era chemical rocket)
    const flameGeo = new THREE.ConeGeometry(0.16, 0.8, 16);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff9944, transparent: true, opacity: 0, depthWrite: false
    });
    this.mainFlame = new THREE.Mesh(flameGeo, flameMat);
    this.mainFlame.rotation.x = Math.PI / 2;
    this.mainFlame.position.z = 1.2;
    this.mainFlame.visible = false;

    // Inner bright white-hot core
    const innerFlameGeo = new THREE.ConeGeometry(0.08, 1.0, 12);
    const innerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xfff8e0, transparent: true, opacity: 0, depthWrite: false
    });
    this.innerFlame = new THREE.Mesh(innerFlameGeo, innerFlameMat);
    this.innerFlame.rotation.x = Math.PI / 2;
    this.innerFlame.position.z = 1.25;
    this.innerFlame.visible = false;

    // Outer glow — amber
    const outerFlameGeo = new THREE.ConeGeometry(0.22, 1.2, 16);
    const outerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xff7722, transparent: true, opacity: 0, depthWrite: false
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
      colors[i * 3] = 0.85 + Math.random() * 0.15;
      colors[i * 3 + 1] = 0.45 + Math.random() * 0.35;
      colors[i * 3 + 2] = 0.15 + Math.random() * 0.25;
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

      // Color shifts with flicker — orange to yellow to white
      const flickVal = flicker * 0.5 + 0.5; // 0–1
      const cr = 0.85 + flickVal * 0.15;
      const cg = 0.45 + flickVal * 0.45;
      const cb = 0.15 + flickVal * 0.35;
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
