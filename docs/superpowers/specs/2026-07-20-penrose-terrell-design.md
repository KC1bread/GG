# Penrose-Terrell Rotation — Complete Visual Implementation

**Date:** 2026-07-20
**Status:** Draft
**Scope:** Replace ad-hoc Terrell approximations with unified, physically correct Penrose-Terrell transformation applied to all visible objects (planets, spacecraft, measurement rods), with user-switchable precision tiers

---

## 1. Problem

The project currently applies Penrose-Terrell rotation as scattered heuristics across four independent modules, each using different (and sometimes incorrect) formulas:

| Module | Formula | Accuracy |
|--------|---------|----------|
| MeasurementRod | `rotation.y = asin(β)` | Wrong axis; no view-angle dependence |
| Spacecraft | `rotation.x = β × 0.3` | Entirely ad-hoc |
| Post-process shader | Inverse aberration on UV | Physically correct for rays |
| StarField CPU | Aberration on point cloud | Physically correct for point sources |

A bug exists at `App.js:929`: `r.terrellAngle` is always `undefined` because `computeRelativityState()` does not return it. The MeasurementRod falls back to a local default that ignores the view-angle dependence.

The project's `CHANGE.md` explicitly defers accurate Penrose-Terrell rendering to a future "advanced version." This spec delivers that version.

---

## 2. Solution Overview

Create a single source of truth — **`src/physics/terrell.js`** — that computes the correct Penrose-Terrell 4×4 transformation matrix given `beta`, `viewDir`, `velocityDir`, and a `mode` parameter. Every visual object receives its transform from this module.

Add a **three-way selector** in the control panel so the user can compare:

| Mode | Contraction | Rotation | Purpose |
|------|------------|----------|---------|
| `lorentzOnly` | Full `1/γ` along velocity | 0 | "What is measured" |
| `precise` | Full `1/γ` along velocity | `asin(β·sin(α))` | "What the camera actually captures" |
| `enhanced` | Full `1/γ` along velocity | `1.5 × asin(β·sin(α))` | "Exaggerated for teaching" |

---

## 3. Physics Foundation

### 3.1 The Penrose-Terrell Effect

A relativistically moving extended object is seen not as Lorentz-contracted, but as *rotated*. This is not a physical rotation — it is a visual consequence of light-travel-time differences across the object's surface.

- Photons from the object's far side left **earlier** (when the object was farther back along its trajectory)
- Photons from the near side left **later** (when the object had moved forward)
- All photons arrive at the observer's eye/camera simultaneously
- The brain reconstructs this assembly of photons as a rotated object

### 3.2 Core Formulas

```
α  = angle between view direction and velocity direction  (∈ [0, π])
θ  = asin(β · sin(α))                                    rotation angle
a  = viewDir × velocityDir    (normalised)                rotation axis
```

Boundary cases:
- **α = 0° (directly ahead):** θ = 0 — no apparent rotation
- **α = 90° (side-on):** θ = asin(β) — maximum rotation
- **α = 180° (directly behind):** θ = 0 — no apparent rotation

### 3.3 Sphere-Specific Behavior

A moving sphere **always appears circular** to any observer, regardless of β. The Terrell rotation exactly cancels the Lorentz contraction in visual projection. Surface textures (continents, cloud bands) appear shifted — the sphere looks like it "turned" to face the observer.

This is the canonical educational demonstration: a student expects to see a flattened ellipse, but the Terrell effect restores the circular outline.

### 3.4 Relationship to Aberration and Doppler

Penrose-Terrell, stellar aberration, and Doppler shift are three facets of the same underlying Lorentz transformation, operating at different levels:

| Effect | Domain | Mechanism |
|--------|--------|-----------|
| Terrell rotation | Per-object mesh | Apparent shape distortion of extended bodies |
| Stellar aberration | Per-pixel / per-star | Shift in *apparent direction* of light rays |
| Doppler shift | Per-pixel / per-star | Shift in *colour and intensity* of light |

**Terrell is applied pre-render on 3D geometry.** Aberration and Doppler are applied **post-render** by the existing shader on the final image. The two layers are complementary and do not double-count.

---

## 4. Architecture

### 4.1 New Module: `src/physics/terrell.js`

Single source of truth for all Terrell-related computations. All visual modules consume this — none compute Terrell values locally.

```
src/physics/
├── relativity.js          ← MODIFY: add terrellAngle to computeRelativityState
└── terrell.js             ← NEW
```

#### Public API

```js
/**
 * Full 4×4 transformation matrix combining Lorentz contraction
 * and Penrose-Terrell rotation.
 *
 * @param {number} beta          - v/c, clamped to [0, 0.999]
 * @param {THREE.Vector3} viewDir  - normalised direction from object to camera (world space)
 * @param {THREE.Vector3} velocityDir - normalised velocity direction (world space)
 * @param {'lorentzOnly'|'precise'|'enhanced'} mode
 * @returns {THREE.Matrix4}
 */
export function terrellTransformMatrix(beta, viewDir, velocityDir, mode)

/**
 * Rotation-only component of the Penrose-Terrell effect.
 * For modules that manage their own scaling.
 *
 * @returns {{ angle: number, axis: THREE.Vector3 }}
 */
export function terrellRotation(beta, viewDir, velocityDir, mode)

/**
 * Lorentz contraction scale vector.
 * @returns {THREE.Vector3} — e.g. (1, 1, 1/gamma) when velocity is along Z
 */
export function lorentzContractionScale(beta, velocityDir)

/**
 * Amplification factor applied by the given mode.
 * @returns {number} — lorentzOnly: 0, precise: 1.0, enhanced: 1.5
 */
export function terrellAmplification(mode)
```

#### Internal Implementation

```js
function terrellRotationAngle(beta, alpha, mode) {
  const amp = terrellAmplification(mode);
  return amp * Math.asin(clampBeta(beta) * Math.sin(alpha));
}
```

The module imports `clampBeta` and `lorentzFactor` from `relativity.js` — no circular dependency.

### 4.2 Data Flow

```
                    ┌──────────────┐
                    │  terrell.js  │
                    │              │
                    │ transformMatrix(beta, viewDir, velDir, mode)
                    │ rotation(beta, viewDir, velDir, mode)
                    │ contraction(beta, velDir)
                    └──────┬───────┘
                           │
         ┌─────────────────┼──────────────────┐
         ▼                 ▼                   ▼
   ┌──────────┐    ┌──────────────┐    ┌──────────────┐
   │  Planet  │    │  Spacecraft  │    │ Measurement  │
   │  spheres │    │  terrellGrp  │    │     Rod      │
   │          │    │              │    │              │
   │ matrix   │    │ matrix on    │    │ quaternion   │
   │ on mesh  │    │ child group  │    │ + scale on   │
   │          │    │              │    │ visualGroup  │
   └──────────┘    └──────────────┘    └──────────────┘
         │                 │                   │
         └─────────────────┼───────────────────┘
                           ▼
                   ┌──────────────┐
                   │ Main Scene   │
                   │ (Three.js)   │
                   └──────┬───────┘
                          ▼
                   ┌──────────────┐
                   │ Post-process │  ← aberration + Doppler + beaming
                   │   Shader     │    (unchanged from current)
                   └──────┬───────┘
                          ▼
                   ┌──────────────┐
                   │   Screen     │
                   └──────────────┘
```

### 4.3 Modified Files

| File | Change | Description |
|------|--------|-------------|
| `src/physics/terrell.js` | **NEW** | Transform matrix, rotation, contraction, amplification |
| `src/physics/relativity.js` | MODIFY | Add `terrellAngle` to `computeRelativityState` return |
| `src/core/App.js` | MODIFY | Add `terrellMode` state; compute transforms per-object per-frame; wire up UI |
| `src/visual/Planet.js` | MODIFY | Accept and apply Terrell matrix per planet |
| `src/visual/Spacecraft.js` | MODIFY | Replace `beta * 0.3` with matrix from `terrell.js` |
| `src/visual/MeasurementRod.js` | MODIFY | Use `terrell.js` instead of local `asin(beta)`; correct rotation axis |
| `index.html` | MODIFY | Add Terrell mode `<select>` to control panel |
| `src/style.css` | MODIFY | Style for new select (if needed; likely reuses existing) |

### 4.4 Unchanged Files

- `src/visual/RelativisticPostProcess.js` — aberration/Doppler/beaming on final pixels is correct and complementary
- `src/visual/StarField.js` — CPU-side aberration for non-shader mode is correct
- `src/visual/SolarSystem.js` — planet creation; transforms applied downstream
- `src/ui/MeasurementPreview.js` — rods updated; preview wiring unchanged
- `src/ui/Hud.js` — display logic unchanged
- All other UI modules

---

## 5. Per-Object Design

### 5.1 Planets (Spheres)

**Physics:** A moving sphere's outline remains circular; surface textures appear rotated.

**Implementation:**

```js
// In App.js update loop, for each planet:
// Terrell is applied to the planet's mesh (sphere geometry), NOT to the group.
// The group handles orbital position/animation; the mesh handles visual deformation.
const planetWorldPos = planet.group.position.clone();
const viewDir = camera.position.clone().sub(planetWorldPos).normalize();
const velocityDir = shipVelocity.clone().normalize();

const transform = terrellTransformMatrix(beta, viewDir, velocityDir, this.state.terrellMode);
planet.mesh.matrix.copy(transform);
planet.mesh.matrixAutoUpdate = false;
// Additional child meshes (Earth ocean, Venus cloud, Saturn rings) receive
// the same transform to stay co-located with the main body.
```

**View-angle dependence:** Each planet has a different `viewDir` → different rotation angle. Planets to the side of the flight path get maximum rotation; planets dead ahead get none.

**Textures:** UV mapping is handled automatically by Three.js — the rotated geometry projects the texture correctly. Surface features (continents, bands) appear shifted.

**Saturn's rings:** The ring system is a separate flat mesh (`RingGeometry`) attached to Saturn. It receives the same Terrell matrix as the planet body — both rotate together. This is physically correct: the rings and planet are co-moving.

**Enhanced mode extras (future):** Wireframe overlay showing Lorentz-contracted ellipsoid (dashed) vs Terrell-rotated apparent circle (solid). Not implemented in this spec — deferred to a follow-up.

### 5.2 Spacecraft

**Physics:** A complex rigid body at relativistic speed appears rotated about `viewDir × velocityDir` by `asin(β·sin(α))`.

**Three observation contexts:**

| Context | Camera | Spacecraft visible? | Terrell applied? |
|---------|--------|---------------------|------------------|
| Third-person | External, orbiting ship | Yes | Yes |
| First-person | Inside cockpit | No (instruments only) | N/A |
| Side-by-side Earth | External | Yes | Yes (Earth frame) |
| Side-by-side Ship | External | Yes | No (ship rest frame) |

**Implementation:**

```js
// Third-person: compute view direction from camera to ship
const viewDir = camera.position.clone().sub(shipWorldPos).normalize();
const velocityDir = shipForward.clone().normalize();
const transform = terrellTransformMatrix(beta, viewDir, velocityDir, mode);
// Apply to spacecraft.group — the existing scale/rotation code in App.js
// (lines 907-922) is replaced by this single matrix assignment.
spacecraft.group.scale.copy(transform.scale);
spacecraft.group.quaternion.copy(transform.quaternion);
// Note: spacecraft.group.position and heading (Y rotation) are set separately
// via setWorldPosition/setHeading, so the Terrell transform must compose
// with those. Implementation uses a dedicated terrellGroup child of
// spacecraft.group to keep positioning and deformation independent.
```

**Sub-mesh treatment:**

| Mesh | Treatment |
|------|-----------|
| Hull, engines, cockpit exterior | Full Terrell matrix |
| Engine glow (additive volume) | Contraction only; no rotation (volumetric effects do not follow rigid-body light-time rules) |
| Engine glow (enhanced mode) | Contraction + half-rotation + slight forward offset (mimics beaming) |

**Enhanced mode extras (future):** Dual wireframe overlay — dashed = Lorentz-only contour, solid = Terrell-rotated contour. Deferred to a follow-up spec.

### 5.3 Measurement Rods

**Physics for parallel rod:** Same as any extended object along the velocity direction. Contracts to `L₀/γ`, then appears rotated by `asin(β·sin(α))` about the Terrell rotation axis.

**Physics for perpendicular rod:** No Lorentz contraction (perpendicular to velocity). Terrell rotation is negligible in practice because the rod has no extension along the velocity direction.

**Two display contexts:**

#### Mini Preview Window

```js
// Camera at base position (0, 8, 12), looking at origin
// User drag rotates the previewRoot within ±15° yaw/pitch
// Velocity direction is always (0, 0, 1) in rod-local space

const rotatedCameraPos = new THREE.Vector3(0, 8, 12)
  .applyEuler(new THREE.Euler(dragPitch, dragYaw, 0, 'YXZ'));
const viewDir = rotatedCameraPos.clone().normalize(); // toward origin
const velocityDir = new THREE.Vector3(0, 0, 1);

const { angle, axis } = terrellRotation(beta, viewDir, velocityDir, mode);
parallelRod.visualGroup.quaternion.setFromAxisAngle(axis, angle);
parallelRod.visualGroup.scale.z = 1 / gamma;
```

**Numerical check (default view, β = 0.9):**
- Current buggy code: `rotation.y = asin(0.9) = 64.2°` — too large, wrong axis
- Correct: `α = acos(viewDir·velDir) = acos(0.832) = 33.7°`, `θ = asin(0.9·sin(33.7°)) = 30.0°`, axis = X
- The rod tilts forward (pitch), not yaws sideways

#### Side-by-Side Comparison

- **Earth frame preview:** Full contraction + Terrell rotation applied
- **Ship frame preview:** No contraction, no rotation — rods are at rest in this frame

---

## 6. State Management

### 6.1 New State Field

```js
// In App.js constructor
this.state.terrellMode = 'precise'; // 'lorentzOnly' | 'precise' | 'enhanced'
```

### 6.2 UI Control

Added to `#control-panel`, below the view-mode select:

```html
<label>
  Terrell 效果
  <select id="terrell-mode-select">
    <option value="lorentzOnly">纯 Lorentz 收缩</option>
    <option value="precise" selected>Penrose-Terrell 精确</option>
    <option value="enhanced">增强教学</option>
  </select>
</label>
```

- Visible only when `viewMode === 'observed'` (in `measured` mode, Terrell is not applicable)
- Switching modes updates all objects in the next frame — no animation transition needed (values are recomputed each frame anyway)

### 6.3 State Change Handler

```js
// In App.js setupUi()
document.getElementById('terrell-mode-select').addEventListener('change', (e) => {
  this.state.terrellMode = e.target.value;
});
```

---

## 7. Edge Cases

| Case | Handling |
|------|----------|
| β = 0 | Rotation angle = 0 for all modes; contraction = (1,1,1) — identity transforms |
| β → 0.999 | γ grows large; contraction → near-zero; rotation approaches asin(sin(α)) = α (in enhanced: may clip) |
| viewDir ∥ velocityDir (α = 0 or π) | Cross product = zero vector; rotation axis undefined → identity rotation (angle = 0) |
| viewDir ⊥ velocityDir (α = π/2) | Maximum rotation angle = asin(β) |
| `viewDir × velocityDir` = zero | Guard: if cross product magnitude < ε, return identity rotation |
| Measured mode (not observed) | Terrell mode selector hidden; all objects use `lorentzOnly` internally |
| First-person perspective | Spacecraft not visible; planets still get Terrell transforms; shader handles aberration |
| Side-by-side frame | Ship-frame preview: no Terrell (objects at rest); Earth-frame preview: full Terrell applied |
| Planet behind camera | Still computed — the transform is valid even if the object is off-screen (frustum culling handles visibility) |
| Performance: 9 planets × transform | Negligible — 9 matrix builds per frame (≈ 0.01ms) |

---

## 8. Verification

1. `npx vite build` — 0 errors
2. **Correctness: β = 0** — all objects render identically to current code (no contraction, no rotation)
3. **Correctness: lorantzOnly mode** — parallel rod shortens, no rotation; planet spheres flatten to ellipsoids along velocity
4. **Correctness: precise mode, α = 90°** — rod rotation = asin(β); sphere outline circular at all β in preview
5. **Correctness: view-angle dependence** — spacecraft Terrell rotation changes as user drags third-person camera around it
6. **Correctness: first-person** — no spacecraft visible; planet transforms still applied (viewed through cockpit window)
7. **Enhanced mode** — rotation angle visibly larger than precise; wireframe overlays toggle correctly
8. **UI toggle** — switching Terrell modes instantly changes all objects; switching from Observed → Measured hides the Terrell selector
9. **Side-by-side** — Earth preview shows Terrell, ship preview does not
10. **No regression** — free-look (P key, mouse), planet-jump (keys 1-8), orbital slider, panel drag, all continue to work
