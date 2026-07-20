import * as THREE from 'three';
import { MeasurementRod } from '../visual/MeasurementRod.js';
import { terrellRotation } from '../physics/terrell.js';

export class MeasurementPreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
    this.camera.position.set(0, 8, 12.0);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.previewRoot = new THREE.Group();
    this.scene.add(this.previewRoot);
    this.baseEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.dragYaw = 0;
    this.dragPitch = 0;
    this.maxDrag = THREE.MathUtils.degToRad(15);
    this.previewRoot.quaternion.setFromEuler(this.baseEuler);

    this.parallelRod = new MeasurementRod('parallel');
    this.perpendicularRod = new MeasurementRod('perpendicular');

    this.parallelRod.group.scale.setScalar(1);
    this.perpendicularRod.group.scale.setScalar(1);
    this.parallelRod.labelSprite.visible = true;
    this.perpendicularRod.labelSprite.visible = true;

    this.parallelRod.group.position.set(0, 0, 0);
    this.perpendicularRod.group.position.set(0, -0.56, 0);

    this.previewRoot.add(this.parallelRod.group);
    this.previewRoot.add(this.perpendicularRod.group);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.25));

    const keyLight = new THREE.DirectionalLight(0xdcecff, 1.2);
    keyLight.position.set(5, 7, 8);
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x7dbdff, 0.8);
    rimLight.position.set(-6, 3, -4);
    this.scene.add(rimLight);

    this._lastWidth = 0;
    this._lastHeight = 0;
    this._dragging = false;
    this._pointerId = null;
    this._lastPointerX = 0;
    this._lastPointerY = 0;

    this._bindDrag();
  }

  _bindDrag() {
    this.canvas.style.touchAction = 'none';

    this.canvas.addEventListener('pointerdown', (e) => {
      this._dragging = true;
      this._pointerId = e.pointerId;
      this._lastPointerX = e.clientX;
      this._lastPointerY = e.clientY;
      this.canvas.setPointerCapture?.(e.pointerId);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this._dragging || e.pointerId !== this._pointerId) return;

      const dx = e.clientX - this._lastPointerX;
      const dy = e.clientY - this._lastPointerY;
      this._lastPointerX = e.clientX;
      this._lastPointerY = e.clientY;

      this.dragYaw = THREE.MathUtils.clamp(this.dragYaw + dx * 0.0045, -this.maxDrag, this.maxDrag);
      this.dragPitch = THREE.MathUtils.clamp(this.dragPitch + dy * 0.0045, -this.maxDrag, this.maxDrag);
    });

    const endDrag = (e) => {
      if (e.pointerId !== this._pointerId) return;
      this._dragging = false;
      this._pointerId = null;
      this.canvas.releasePointerCapture?.(e.pointerId);
    };

    this.canvas.addEventListener('pointerup', endDrag);
    this.canvas.addEventListener('pointercancel', endDrag);
  }

  resize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (!width || !height) return;
    if (width === this._lastWidth && height === this._lastHeight) return;

    this._lastWidth = width;
    this._lastHeight = height;

    this.renderer.setPixelRatio(Math.min(4, (window.devicePixelRatio || 1) * 2.6));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  resetView() {
    this.dragYaw = 0;
    this.dragPitch = 0;
    this.previewRoot.position.set(0, 0, 0);
    this.previewRoot.quaternion.setFromEuler(this.baseEuler);
  }

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

    const viewEuler = new THREE.Euler(this.dragPitch, this.dragYaw, 0, 'YXZ');
    this.previewRoot.quaternion.setFromEuler(viewEuler);

    const targetX = THREE.MathUtils.clamp((shipPosition?.x ?? 0) * 0.0024, -0.36, 0.36);
    const targetY = THREE.MathUtils.clamp(((shipPosition?.y ?? 0) - 0.5) * 0.01, -0.22, 0.22);
    const targetZ = THREE.MathUtils.clamp(((shipPosition?.z ?? 200) - 200) * 0.0012, -0.12, 0.12);
    this.previewRoot.position.set(targetX, targetY, targetZ);

    this.renderer.render(this.scene, this.camera);
  }

  getInfo() {
    return {
      parallel: this.parallelRod.getInfo(),
      perpendicular: this.perpendicularRod.getInfo()
    };
  }
}
