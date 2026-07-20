export const C_LY_PER_YEAR = 1;
export const DEFAULT_TARGET_DISTANCE_LY = 4.24;

export function clampBeta(beta) {
  const value = Number.isFinite(beta) ? beta : 0;
  return Math.min(0.999, Math.max(0, value));
}

export function lorentzFactor(beta) {
  const b = clampBeta(beta);
  return 1 / Math.sqrt(1 - b * b);
}

export function lengthContractionRatio(beta) {
  return 1 / lorentzFactor(beta);
}

export function contractedLength(restLength, beta) {
  return restLength * lengthContractionRatio(beta);
}

export function shipProperTime(earthFrameTime, beta) {
  return earthFrameTime / lorentzFactor(beta);
}

export function shipFrameDistance(earthDistance, beta) {
  return earthDistance / lorentzFactor(beta);
}

export function earthFrameEta(distanceLy, beta) {
  const b = clampBeta(beta);
  if (b <= 0.0001) return Infinity;
  return distanceLy / b;
}

export function shipFrameEta(distanceLy, beta) {
  const earthEta = earthFrameEta(distanceLy, beta);
  if (!Number.isFinite(earthEta)) return Infinity;
  return earthEta / lorentzFactor(beta);
}

// cosTheta is relative to forward direction. +1 = ahead, -1 = behind.
export function dopplerFactor(beta, cosTheta) {
  const b = clampBeta(beta);
  const gamma = lorentzFactor(b);
  return gamma * (1 + b * cosTheta);
}

// Relativistic aberration. Simplified mapping for educational visualization.
export function aberratedCosTheta(beta, cosTheta) {
  const b = clampBeta(beta);
  return (cosTheta + b) / (1 + b * cosTheta);
}

export function computeRelativityState(state) {
  const beta = clampBeta(state.beta);
  const gamma = lorentzFactor(beta);
  const earthDistance = state.earthDistance ?? DEFAULT_TARGET_DISTANCE_LY;
  const shipDistance = shipFrameDistance(earthDistance, beta);
  const etaEarth = earthFrameEta(earthDistance, beta);
  const etaShip = shipFrameEta(earthDistance, beta);
  const shipTime = shipProperTime(state.earthTime, beta);
  const lengthRatio = lengthContractionRatio(beta);

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
    terrellAngle: Math.asin(beta)  // baseline: maximum rotation (alpha = 90 deg)
  };
}
