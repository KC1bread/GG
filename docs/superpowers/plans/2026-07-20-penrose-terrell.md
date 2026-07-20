# Penrose-Terrell Rotation — Complete Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ad-hoc Terrell approximations across 4 modules with a unified `src/physics/terrell.js` module and three-mode UI toggle applied to all visible objects.

**Architecture:** New `terrell.js` module as single source of truth. Per-frame, App.js computes a 4×4 Terrell transform matrix for each object (planets, spacecraft, measurement rods) and applies it. Measurement rods receive their transform via MeasurementPreview. The existing post-process shader (aberration/Doppler/beaming) is unchanged and complementary.

**Tech Stack:** Three.js (Matrix4, Quaternion, Vector3, Euler), vanilla JS modules, HTML/CSS

## Global Constraints

- `beta` clamped to [0, 0.999] via `clampBeta()` from `relativity.js`
- Three modes: `'lorentzOnly'` (contraction, no rotation), `'precise'` (θ = asin(β·sin(α))), `'enhanced'` (1.5× rotation angle)
- Terrell selector visible only when `viewMode === 'observed'`
- Planet transforms applied to `planet.mesh` (NOT group — group handles orbit)
- Spacecraft transforms applied to a dedicated `terrellGroup` child of `spacecraft.group`
- Measurement rod transforms applied in MeasurementPreview, passed as quaternion to MeasurementRod
- No changes to `RelativisticPostProcess.js`, `StarField.js`, `SolarSystem.js`

---

### Task 1: Create `src/physics/terrell.js` — Unified Terrell Computation

**Files:**
- Create: `src/physics/terrell.js`

**Interfaces:**
- Consumes: `clampBeta`, `lorentzFactor` from `src/physics/relativity.js`
- Produces: `terrellTransformMatrix()`, `terrellRotation()`, `lorentzContractionScale()`, `terrellAmplification()`

- [ ] **Step 1: Write the new module**

```js
import * as THREE from 'three';
import { clampBeta, lorentzFactor } from './relativity.js';

/**
 * Amplification factor for the given Terrell mode.
 * @param {'lorentzOnly'|'precise'|'enhanced'} mode
 * @returns {number} 0, 1.0, or 1.5
 */
export function terrellAmplification(mode) {
  switch (mode) {
    case 'lorentzOnly': return 0;
    case 'enhanced':    return 1.5;
    default:            return 1.0; // 'precise' or unknown
  }
}

/**
 * Compute the Penrose-Terrell rotation angle.
 * θ = amp × asin(β · sin(α))
 *
 * @param {number} beta - v/c, clamped internally
 * @param {number} alpha - angle between viewDir and velocityDir (radians)
 * @param {'lorentzOnly'|'precise'|'enhanced'} mode
 * @returns {number} rotation angle in radians
 */
function terrellRotationAngle(beta, alpha, mode) {
  const amp = terrellAmplification(mode);
  if (amp === 0) return 0;
  return amp * Math.asin(clampBeta(beta) * Math.sin(alpha));
}

/**
 * Rotation-only component of the Penrose-Terrell effect.
 *
 * @param {number} beta - v/c
 * @param {THREE.Vector3} viewDir - normalised direction from object to camera (world space)
 * @param {THREE.Vector3} velocityDir - normalised velocity direction (world space)
 * @param {'lorentzOnly'|'precise'|'enhanced'} mode
 * @returns {{ angle: number, axis: THREE.Vector3 }}
 */
export function terrellRotation(beta, viewDir, velocityDir, mode) {
  const amp = terrellAmplification(mode);
  if (amp === 0) {
    return { angle: 0, axis: new THREE.Vector3(0, 0, 1) };
  }

  // α = angle between view direction and velocity direction
  const cosAlpha = THREE.MathUtils.clamp(viewDir.dot(velocityDir), -1, 1);
  const alpha = Math.acos(cosAlpha);

  const angle = terrellRotationAngle(beta, alpha, mode);

  // Rotation axis: viewDir × velocityDir (normalised)
  const axis = new THREE.Vector3().crossVectors(viewDir, velocityDir);
  const axisLen = axis.length();

  // Guard: if cross product ≈ 0, viewDir ∥ velocityDir → identity rotation
  if (axisLen < 1e-8) {
    return { angle: 0, axis: new THREE.Vector3(0, 0, 1) };
  }
  axis.normalize();

  return { angle, axis };
}

/**
 * Lorentz contraction scale vector.
 * Contracts along velocityDir by 1/γ.
 *
 * @param {number} beta - v/c
 * @param {THREE.Vector3} velocityDir - normalised velocity direction (world space)
 * @returns {THREE.Vector3} scale vector (not a uniform scalar — e.g. (1, 1, 1/γ) when velocity is along Z)
 */
export function lorentzContractionScale(beta, velocityDir) {
  const gamma = lorentzFactor(beta);
  const contractRatio = 1 / gamma;

  // Start with identity scale; contract along velocity direction
  const scale = new THREE.Vector3(1, 1, 1);

  // Decompose: the component along velocityDir gets contracted
  // Result = I - (1 - contractRatio) * (v ⊗ v)  where v is unit velocityDir
  // In practice for a scale vector applied before rotation:
  // We return a scale vector that, when applied as scale.set(sx, sy, sz),
  // contracts along the object's local Z axis.
  // The caller is responsible for orienting the object so its local Z
  // aligns with the velocity direction before scaling.
  //
  // Since we compose scale + rotation into a Matrix4 in terrellTransformMatrix,
  // the contraction is along velocityDir in world space, then rotated.
  // For callers using scale separately, they contract along velocityDir.
  const s = contractRatio;
  const v = velocityDir;
  scale.x = 1 - (1 - s) * v.x * v.x;
  scale.y = 1 - (1 - s) * v.y * v.y;
  scale.z = 1 - (1 - s) * v.z * v.z;

  // Off-diagonal terms handled by rotation — the scale vector above is an approximation.
  // Full accuracy requires matrix composition (see terrellTransformMatrix).
  return scale;
}

/**
 * Full 4×4 transformation matrix combining Lorentz contraction
 * and Penrose-Terrell rotation.
 *
 * Composition: first contract along velocityDir, then rotate about axis by angle.
 * World-space transform: M = R(axis, θ) · S(velocityDir, 1/γ)
 *
 * @param {number} beta - v/c, clamped to [0, 0.999]
 * @param {THREE.Vector3} viewDir - normalised direction from object to camera (world space)
 * @param {THREE.Vector3} velocityDir - normalised velocity direction (world space)
 * @param {'lorentzOnly'|'precise'|'enhanced'} mode
 * @returns {THREE.Matrix4}
 */
export function terrellTransformMatrix(beta, viewDir, velocityDir, mode) {
  const b = clampBeta(beta);
  const gamma = b > 0.0001 ? lorentzFactor(b) : 1;
  const contractRatio = 1 / gamma;

  const { angle, axis } = terrellRotation(b, viewDir, velocityDir, mode);

  // Build rotation quaternion from axis-angle
  const rotQuat = new THREE.Quaternion().setFromAxisAngle(axis, angle);

  // Build contraction matrix: scale along velocityDir
  // The scale matrix S contracts space along velocityDir by contractRatio.
  // In world coords: S = Rv · diag(1,1,contractRatio) · Rv^T
  // where Rv rotates world Z to velocityDir.
  const rotToVel = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1), velocityDir
  );
  const rotToVelInv = rotToVel.clone().invert();

  const scaleMatrix = new THREE.Matrix4();
  scaleMatrix.makeScale(1, 1, contractRatio);

  // Rv * S * Rv^T  →  scale along velocity direction in world space
  const rotToVelMat = new THREE.Matrix4().makeRotationFromQuaternion(rotToVel);
  const rotToVelInvMat = new THREE.Matrix4().makeRotationFromQuaternion(rotToVelInv);
  const contractionMat = new THREE.Matrix4()
    .multiplyMatrices(rotToVelMat, scaleMatrix)
    .multiply(rotToVelInvMat);

  // Compose: rotation · contraction
  const rotMat = new THREE.Matrix4().makeRotationFromQuaternion(rotQuat);
  const result = new THREE.Matrix4().multiplyMatrices(rotMat, contractionMat);

  return result;
}
```

- [ ] **Step 2: Verify the module loads without errors**

Run: `node -e "import('./src/physics/terrell.js').then(m => console.log(Object.keys(m)))"`
Expected: `[ 'terrellAmplification', 'terrellRotation', 'lorentzContractionScale', 'terrellTransformMatrix' ]`

- [ ] **Step 3: Commit**

```bash
git add src/physics/terrell.js
git commit -m "feat: add unified Penrose-Terrell computation module"
```

---

### Task 2: Modify `src/physics/relativity.js` — Add `terrellAngle` to State

**Files:**
- Modify: `src/physics/relativity.js:65-75`

**Interfaces:**
- Consumes: (none new — uses existing `clampBeta`)
- Produces: `computeRelativityState` now returns `terrellAngle` field

- [ ] **Step 1: Add `terrellAngle` to the return object**

Edit `src/physics/relativity.js`, replace lines 65-75 (the return statement in `computeRelativityState`):

```js
  return {
    beta,
    gamma,
    earthDistance,
    shipDistance,
    earthTime: state.earthTime,
    shipTime,
    etaEarth,
    etaShip,
    lengthRatio,
    terrellAngle: Math.asin(beta)  // baseline: maximum rotation (α = 90°)
  };
```

- [ ] **Step 2: Verify the build**

Run: `npx vite build 2>&1 | tail -5`
Expected: "built in" message, 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/physics/relativity.js
git commit -m "fix: add terrellAngle to computeRelativityState return"
```

---

### Task 3: Modify `index.html` — Add Terrell Mode Selector

**Files:**
- Modify: `index.html`

**Interfaces:**
- Produces: `<select id="terrell-mode-select">` in control panel

- [ ] **Step 1: Add the Terrell mode `<select>` below the view-mode select**

Edit `index.html`, insert after the view-mode-select block (after line 54):

```html
    <label id="terrell-mode-label">
      Terrell 效果
      <select id="terrell-mode-select">
        <option value="lorentzOnly">纯 Lorentz 收缩</option>
        <option value="precise" selected>Penrose-Terrell 精确</option>
        <option value="enhanced">增强教学</option>
      </select>
    </label>
```

- [ ] **Step 2: Verify the HTML is valid**

Run: `npx vite build 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add Terrell mode selector to control panel"
```

---

### Task 4: Modify `src/core/App.js` — State, UI Wiring, Per-Frame Terrell Application

**Files:**
- Modify: `src/core/App.js`

**Interfaces:**
- Consumes: `terrellTransformMatrix`, `terrellAmplification` from `src/physics/terrell.js`
- Consumes: `lorentzFactor` from `src/physics/relativity.js`
- Produces: `this.state.terrellMode`, per-frame Terrell application

- [ ] **Step 1: Add import for terrell.js**

Edit `src/core/App.js`, add to line 20 (after `computeRelativityState` import):

```js
import { terrellTransformMatrix, terrellAmplification } from '../physics/terrell.js';
```

- [ ] **Step 2: Add `terrellMode` to state object**

Edit `src/core/App.js`, in constructor (line 44-53), add after `viewMode` line:

```js
this.state = {
  beta: 0,
  frame: 'earth',
  viewMode: 'measured',
  terrellMode: 'precise',   // NEW: 'lorentzOnly' | 'precise' | 'enhanced'
  viewPerspective: 'thirdPerson',
  paused: false,
  earthTime: 0,
  earthDistance: DEFAULT_TARGET_DISTANCE_LY,
  timeScale: 0.025
};
```

- [ ] **Step 3: Add Terrell mode change event listener in `setupUi()`**

Edit `src/core/App.js`, add to `setupUi()` method (after line 259, before the `this.onStateChanged()` call):

```js
// ── Terrell mode selector ───────────────────────────────────────────
const terrellSelect = document.getElementById('terrell-mode-select');
const terrellLabel = document.getElementById('terrell-mode-label');
if (terrellSelect) {
  terrellSelect.addEventListener('change', () => {
    this.state.terrellMode = terrellSelect.value;
  });
}
// Store references for visibility toggle
this._terrellSelect = terrellSelect;
this._terrellLabel = terrellLabel;
```

- [ ] **Step 4: Add `_updateTerrellVisibility()` helper method**

Add this method after the existing `onStateChanged()` method (around line 662):

```js
_updateTerrellVisibility() {
  if (!this._terrellSelect || !this._terrellLabel) return;
  const visible = this.state.viewMode === 'observed';
  this._terrellSelect.style.display = visible ? '' : 'none';
  this._terrellLabel.style.display = visible ? '' : 'none';
}
```

- [ ] **Step 5: Wire `_updateTerrellVisibility()` into view mode changes**

The view mode is changed by `ControlPanel` via the `<select>` change handler. The `onStateChanged()` callback fires on every state change. Add the visibility call there.

Edit `onStateChanged()` (line 653-662), add at end:

```js
onStateChanged() {
  const computed = computeRelativityState(this.state);
  this.logger.log('state_snapshot', {
    beta: computed.beta, gamma: computed.gamma,
    frame: this.state.frame, viewMode: this.state.viewMode
  });
  this._updateMeasurementPanel(computed);
  this.hud.update();
  this.spacetimeDiagram.update();
  this._updateTerrellVisibility();  // NEW
}
```

- [ ] **Step 6: Create `_applyTerrellToScene()` method**

Add this new method. Place it before the `update()` method, after `onStateChanged()`:

```js
/**
 * Apply Penrose-Terrell transforms to all visible objects.
 * Called every frame from update().
 */
_applyTerrellToScene(beta) {
  const mode = this.state.terrellMode;
  const isEarthFrame = this.state.frame === 'earth';
  const isObserved = this.state.viewMode === 'observed';
  const effectiveMode = (isObserved && isEarthFrame) ? mode : 'lorentzOnly';

  const velocityDir = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(this.spacecraft.group.quaternion)
    .normalize();

  // ── Planets ──────────────────────────────────────────────────────
  if (this.solarSystem && this.solarSystem.planets) {
    for (const planet of this.solarSystem.planets) {
      const planetWorldPos = new THREE.Vector3();
      planet.group.getWorldPosition(planetWorldPos);
      const viewDir = this._smoothCamPos.clone().sub(planetWorldPos).normalize();

      if (beta < 0.0001) {
        // Reset: restore auto-update and identity matrix on all mesh children
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
        // Apply to all mesh children (main body, rings, atmosphere, ocean, clouds)
        // Skips sprites (labels) automatically
        planet.group.children.forEach(child => {
          if (child.isMesh) {
            child.matrix.copy(transform);
            child.matrixAutoUpdate = false;
          }
        });
      }
    }
  }

  // ── Spacecraft (third-person, Earth frame) ────────────────────────
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
    // Reset to identity when not applicable or at zero speed
    this.spacecraft.terrellGroup.matrix.identity();
    this.spacecraft.terrellGroup.matrixAutoUpdate = true;
  }
}
```

- [ ] **Step 7: Call `_applyTerrellToScene()` in `update()`**

In `update()` (after line 898 `solarSystem.update(dt)`), add:

```js
// ── Penrose-Terrell transforms ────────────────────────────────────
this._applyTerrellToScene(r.beta);
```

- [ ] **Step 8: Replace ad-hoc spacecraft contraction/rotation code**

In `update()`, replace lines 907-922 (the block starting with `// ---- Spacecraft length contraction` through the `}` closing brace at line 922) with:

```js
// ── Spacecraft base scale (applied to group, Terrell applied to terrellGroup) ──
const baseScale = 0.12;
this.spacecraft.group.scale.setScalar(baseScale);
```

Note: The `terrellGroup` receives the Terrell matrix from `_applyTerrellToScene()` above.
The `spacecraft.update()` call at line 905 still handles pitch (`rotation.x`) — but now
the Terrell rotation is on `terrellGroup`, not `group`. We need to stop `spacecraft.update()`
from setting `group.rotation.x` for relativistic pitch, OR accept that both apply.
Since `terrellGroup` is a child, its matrix is independent of `group.rotation.x`.
The speed-based pitch in `spacecraft.update()` (line 433: `speedPitchTarget = -beta * 0.12`)
is cosmetic and independent of Terrell — keep it.

- [ ] **Step 9: Remove `terrellScale` and `terrellAngle` from rod physics state — pass `terrellMode` instead**

In `update()`, replace lines 924-933 (rodPhysicsState creation) with:

```js
// ── 双测量尺预览（右下角 3D 小窗） ──
const rodPhysicsState = {
  beta: this.state.beta,
  lengthRatio: ratio,
  viewMode: this.state.viewMode,
  frame: this.state.frame,
  terrellMode: effectiveMode,  // pass effective mode for rod Terrell computation
  visible: true
};
```

- [ ] **Step 10: Verify the build**

Run: `npx vite build 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 11: Commit**

```bash
git add src/core/App.js
git commit -m "feat: add Terrell state, UI wiring, and per-frame transforms"
```

---

### Task 5: Modify `src/visual/Spacecraft.js` — Add `terrellGroup` Child

**Files:**
- Modify: `src/visual/Spacecraft.js`

**Interfaces:**
- Produces: `this.terrellGroup` — a THREE.Group child of `this.group` containing all visual meshes

- [ ] **Step 1: Create `terrellGroup` at end of constructor and reparent children**

Edit `src/visual/Spacecraft.js`, add at the END of the constructor (after line 27 `this._buildParticleTrail()` — wait, `_buildParticleTrail` is called at line 23, and `group.scale.setScalar(1.2)` is at line 25. Add new code after line 31 `this._currentPitchX = 0`):

Actually, looking at the constructor structure, the best place is after ALL `_build*` calls and `group.scale.setScalar(1.2)`, but before the state variables. Let me place it after line 25 (`this.group.scale.setScalar(1.2)`):

```js
// Move all children into a terrellGroup so Terrell transforms compose
// independently of the group's position/heading/scale.
this.terrellGroup = new THREE.Group();
this.terrellGroup.name = 'terrellGroup';
while (this.group.children.length > 0) {
  this.terrellGroup.add(this.group.children[0]);
}
this.group.add(this.terrellGroup);
```

This must go BEFORE `this._flameTime = 0` (line 28) since those property assignments don't affect the group structure.

- [ ] **Step 2: Verify `terrellGroup` references still work**

The `update()` method references `this.mainFlame`, `this.innerFlame`, etc. These were originally added to `this.group`, but now they are children of `this.terrellGroup` (which is a child of `this.group`). Since they were stored as direct properties (`this.mainFlame = new THREE.Mesh(...)`), the references still work. The `update()` method modifies material properties and scales directly on the stored references — it doesn't navigate via `this.group.children`.

Similarly, `this.hullGroup` (line 111), `this.trailPoints` (line 391) — all stored as direct properties, so reparenting doesn't break references.

Verify: `grep -n "this\.group\.\(add\|remove\|children\)" src/visual/Spacecraft.js`
Expected: Only the `_build*` methods add to `this.group`, and the constructor's `while` loop moves them all. After construction, only `addTo()` calls `scene.add(this.group)`.

- [ ] **Step 3: Verify the build**

Run: `npx vite build 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/visual/Spacecraft.js
git commit -m "feat: add terrellGroup child to spacecraft for Terrell composition"
```

---

### Task 6: Modify `src/visual/MeasurementRod.js` and `src/ui/MeasurementPreview.js` — Per-Rod Terrell via terrell.js

**Files:**
- Modify: `src/visual/MeasurementRod.js`
- Modify: `src/ui/MeasurementPreview.js`

**Interfaces:**
- Consumes (MeasurementPreview): `terrellRotation` from `src/physics/terrell.js`
- Produces (MeasurementPreview): passes `terrellQuaternion` via physicsState to MeasurementRod
- Consumes (MeasurementRod): new optional `terrellQuaternion` field in physicsState

- [ ] **Step 1: Modify `MeasurementRod.update()` — accept `terrellQuaternion`, remove old Terrell code**

Edit `src/visual/MeasurementRod.js`, replace the Terrell rotation block (lines 258-264, the `if (this.type === 'parallel')` block):

```js
    if (this.type === 'parallel') {
      this.visualGroup.scale.z = scaleRatio;
      // Terrell rotation applied via quaternion from MeasurementPreview
      if (!isShipFrame && effectiveViewMode === 'observed' && physicsState.terrellQuaternion) {
        this.visualGroup.quaternion.copy(physicsState.terrellQuaternion);
      }
    } else {
      this.labelAnchor.rotation.set(0, 0, 0);
    }
```

- [ ] **Step 2: Modify `MeasurementPreview.update()` — compute and pass Terrell quaternion**

Edit `src/ui/MeasurementPreview.js`, add import at top:

```js
import { terrellRotation } from '../physics/terrell.js';
```

Then in the `update()` method, replace the `this.parallelRod.update(...)` call (line 124) with Terrell computation:

```js
  update({ physicsState, shipPosition, visible }) {
    this.resize();

    const isVisible = visible !== false;
    this.previewRoot.visible = isVisible;

    // ── Compute Terrell rotation for the parallel rod ──────────────────
    const {
      beta = 0,
      terrellMode = 'precise',
      viewMode = 'measured',
      frame = 'earth'
    } = physicsState;

    let terrellQuaternion = null;
    if (viewMode === 'observed' && frame !== 'ship' && beta > 0.0001) {
      // Camera in preview space: base position (0, 8, 12) rotated by drag
      const baseCameraPos = new THREE.Vector3(0, 8, 12);
      const viewEuler = new THREE.Euler(this.dragPitch, this.dragYaw, 0, 'YXZ');
      const rotatedCameraPos = baseCameraPos.clone().applyEuler(viewEuler);
      // viewDir: from origin (where rod sits) toward camera
      const viewDir = rotatedCameraPos.clone().normalize();
      // velocityDir: along +Z in rod-local space (parallel rod is along Z)
      const velocityDir = new THREE.Vector3(0, 0, 1);

      const { angle, axis } = terrellRotation(beta, viewDir, velocityDir, terrellMode);
      terrellQuaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    }

    this.parallelRod.update({
      ...physicsState,
      terrellQuaternion,
      visible: isVisible
    });
    this.perpendicularRod.update({ ...physicsState, visible: isVisible });

    // ... rest of update() unchanged (drag, position, render) ...
```

- [ ] **Step 3: Verify the build**

Run: `npx vite build 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/visual/MeasurementRod.js src/ui/MeasurementPreview.js
git commit -m "feat: use terrell.js for measurement rod rotation"
```

---

### Task 7: Build Verification and Manual Testing

**Files:**
- (none — verification only)

- [ ] **Step 1: Full production build**

Run: `npx vite build 2>&1`
Expected: "✓ built in" with 0 errors, 0 warnings

- [ ] **Step 2: Start dev server for manual testing**

Run: `npx vite --host 0.0.0.0 --port 5173`

- [ ] **Step 3: Manual test checklist**

Verify each of these in the browser:

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | β=0, any mode | All objects render normally, no deformation |
| 2 | β=0.9, lorentzOnly, Earth frame, observed | Planets flatten along velocity; spacecraft shortens; no rotation |
| 3 | β=0.9, precise, Earth frame, observed | Planets appear circular; spacecraft appears rotated; rod appears rotated |
| 4 | β=0.9, enhanced, Earth frame, observed | Rotation visibly larger than precise mode |
| 5 | Switch observed → measured | Terrell selector hides; all objects use lorentzOnly internally |
| 6 | Ship frame | No Terrell on any object (objects at rest in ship frame) |
| 7 | Third-person camera drag | Spacecraft Terrell rotation changes with viewing angle |
| 8 | Measurement rod mini preview | Rod tilts forward (pitch) at default view, not yaws sideways |
| 9 | Side-by-side mode | Earth preview shows Terrell, ship preview does not |
| 10 | Free-look (P key) | Terrell transforms continue updating correctly |
| 11 | Planet jump (keys 1-8) | Terrell updates correctly at new positions |
| 12 | Performance | No visible frame drop with 9 planets + spacecraft + rods |

- [ ] **Step 4: Commit verification notes (if any issues found and fixed)**

```bash
git add -A
git commit -m "verify: Penrose-Terrell implementation acceptance tests"
```
