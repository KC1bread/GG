import * as THREE from 'three';

const BASE_LENGTH = 5;
const BODY_RADIUS = 0.096;
const GLOW_RADIUS = 0.138;
const TICK_RADIUS = 0.14;
const TICK_TUBE = 0.012;
const LABEL_SCALE = { width: 3.3, height: 1.0 };
const SCENE_SCALE = 1 / 3;

const VISUAL_PRESETS = {
  measured: {
    bodyColor: 0xffd36b,
    bodyOpacity: 0.65,
    emissive: 0xffe2a0,
    emissiveIntensity: 0.22,
    glowColor: 0xffd36b,
    glowOpacity: 0.12
  },
  observed: {
    bodyColor: 0x88c7ff,
    bodyOpacity: 0.6,
    emissive: 0x9ad8ff,
    emissiveIntensity: 0.24,
    glowColor: 0x88c7ff,
    glowOpacity: 0.12
  },
  reference: {
    bodyColor: 0xffffff,
    bodyOpacity: 0.6,
    emissive: 0xcfe6ff,
    emissiveIntensity: 0.15,
    glowColor: 0xffffff,
    glowOpacity: 0.08
  }
};

function orientAlongAxis(object, axis) {
  if (axis === 'z') object.rotation.x = Math.PI / 2;
  if (axis === 'x') object.rotation.z = Math.PI / 2;
}

function axisPosition(axis, value) {
  if (axis === 'z') return new THREE.Vector3(0, 0, value);
  return new THREE.Vector3(value, 0, 0);
}

export class MeasurementRod {
  constructor(type = 'parallel') {
    this.type = type === 'perpendicular' ? 'perpendicular' : 'parallel';
    this.axis = this.type === 'parallel' ? 'z' : 'x';
    this.baseLength = BASE_LENGTH;
    this.attachOffset = new THREE.Vector3(0.97, -0.16, -0.31);
    this.group = new THREE.Group();
    this.group.name = `${this.type}-measurement-rod`;
    this.group.scale.setScalar(SCENE_SCALE);

    this.visualGroup = new THREE.Group();
    this.labelAnchor = new THREE.Group();
    this.group.add(this.visualGroup);
    this.group.add(this.labelAnchor);

    this._buildMaterials();
    this._buildMeshes();
    this._buildTicks();
    this._buildLabel();

    this._lastLabel = '';
  }

  _buildMaterials() {
    this.bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: VISUAL_PRESETS.measured.bodyColor,
      transparent: true,
      opacity: Math.min(0.48, VISUAL_PRESETS.measured.bodyOpacity),
      emissive: VISUAL_PRESETS.measured.emissive,
      emissiveIntensity: VISUAL_PRESETS.measured.emissiveIntensity,
      roughness: 0.08,
      metalness: 0.25,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      transmission: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this.capMaterial = this.bodyMaterial.clone();
    this.tickMaterial = new THREE.MeshBasicMaterial({
      color: this.type === 'parallel' ? 0xffd36b : 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.glowMaterial = new THREE.MeshBasicMaterial({
      color: VISUAL_PRESETS.measured.glowColor,
      transparent: true,
      opacity: VISUAL_PRESETS.measured.glowOpacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
  }

  _buildMeshes() {
    const bodyGeometry = new THREE.CylinderGeometry(BODY_RADIUS, BODY_RADIUS, this.baseLength, 24, 1, true);
    const glowGeometry = new THREE.CylinderGeometry(GLOW_RADIUS, GLOW_RADIUS, this.baseLength + 0.08, 24, 1, true);
    const capGeometry = new THREE.SphereGeometry(0.058, 16, 12);

    this.bodyMesh = new THREE.Mesh(bodyGeometry, this.bodyMaterial);
    this.glowMesh = new THREE.Mesh(glowGeometry, this.glowMaterial);
    this.capA = new THREE.Mesh(capGeometry, this.capMaterial);
    this.capB = new THREE.Mesh(capGeometry, this.capMaterial);

    orientAlongAxis(this.bodyMesh, this.axis);
    orientAlongAxis(this.glowMesh, this.axis);

    const half = this.baseLength / 2;
    this.capA.position.copy(axisPosition(this.axis, -half));
    this.capB.position.copy(axisPosition(this.axis, half));

    this.visualGroup.add(this.glowMesh, this.bodyMesh, this.capA, this.capB);
  }

  _buildTicks() {
    this.tickGroup = new THREE.Group();
    const tickPositions = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5];

    tickPositions.forEach((value) => {
      const tick = new THREE.Mesh(
        new THREE.TorusGeometry(TICK_RADIUS, TICK_TUBE, 8, 22),
        this.tickMaterial
      );
      if (this.axis === 'x') tick.rotation.y = Math.PI / 2;
      tick.position.copy(axisPosition(this.axis, value));
      this.tickGroup.add(tick);
    });

    this.visualGroup.add(this.tickGroup);
  }

  _buildLabel() {
    this.labelCanvas = document.createElement('canvas');
    this.labelCanvas.width = 1536;
    this.labelCanvas.height = 384;
    this.labelContext = this.labelCanvas.getContext('2d');

    this.labelTexture = new THREE.CanvasTexture(this.labelCanvas);
    this.labelTexture.minFilter = THREE.LinearFilter;
    this.labelTexture.magFilter = THREE.LinearFilter;
    this.labelTexture.colorSpace = THREE.SRGBColorSpace;
    this.labelTexture.generateMipmaps = false;

    this.labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.labelTexture,
      transparent: true,
      depthWrite: false,
      depthTest: false
    }));
    this.labelSprite.scale.set(LABEL_SCALE.width, LABEL_SCALE.height, 1);
    this.labelAnchor.add(this.labelSprite);
  }

  setAttachOffset(offset) {
    this.attachOffset.copy(offset);
  }

  setVisible(visible) {
    this.group.visible = visible;
  }

  syncToShip(shipPosition, shipQuaternion) {
    const worldOffset = this.attachOffset.clone().applyQuaternion(shipQuaternion);
    this.group.position.copy(shipPosition).add(worldOffset);
    this.group.quaternion.copy(shipQuaternion);
  }

  _applyPreset(viewMode) {
    const preset = this.type === 'perpendicular'
      ? VISUAL_PRESETS.reference
      : VISUAL_PRESETS[viewMode] ?? VISUAL_PRESETS.measured;

    this.bodyMaterial.color.setHex(preset.bodyColor);
    this.bodyMaterial.opacity = preset.bodyOpacity;
    this.bodyMaterial.emissive.setHex(preset.emissive);
    this.bodyMaterial.emissiveIntensity = preset.emissiveIntensity;

    this.capMaterial.color.setHex(preset.bodyColor);
    this.capMaterial.opacity = Math.min(0.88, preset.bodyOpacity + 0.12);
    this.capMaterial.emissive.setHex(preset.emissive);
    this.capMaterial.emissiveIntensity = preset.emissiveIntensity;

    this.glowMaterial.color.setHex(preset.glowColor);
    this.glowMaterial.opacity = preset.glowOpacity;

    if (this.type === 'parallel') {
      this.tickMaterial.color.setHex(viewMode === 'observed' ? 0x9ad8ff : 0xffd36b);
    } else {
      this.tickMaterial.color.setHex(0xffffff);
    }
  }

  _drawLabel(lines, accentColor = '#ffffff') {
    const ctx = this.labelContext;
    if (!ctx) return;

    const labelText = lines.join('\n');
    if (this._lastLabel === labelText && this._lastAccent === accentColor) return;
    this._lastLabel = labelText;
    this._lastAccent = accentColor;

    ctx.clearRect(0, 0, this.labelCanvas.width, this.labelCanvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.font = 'bold 190px Inter, "PingFang SC", sans-serif';
    ctx.strokeText(lines[0], this.labelCanvas.width / 2, this.labelCanvas.height / 2);
    ctx.fillStyle = accentColor;
    ctx.fillText(lines[0], this.labelCanvas.width / 2, this.labelCanvas.height / 2);

    this.labelTexture.needsUpdate = true;
  }

  update(physicsState = {}) {
    const {
      beta = 0,
      lengthRatio = 1,
      terrellScale = lengthRatio,
      terrellAngle = Math.asin(beta),
      viewMode = 'measured',
      frame = 'earth',
      visible = true
    } = physicsState;

    this.setVisible(visible);
    if (!visible) return;

    const effectiveViewMode = viewMode === 'observed' ? 'observed' : 'measured';
    const isShipFrame = frame === 'ship';

    this._applyPreset(effectiveViewMode);

    let scaleRatio = 1;
    if (this.type === 'parallel' && !isShipFrame) {
      if (effectiveViewMode === 'measured') {
        scaleRatio = lengthRatio;
      } else {
        scaleRatio = terrellScale;
      }
    }

    this.visualGroup.scale.set(1, 1, 1);
    this.visualGroup.rotation.set(0, 0, 0);

    if (this.type === 'parallel') {
      this.visualGroup.scale.z = scaleRatio;
      // Terrell rotation applied via quaternion from MeasurementPreview
      if (!isShipFrame && effectiveViewMode === 'observed' && physicsState.terrellQuaternion) {
        this.visualGroup.quaternion.copy(physicsState.terrellQuaternion);
      }
    } else {
      this.labelAnchor.rotation.set(0, 0, 0);
    }

    const pulse = 0.08 + beta * 0.06;
    this.glowMaterial.opacity = Math.min(0.2, this.glowMaterial.opacity + pulse);

    const currentLength = this.type === 'parallel' ? this.baseLength * scaleRatio : this.baseLength;
    const halfLength = currentLength * 0.5;

    if (this.type === 'parallel') {
      this.labelSprite.position.set(0.28, 0.46, -halfLength - 0.32);
      const accent = effectiveViewMode === 'measured' ? '#ffd36b' : '#9ad8ff';
      this._drawLabel(['平行尺'], accent);
    } else {
      this.labelSprite.position.set(halfLength + 0.5, 0.46, 0);
      this._drawLabel(['垂直尺'], '#eaf4ff');
    }
  }

  getInfo() {
    return {
      type: this.type,
      baseLength: this.baseLength,
      currentLength: this.type === 'parallel' ? this.baseLength * (this.visualGroup.scale.z || 1) : this.baseLength
    };
  }
}
