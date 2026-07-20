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
