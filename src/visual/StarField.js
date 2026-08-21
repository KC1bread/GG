import * as THREE from 'three';

/**
 * StarField — 稳定视觉增强版相对论星空（核心条带极限凝聚版）
 *
 * 优化点：
 * - 保持了原版所有 Shader、WebGL 显式传参和粒子像素大小优化。
 * - 引入“核心条带核”：在银心最中央的一小条带区域内，星星密集度进一步暴增。
 * - 纯数学对数与多层级指数复合衰减，在保证中心区有极窄、极高密度核心的同时，依然维持绝对顺滑无断层的视觉过渡。
 * - 高速流动隧道：最大速度时星星向外径向流动（starbow 流），聚拢中心呈时空弯曲漩涡，隧道感随速度增强。
 */

// 设定银河系中心的遥远天球方向向量（从太阳系望去，该方向将出现极为明显的群星聚集）
const GALACTIC_CENTER = new THREE.Vector3(0.7, 0.15, -0.7).normalize();
// 银盘的法线方向
const GALACTIC_POLE = new THREE.Vector3(0.1, 0.98, 0.1).normalize();

function generateRealisticStarDirection() {
  // 使用 while 循环进行高效率的迭代采样，零内存负担，绝对不会爆栈
  while (true) {
    // 1. 生成基础全天球随机方向
    const u = Math.random() * 2 - 1;
    const phi = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const dir = new THREE.Vector3(s * Math.cos(phi), s * Math.sin(phi), u).normalize();

    // 2. 计算到银盘平面的垂直距离
    const cosToPole = dir.dot(GALACTIC_POLE);
    const distToGalaxyPlane = Math.abs(cosToPole);

    // 3. 计算到银心的逼近程度（映射至 0.0 背向银心 ~ 1.0 正对银心）
    const cosToCenter = dir.dot(GALACTIC_CENTER); 
    const intensityToCenter = (cosToCenter + 1.0) * 0.5;

    // 4. 【核心修改】引入双层极端非对称密度对比
    // 通过超高幂次（14.0）与更陡峭的银盘约束（* 12.0），在原本就很密集的银心区域内，切出一条更窄、更璀璨的暴风眼核心带
    const densityWeight = 0.05 + // 更高的全天背景星密度，让星星铺满整个天球
      // A. 【新增：核心极端高密条带】仅在非常靠近银盘平面且正对银心的一小条缝隙里爆发
      0.45 * Math.exp(-distToGalaxyPlane * 12.0) * Math.pow(intensityToCenter, 14.0) + 
      // B. 经典大尺度银心核
      0.40 * Math.exp(-distToGalaxyPlane * 5.5) * Math.pow(intensityToCenter, 8.0) + 
      // C. 较窄的顺沿银盘平滑弥散带
      0.13 * Math.exp(-distToGalaxyPlane * 1.8) * Math.pow(intensityToCenter, 2.0);

    // 5. 满足概率则返回
    if (Math.random() < densityWeight) {
      return dir;
    }
  }
}

function starColor() {
  const colors = [
    [0.65, 0.75, 1.0], // O/B 型蓝白星
    [0.78, 0.85, 1.0], 
    [0.90, 0.93, 1.0], // A/F 型白星
    [1.0, 0.98, 0.92], // G 型黄白星（类太阳）
    [1.0, 0.92, 0.75], 
    [1.0, 0.80, 0.58], // K 型橙星
    [1.0, 0.60, 0.45]  // M 型红矮星
  ];

  const r = Math.random();
  let idx = 0;
  if (r < 0.08) idx = 0;
  else if (r < 0.18) idx = 1;
  else if (r < 0.38) idx = 2;
  else if (r < 0.55) idx = 3;
  else if (r < 0.70) idx = 4;
  else if (r < 0.88) idx = 5;
  else idx = 6;

  const base = colors[idx];
  return [
    THREE.MathUtils.clamp(base[0] + (Math.random() - 0.5) * 0.04, 0, 1),
    THREE.MathUtils.clamp(base[1] + (Math.random() - 0.5) * 0.04, 0, 1),
    THREE.MathUtils.clamp(base[2] + (Math.random() - 0.5) * 0.04, 0, 1)
  ];
}

function starSize() {
  const r = Math.random();
  if (r < 0.75) return 1.8 + Math.random() * 1.6;
  if (r < 0.95) return 3.5 + Math.random() * 2.5;
  return 6.0 + Math.random() * 4.0;
}

function starAlpha(size, centerFactor) {
  const sizeBoost = THREE.MathUtils.clamp((size - 1.5) / 7.0, 0, 1);
  const base = 0.5 + sizeBoost * 0.45 + centerFactor * 0.12;
  return THREE.MathUtils.clamp(base + Math.random() * 0.08, 0.3, 0.98);
}

const STARFIELD_VERTEX_SHADER = `
attribute float aBaseSize;
attribute float aBaseAlpha;
attribute float aTwinklePhase;
attribute float aTwinkleSpeed;
attribute float aTwinkleAmp;
attribute float aStreamPhase;
attribute float aStreamSpeed;
attribute vec3 aColor; 

uniform float uBeta;
uniform vec3 uVelocityDir;
uniform float uTime;
uniform float uPixelRatio;
uniform float uPointScale;
uniform float uAberrationExp;
uniform float uDopplerGain;
uniform float uTeachBlend;
uniform float uStreamMax;
uniform float uWarp;
uniform float uStreamSpeed;

varying vec3 vBaseColor;
varying float vDoppler;
varying float vAlpha;
varying float vBrightness;
varying float vTeachBlend;
varying vec2 vStreakDir;
varying float vStreakLen;

void main() {
  vec3 dir = normalize(position);
  float radius = length(position);

  vec3 velocityDir = normalize(uVelocityDir);
  float betaPhys = clamp(uBeta, 0.0, 0.999);

  // —— 星空流动 + 时空弯曲隧道 ——
  // 1) 流动：星星随速度/时间从聚拢中心向外径向流动并循环，速度越高流得越快越远
  float streamGate = smoothstep(0.12, 0.55, betaPhys);
  float streamPhase = fract(aStreamPhase + uTime * aStreamSpeed * uStreamSpeed * (0.05 + betaPhys));
  float streamAngle = streamPhase * uStreamMax * streamGate;

  // 2) 时空弯曲：靠近聚拢中心的星被额外拉向中心，形成隧道漩涡（越靠近中心越强）
  float theta0 = acos(clamp(dot(dir, velocityDir), -1.0, 1.0));
  float warp = uWarp * betaPhys * (1.0 - theta0 / 3.14159265);

  // 3) 合成一次 Rodrigues 旋转：先向外流动(+streamAngle) 再朝中心弯曲(-warp)
  float dTheta = streamAngle - warp;
  vec3 rotAxis = cross(velocityDir, dir);
  float axisLen = length(rotAxis);
  if (axisLen > 0.0001) {
    rotAxis /= axisLen;
    float rc = cos(dTheta);
    float rs = sin(dTheta);
    dir = dir * rc + cross(rotAxis, dir) * rs;
  }
  dir = normalize(dir);

  // 循环处的淡入淡出：隐藏星星在流场末端跳回中心的“瞬移”
  float streamFade = mix(1.0, smoothstep(0.0, 0.08, streamPhase) * (1.0 - smoothstep(0.90, 1.0, streamPhase)), streamGate);

  float betaAberr = 1.0 - pow(max(0.0, 1.0 - betaPhys), max(1.0, uAberrationExp));
  betaAberr = clamp(betaAberr, 0.0, 0.999);
  float gammaAberr = inversesqrt(max(0.000001, 1.0 - betaAberr * betaAberr));
  float gammaPhys = inversesqrt(max(0.000001, 1.0 - betaPhys * betaPhys));

  float cosTheta = dot(dir, velocityDir);
  vec3 dirParallel = velocityDir * cosTheta;
  vec3 dirPerpendicular = dir - dirParallel;

  float denom = max(0.0001, 1.0 + betaAberr * cosTheta);
  float cosThetaPrime = (cosTheta + betaAberr) / denom;
  vec3 dirPrime = normalize(dirPerpendicular / (gammaAberr * denom) + velocityDir * cosThetaPrime);

  vec3 warpedPosition = dirPrime * radius;
  vec4 mvPosition = modelViewMatrix * vec4(warpedPosition, 1.0);

  float doppler = gammaPhys * (1.0 + betaPhys * cosTheta);
  float dopplerVis = pow(max(doppler, 0.001), max(1.0, uDopplerGain));
  float twinkle = 1.0 + sin(uTime * aTwinkleSpeed + aTwinklePhase) * aTwinkleAmp;

  // 侧/后方红移量：0.8c 正后方 D≈0.33，教学档主要放大这一段
  float rearAmt = 1.0 - smoothstep(0.42, 1.05, dopplerVis);
  float teachRear = uTeachBlend * rearAmt;

  float sizeBoost = pow(clamp(dopplerVis, 0.28, 2.5), 0.85);
  sizeBoost *= mix(1.0, 1.18, uTeachBlend);
  sizeBoost *= mix(1.0, 2.55, teachRear);

  float brightness = mix(0.72, pow(clamp(dopplerVis, 0.22, 3.0), 1.05), 0.55);
  brightness = mix(brightness, max(brightness, 1.05), teachRear);

  float forwardVisible = 1.0 - smoothstep(3.2, 4.2, dopplerVis);
  float rearVisible = mix(mix(0.55, 0.92, uTeachBlend), 1.0, smoothstep(0.01, 0.12, dopplerVis));
  float visibility = forwardVisible * rearVisible * streamFade;

  float pointSize = aBaseSize * sizeBoost * twinkle * uPointScale * uPixelRatio;
  pointSize *= (600.0 / max(1.0, -mvPosition.z));
  pointSize *= mix(1.15, 1.0, smoothstep(0.05, 0.9, dopplerVis));

  gl_PointSize = clamp(pointSize, mix(2.0, 4.0, uTeachBlend), mix(48.0, 72.0, teachRear));
  gl_Position = projectionMatrix * mvPosition;

  // —— 星点流动感（starbow 拖尾）：速度越高、越靠近聚拢中心，拖尾越长 ——
  // 聚拢中心 = 正前方速度方向点（光行差汇聚点）；拖尾沿该点向外径向拉长
  vec3 velocityDirN = normalize(uVelocityDir);
  vec4 fwdView = modelViewMatrix * vec4(velocityDirN * radius, 1.0);
  float streakStrength = 0.0;
  vec2 streakDir = vec2(1.0, 0.0);
  if (fwdView.z < 0.0) {
    // 聚拢中心在视野前方才产生流动（看向正后方时消失）
    vec4 fwdClip = projectionMatrix * fwdView;
    vec2 starScreen = vec2(
      gl_Position.x / max(0.0001, gl_Position.w),
      -gl_Position.y / max(0.0001, gl_Position.w)
    );
    vec2 fwdScreen = vec2(
      fwdClip.x / max(0.0001, fwdClip.w),
      -fwdClip.y / max(0.0001, fwdClip.w)
    );
    vec2 radial = starScreen - fwdScreen;
    if (dot(radial, radial) > 1e-8) {
      streakDir = normalize(radial);
    }
    // 越靠近聚拢中心（cosTheta 越高）流动越强；随 β 爬升至最大速度
    float centerProx = smoothstep(0.25, 0.95, cosTheta);
    streakStrength = betaPhys * centerProx;
  }
  vStreakDir = streakDir;
  vStreakLen = 1.0 + streakStrength * 3.0;
  // 拉长精灵以容纳拖尾：拖尾宽度保持基础宽度，长度随 vStreakLen 拉长
  gl_PointSize = min(gl_PointSize * vStreakLen, 160.0);

  vBaseColor = aColor;
  vDoppler = dopplerVis;
  vBrightness = brightness;
  vAlpha = aBaseAlpha * twinkle * visibility * mix(1.0, 1.55, teachRear);
  vTeachBlend = uTeachBlend;
}
`;

const STARFIELD_FRAGMENT_SHADER = `
varying vec3 vBaseColor;
varying float vDoppler;
varying float vAlpha;
varying float vBrightness;
varying float vTeachBlend;
varying vec2 vStreakDir;
varying float vStreakLen;

uniform float uGlobalBrightness;

vec3 spectralTint(float doppler, float teach) {
  float mapped = clamp(0.5 + mix(0.38, 0.48, teach) * log2(max(doppler, 0.001)), 0.0, 1.0);

  vec3 redShift = mix(vec3(1.0, 0.16, 0.05), vec3(1.0, 0.34, 0.08), teach);
  vec3 neutral = vec3(0.98, 0.96, 0.92);
  vec3 blueShift = mix(vec3(0.42, 0.72, 1.0), vec3(0.38, 0.74, 1.0), teach);

  if (mapped < 0.5) {
    return mix(redShift, neutral, mapped / 0.5);
  }
  return mix(neutral, blueShift, (mapped - 0.5) / 0.5);
}

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  // 沿流动方向拉伸：uv 分解为沿 vStreakDir 与垂直分量，沿方向拉长 vStreakLen 倍
  float along = dot(uv, vStreakDir);
  float across = dot(uv, vec2(-vStreakDir.y, vStreakDir.x));
  // 椭圆拖尾：沿流动方向拉长 vStreakLen 倍、宽度保持基础宽度（配合顶点侧放大精灵）
  float r2 = (along * along) + (across * across) * (vStreakLen * vStreakLen);
  if (r2 > 1.0) discard;

  float core = exp(-5.0 * r2);
  float rearAmt = 1.0 - smoothstep(0.42, 1.05, vDoppler);
  float teachRear = vTeachBlend * rearAmt;
  float halo = exp(-1.15 * r2) * mix(0.42, mix(0.55, 0.75, teachRear), vTeachBlend);
  float sprite = core + halo;

  float shiftAmount = smoothstep(0.0, mix(0.85, 0.42, vTeachBlend), abs(log2(max(vDoppler, 0.001))));
  vec3 tint = spectralTint(vDoppler, vTeachBlend);
  vec3 shiftedColor = mix(vBaseColor, tint, mix(0.88, 0.96, vTeachBlend) * shiftAmount);

  float redGate = mix(0.9, 1.12, vTeachBlend);
  if (vDoppler < redGate) {
    float redBoost = smoothstep(redGate, mix(0.08, 0.22, vTeachBlend), vDoppler);
    shiftedColor = mix(shiftedColor, vec3(1.0, 0.30, 0.06), redBoost * mix(0.65, 0.92, vTeachBlend));
  }

  float alpha = clamp(vAlpha * sprite * mix(1.45, 1.85, teachRear), 0.0, 1.0);
  vec3 color = shiftedColor * mix(0.85, vBrightness, 0.72);
  color *= (0.7 + core * 0.3);
  color = mix(color, color * vec3(1.15, 0.55, 0.22), teachRear * 0.35);

  gl_FragColor = vec4(color * uGlobalBrightness, alpha);
}
`;

export class StarField {
  constructor({ count = 72000, radius = 5000 } = {}) {
    this.count = count;
    this.fixedRadius = radius; 
    this.container = new THREE.Group();
    this._velocityDir = new THREE.Vector3(0, 0, -1);
    this._effectTarget = { aberrationExp: 1.06, dopplerGain: 1.0, teachBlend: 1 };
    this._effectCurrent = { aberrationExp: 1.06, dopplerGain: 1.0, teachBlend: 1 };
    this._buildPointCloud();
  }

  _buildPointCloud() {
    const positions = new Float32Array(this.count * 3);
    const colors = new Float32Array(this.count * 3);
    const baseSizes = new Float32Array(this.count);
    const baseAlphas = new Float32Array(this.count);
    const twinklePhase = new Float32Array(this.count);
    const twinkleSpeed = new Float32Array(this.count);
    const twinkleAmp = new Float32Array(this.count);
    const streamPhase = new Float32Array(this.count);
    const streamSpeed = new Float32Array(this.count);

    for (let i = 0; i < this.count; i++) {
      const dir = generateRealisticStarDirection();
      
      positions[i * 3] = dir.x * this.fixedRadius;
      positions[i * 3 + 1] = dir.y * this.fixedRadius;
      positions[i * 3 + 2] = dir.z * this.fixedRadius;

      const size = starSize();
      const color = starColor();

      colors[i * 3] = color[0];
      colors[i * 3 + 1] = color[1];
      colors[i * 3 + 2] = color[2];

      const centerFactor = Math.max(0, dir.dot(GALACTIC_CENTER));

      baseSizes[i] = size;
      baseAlphas[i] = starAlpha(size, centerFactor);
      twinklePhase[i] = Math.random() * Math.PI * 2;
      twinkleSpeed[i] = 0.3 + Math.random() * 1.5;
      twinkleAmp[i] = 0.02 + Math.random() * 0.04;
      streamPhase[i] = Math.random();
      streamSpeed[i] = 0.3 + Math.random() * 0.9;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aBaseSize', new THREE.BufferAttribute(baseSizes, 1));
    geometry.setAttribute('aBaseAlpha', new THREE.BufferAttribute(baseAlphas, 1));
    geometry.setAttribute('aTwinklePhase', new THREE.BufferAttribute(twinklePhase, 1));
    geometry.setAttribute('aTwinkleSpeed', new THREE.BufferAttribute(twinkleSpeed, 1));
    geometry.setAttribute('aTwinkleAmp', new THREE.BufferAttribute(twinkleAmp, 1));
    geometry.setAttribute('aStreamPhase', new THREE.BufferAttribute(streamPhase, 1));
    geometry.setAttribute('aStreamSpeed', new THREE.BufferAttribute(streamSpeed, 1));
    geometry.computeBoundingSphere();

    this.material = new THREE.ShaderMaterial({
      vertexShader: STARFIELD_VERTEX_SHADER,
      fragmentShader: STARFIELD_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false, 
      depthTest: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uBeta: { value: 0.0001 }, 
        uVelocityDir: { value: this._velocityDir.clone() },
        uTime: { value: 0 },
        uPixelRatio: { value: 1 },
        uPointScale: { value: 1.5 },
        uAberrationExp: { value: 1.06 },
        uDopplerGain: { value: 1.0 },
        uTeachBlend: { value: 1 },
        uStreamMax: { value: 2.0 },
        uWarp: { value: 0.55 },
        uStreamSpeed: { value: 0.35 },
        uGlobalBrightness: { value: 0.55 }
      }
    });

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false; 
    this.container.add(this.points);
  }

  setRelativisticState(beta, velocityDir) {
    this.material.uniforms.uBeta.value = THREE.MathUtils.clamp(beta, 0.0001, 0.999);
    if (velocityDir && velocityDir.lengthSq() > 0.000001) {
      this._velocityDir.copy(velocityDir).normalize();
      this.material.uniforms.uVelocityDir.value.copy(this._velocityDir);
    }
  }

  setEffectMode(mode) {
    if (mode === 'teaching') {
      this._effectTarget.aberrationExp = 1.06;
      this._effectTarget.dopplerGain = 1.0;
      this._effectTarget.teachBlend = 1;
    } else {
      this._effectTarget.aberrationExp = 1.0;
      this._effectTarget.dopplerGain = 1.0;
      this._effectTarget.teachBlend = 0;
    }
  }

  applyAberration(beta) {
    this.setRelativisticState(beta, this._velocityDir);
  }

  resetAberration() {
    this.setRelativisticState(0.0001, this._velocityDir);
  }

  addTo(scene) {
    scene.add(this.container);
  }

  setCenter(x, y, z) {
    this.container.position.set(x, y, z);
  }

  update(dt) {
    this.material.uniforms.uTime.value = performance.now() * 0.001;
    this.material.uniforms.uPixelRatio.value = Math.min(2, window.devicePixelRatio || 1);

    const k = 1 - Math.exp(-8 * Math.max(0.001, dt || 0.016));
    this._effectCurrent.aberrationExp += (this._effectTarget.aberrationExp - this._effectCurrent.aberrationExp) * k;
    this._effectCurrent.dopplerGain += (this._effectTarget.dopplerGain - this._effectCurrent.dopplerGain) * k;
    this._effectCurrent.teachBlend += (this._effectTarget.teachBlend - this._effectCurrent.teachBlend) * k;
    this.material.uniforms.uAberrationExp.value = this._effectCurrent.aberrationExp;
    this.material.uniforms.uDopplerGain.value = this._effectCurrent.dopplerGain;
    this.material.uniforms.uTeachBlend.value = this._effectCurrent.teachBlend;
  }
}