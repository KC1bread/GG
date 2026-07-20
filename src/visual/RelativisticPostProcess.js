import * as THREE from 'three';

/**
 * RelativisticPostProcess — full-screen post-processing pass that applies
 * relativistic stellar aberration, Doppler colour shift, and intensity
 * beaming (headlight effect) to the entire rendered scene.
 *
 * Pipeline:
 *   Scene → renderTarget → full-screen quad ShaderMaterial → screen
 *
 * The effect is driven by beta (v/c) and the ship's velocity direction.
 * The aberration formula uses velocity (not camera look) so free-look
 * does not change the convergence direction — physically correct.
 *
 * No external dependencies; uses only Three.js built-in classes.
 */
export class RelativisticPostProcess {
  constructor() {
    /** @type {THREE.WebGLRenderTarget|null} */
    this.renderTarget = null;

    /** @type {THREE.Mesh|null} full-screen quad */
    this.quad = null;

    /** @type {THREE.ShaderMaterial} */
    this.material = null;

    /** Orthographic camera for quad rendering */
    this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    /** Separate scene holding only the quad */
    this.scene = new THREE.Scene();

    /** Current transition value (0 = off, 1 = full effect) */
    this.transitionValue = 0;

    /** Target transition value */
    this.targetTransition = 0;

    /** Transition speed — reaches target in ~0.5 s */
    this.transitionSpeed = 2.4;

    /** Reference to the main renderer */
    this.renderer = null;

    /** Cached view-space velocity vector */
    this._velView = new THREE.Vector3(0, 0, -1);

    /** Temp matrix for view-space transform */
    this._rotMatrix = new THREE.Matrix4();
  }

  // ==========================================================================
  //  Initialisation
  // ==========================================================================

  /**
   * Create render target and full-screen quad.  Call once after the renderer
   * is ready, or again after a renderer swap.
   *
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.PerspectiveCamera} _camera — unused, kept for API consistency
   */
  init(renderer, _camera) {
    this.renderer = renderer;

    const size = renderer.getSize(new THREE.Vector2());

    // ---- Render target — LinearFilter avoids aliasing on UV remap -----------
    this.renderTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });

    // ---- Shader material ----------------------------------------------------
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uSampler:          { value: null },
        uBeta:             { value: 0 },
        uGamma:            { value: 1 },
        uFov:              { value: 65 * Math.PI / 180 },
        uAspect:           { value: size.x / Math.max(1, size.y) },
        uVelocityDirView:  { value: new THREE.Vector3(0, 0, -1) },
        uTransition:       { value: 0 },
      },
      vertexShader:   VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
    });

    // ---- Full-screen quad ---------------------------------------------------
    const geo = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(geo, this.material);
    this.scene.add(this.quad);
  }

  // ==========================================================================
  //  Resize
  // ==========================================================================

  /**
   * Rebuild render target when the window is resized.
   * @param {number} width
   * @param {number} height
   */
  setSize(width, height) {
    if (this.renderTarget) {
      this.renderTarget.dispose();
    }
    this.renderTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
    if (this.material) {
      this.material.uniforms.uAspect.value = width / Math.max(1, height);
    }
  }

  // ==========================================================================
  //  Render — called every frame from App.js
  // ==========================================================================

  /**
   * Render the scene through the relativistic post-process shader.
   *
   * @param {number} beta — current v/c (0–0.999)
   * @param {THREE.PerspectiveCamera} camera — main scene camera
   * @param {THREE.Scene} scene — the main scene
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Vector3} velocityWorld — unit vector, ship velocity in world space
   */
  render(beta, camera, scene, renderer, velocityWorld) {
    // Guard: WebXR uses its own framebuffer — skip post-process
    if (renderer.xr && renderer.xr.isPresenting) {
      renderer.render(scene, camera);
      return;
    }

    // 1. Render scene to off-screen texture
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.renderTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(prevTarget);

    // 2. Compute velocity direction in VIEW SPACE
    //    Camera forward is local -Z; we need vel relative to that frame.
    this._rotMatrix.extractRotation(camera.matrixWorldInverse);
    this._velView.copy(velocityWorld).applyMatrix4(this._rotMatrix).normalize();

    // 3. Update uniforms
    const unis = this.material.uniforms;
    unis.uSampler.value = this.renderTarget.texture;
    unis.uBeta.value = beta;
    unis.uGamma.value = 1 / Math.sqrt(1 - beta * beta);
    unis.uFov.value = camera.fov * Math.PI / 180; // vertical FOV in radians
    unis.uAspect.value = camera.aspect;
    unis.uVelocityDirView.value.copy(this._velView);
    unis.uTransition.value = this.transitionValue;

    // 4. Render full-screen quad to screen
    renderer.render(this.scene, this.orthoCamera);
  }

  // ==========================================================================
  //  Transition — smooth blend when toggling measured / observed
  // ==========================================================================

  /**
   * Set the desired transition target.
   * @param {number} target — 0 (off) or 1 (full effect)
   */
  setTransition(target) {
    this.targetTransition = target;
  }

  /**
   * Advance transition value toward target. Call once per frame.
   * @param {number} dt — delta time in seconds
   */
  updateTransition(dt) {
    const diff = this.targetTransition - this.transitionValue;
    if (Math.abs(diff) < 0.0005) {
      this.transitionValue = this.targetTransition;
      return;
    }
    const step = this.transitionSpeed * dt;
    if (Math.abs(diff) < step) {
      this.transitionValue = this.targetTransition;
    } else {
      this.transitionValue += Math.sign(diff) * step;
    }
  }

  // ==========================================================================
  //  Cleanup
  // ==========================================================================

  dispose() {
    if (this.renderTarget) {
      this.renderTarget.dispose();
      this.renderTarget = null;
    }
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
    if (this.quad) {
      this.quad.geometry.dispose();
      this.scene.remove(this.quad);
      this.quad = null;
    }
  }
}

// ============================================================================
//  GLSL Shaders
// ============================================================================

const VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D uSampler;
uniform float     uBeta;
uniform float     uGamma;
uniform float     uFov;       // vertical FOV in radians
uniform float     uAspect;    // width / height
uniform vec3      uVelocityDirView; // velocity direction in VIEW space (normalised)
uniform float     uTransition;

varying vec2 vUv;

void main() {
  // ---- early exit — no effect to apply --------------------------------------
  if (uTransition < 0.0005) {
    gl_FragColor = texture2D(uSampler, vUv);
    return;
  }

  // ---- step 1: UV → ray direction in view space ------------------------------
  // Camera looks along local -Z.  Screen plane at z = -1.
  float halfH = tan(uFov * 0.5);
  float halfW = halfH * uAspect;

  vec3 rayDir = normalize(vec3(
    (vUv.x * 2.0 - 1.0) * halfW,
    (vUv.y * 2.0 - 1.0) * halfH,
    -1.0
  ));

  // ---- step 2: cos θ' — observed angle between ray and velocity --------------
  float cosThetaObs = dot(rayDir, uVelocityDirView);

  // ---- step 3: inverse relativistic aberration -------------------------------
  // cos θ_rest = (cos θ_obs − β) / (1 − β · cos θ_obs)
  float cosThetaRest = (cosThetaObs - uBeta) / (1.0 - uBeta * cosThetaObs);
  cosThetaRest = clamp(cosThetaRest, -1.0, 1.0);
  float sinThetaRest = sqrt(max(0.0, 1.0 - cosThetaRest * cosThetaRest));

  // ---- step 4: reconstruct remapped ray (preserve azimuth) -------------------
  float parScale = cosThetaObs;
  vec3  parVec   = uVelocityDirView * parScale;
  vec3  perpVec  = rayDir - parVec;
  float perpLen  = length(perpVec);

  vec3 newRayDir;
  if (perpLen < 0.0001) {
    // Exactly aligned with velocity — no azimuth to preserve
    newRayDir = uVelocityDirView * cosThetaRest;
  } else {
    vec3 perpUnit = perpVec / perpLen;
    newRayDir = uVelocityDirView * cosThetaRest + perpUnit * sinThetaRest;
  }
  newRayDir = normalize(newRayDir);

  // ---- step 5: reproject to UV -----------------------------------------------
  float t = -1.0 / newRayDir.z;
  float screenX = newRayDir.x * t;
  float screenY = newRayDir.y * t;

  float newU = (screenX / halfW + 1.0) * 0.5;
  float newV = (screenY / halfH + 1.0) * 0.5;

  // ---- step 6: edge fade for out-of-bounds UV --------------------------------
  float edgeX = smoothstep(0.0, 0.08, newU) * (1.0 - smoothstep(1.0, 1.08, newU));
  float edgeY = smoothstep(0.0, 0.08, newV) * (1.0 - smoothstep(1.0, 1.08, newV));
  float edgeFade = edgeX * edgeY;

  vec2  sampleUV = clamp(vec2(newU, newV), 0.0, 1.0);
  vec4  color    = texture2D(uSampler, sampleUV);

  // ---- step 7: relativistic Doppler colour shift -----------------------------
  float df = uGamma * (1.0 + uBeta * cosThetaObs);
  // Perceptually smooth log-tanh mapping (matches StarField.js)
  float shift    = tanh(log(clamp(df, 0.08, 12.0)) * 0.55);
  float strength = abs(shift);

  if (strength > 0.015) {
    if (shift > 0.0) {
      // Blueshift ahead — cool tint toward ice-blue
      color.r *= (1.0 - strength * 0.45);
      color.g *= (1.0 - strength * 0.18);
      color.b += (1.0 - color.b) * strength * 0.65;
    } else {
      // Redshift behind — warm tint toward orange-red
      color.r += (1.0 - color.r) * strength * 0.55;
      color.g *= (1.0 - strength * 0.40);
      color.b *= (1.0 - strength * 0.60);
    }
  }

  // ---- step 8: intensity beaming (headlight effect) --------------------------
  // I'/I ≈ df^2.5 (compressed from df^4 for visual balance)
  // Compressive log tone-map to avoid blown-out highlights at high β
  float rawBeaming = pow(clamp(df, 0.001, 100.0), 2.5);
  float beaming = log(1.0 + rawBeaming * 0.15) / log(1.0 + 100.0 * 0.15);
  color.rgb *= beaming;

  // ---- step 9: blend with original via uTransition + edge fade ----------------
  vec4 originalColor = texture2D(uSampler, vUv);
  color.rgb = mix(originalColor.rgb, color.rgb, uTransition);
  // At UV edges fade toward original to avoid hard seams
  color.rgb = mix(originalColor.rgb * edgeFade, color.rgb, edgeFade);

  gl_FragColor = color;
}
`;
