import * as THREE from 'three';

/**
 * SolarSystem — complete educational-scale solar system.
 * Planet sizes and orbits are scaled 100× from the base for visual prominence.
 * All 8 planets have detailed procedural textures.
 */

// ── Planet scientific data ──────────────────────────────────────────────────
export const PLANET_INFO = {
  Mercury: {
    nameCN: '水星', nameEN: 'Mercury', type: '岩石行星 (Rocky)',
    diameter: '4,879 km', distSun: '5790 万 km (0.39 AU)', orbitalPeriod: '88 天',
    temperature: '-180°C ~ 430°C', moons: '0',
    fact: '水星是太阳系中最小的行星，也是距离太阳最近的行星，几乎没有大气层。',
    color: '#b0ada6'
  },
  Venus: {
    nameCN: '金星', nameEN: 'Venus', type: '岩石行星 (Rocky)',
    diameter: '12,104 km', distSun: '1.08 亿 km (0.72 AU)', orbitalPeriod: '225 天',
    temperature: '462°C (平均)', moons: '0',
    fact: '金星是太阳系中最热的行星，浓厚的二氧化碳大气层造成了极端的温室效应。',
    color: '#e8d5a3'
  },
  Earth: {
    nameCN: '地球', nameEN: 'Earth', type: '岩石行星 (Rocky)',
    diameter: '12,742 km', distSun: '1.496 亿 km (1 AU)', orbitalPeriod: '365.25 天',
    temperature: '-89°C ~ 57°C', moons: '1',
    fact: '地球是已知唯一存在生命的天体，拥有液态水和适宜的大气层。',
    color: '#4488ff'
  },
  Mars: {
    nameCN: '火星', nameEN: 'Mars', type: '岩石行星 (Rocky)',
    diameter: '6,779 km', distSun: '2.279 亿 km (1.52 AU)', orbitalPeriod: '687 天',
    temperature: '-140°C ~ 20°C', moons: '2 (Phobos, Deimos)',
    fact: '火星因其表面氧化铁而呈现红色，拥有太阳系中最大的火山——奥林帕斯山。',
    color: '#e0553d'
  },
  Jupiter: {
    nameCN: '木星', nameEN: 'Jupiter', type: '气态巨行星 (Gas Giant)',
    diameter: '139,820 km', distSun: '7.786 亿 km (5.2 AU)', orbitalPeriod: '11.86 年',
    temperature: '-108°C (云顶)', moons: '95+',
    fact: '木星是太阳系中最大的行星，大红斑是一个持续数百年的巨型风暴。',
    color: '#d4b896'
  },
  Saturn: {
    nameCN: '土星', nameEN: 'Saturn', type: '气态巨行星 (Gas Giant)',
    diameter: '116,460 km', distSun: '14.34 亿 km (9.54 AU)', orbitalPeriod: '29.46 年',
    temperature: '-139°C (云顶)', moons: '146+',
    fact: '土星以壮观的环系统闻名，主要由冰碎片、岩石碎片和尘埃组成。',
    color: '#e8d5a0'
  },
  Uranus: {
    nameCN: '天王星', nameEN: 'Uranus', type: '冰巨行星 (Ice Giant)',
    diameter: '50,724 km', distSun: '28.71 亿 km (19.2 AU)', orbitalPeriod: '84.01 年',
    temperature: '-197°C (云顶)', moons: '27',
    fact: '天王星的自转轴几乎平躺在公转平面上（倾斜约 98°），像一个滚动的球。',
    color: '#88ccdd'
  },
  Neptune: {
    nameCN: '海王星', nameEN: 'Neptune', type: '冰巨行星 (Ice Giant)',
    diameter: '49,244 km', distSun: '44.95 亿 km (30.05 AU)', orbitalPeriod: '164.8 年',
    temperature: '-201°C (云顶)', moons: '16',
    fact: '海王星是太阳系中风速最快的行星，风速可达 2,100 km/h。',
    color: '#3366cc'
  }
};

const SCALE = 100;

// Base orbit speed: Earth completes one orbit in 2π / 0.0172 ≈ 365.25 seconds
const BASE_ORBIT_SPEED = 2 * Math.PI / 365.25;  // ≈ 0.01720

// Real orbital speeds relative to Earth (Earth = 1.0).
// Derived from orbital periods: speed ∝ 1/period.
const RELATIVE_SPEEDS = {
  Mercury: 365.25 / 88,      // 4.152
  Venus:   365.25 / 225,     // 1.623
  Earth:   1.0,
  Mars:    365.25 / 687,     // 0.532
  Jupiter: 1 / 11.86,        // 0.0843
  Saturn:  1 / 29.46,        // 0.0339
  Uranus:  1 / 84.01,        // 0.0119
  Neptune: 1 / 164.8         // 0.00607
};

export class SolarSystem {
  constructor() {
    this.group = new THREE.Group();
    this.planets = [];
    this.orbits = [];
    this.labels = [];
    this.moon = null;        // Moon reference for animation

    this._createSun();
    this._createPlanets();
    this._createMoon();
    this._createOrbits();
    this._createLabels();
  }

  // ── Sun ────────────────────────────────────────────────────────────────────

  _createSun() {
    const sunGroup = new THREE.Group();
    const R = 1.2 * SCALE;  // 120

    // Main sphere — use a canvas texture for granular surface
    const sunTex = this._generateSunTexture();
    const sunGeo = new THREE.SphereGeometry(R, 64, 32);
    const sunMat = new THREE.MeshBasicMaterial({ map: sunTex });
    const sunCore = new THREE.Mesh(sunGeo, sunMat);
    sunGroup.add(sunCore);

    // Inner glow
    const glowGeo1 = new THREE.SphereGeometry(R * 1.12, 48, 24);
    const glowMat1 = new THREE.MeshBasicMaterial({
      color: 0xffcc44, transparent: true, opacity: 0.2, depthWrite: false
    });
    sunGroup.add(new THREE.Mesh(glowGeo1, glowMat1));

    // Outer glow
    const glowGeo2 = new THREE.SphereGeometry(R * 1.35, 32, 16);
    const glowMat2 = new THREE.MeshBasicMaterial({
      color: 0xff9922, transparent: true, opacity: 0.08, depthWrite: false
    });
    sunGroup.add(new THREE.Mesh(glowGeo2, glowMat2));

    // Corona sprites
    for (let i = 0; i < 3; i++) {
      const sprite = this._makeGlowSprite(0xffcc66, (3.0 + i * 1.2) * SCALE, 0.12 - i * 0.03);
      sunGroup.add(sprite);
    }

    // No point lights — planets are lit by ambient only (no bright/dark side)

    sunGroup.position.set(0, 0, 0);
    this.sunGroup = sunGroup;
    this.group.add(sunGroup);
  }

  _generateSunTexture() {
    const w = 1024, h = 512;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');

    // ── Base: multi-stop radial gradient with limb darkening ──────────────────
    const baseGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    baseGrad.addColorStop(0,    '#fffde8');  // bright core
    baseGrad.addColorStop(0.08, '#fff8c0');
    baseGrad.addColorStop(0.2,  '#ffe898');
    baseGrad.addColorStop(0.35, '#ffc840');
    baseGrad.addColorStop(0.5,  '#ffaa20');
    baseGrad.addColorStop(0.65, '#ff8810');
    baseGrad.addColorStop(0.8,  '#ee6600');
    baseGrad.addColorStop(0.92, '#cc4400');
    baseGrad.addColorStop(1.0,  '#993300');  // dark limb
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, w, h);

    // ── Multi-octave granulation (photosphere convection cells) ──────────────
    // Octave 1 — fine grain (~2000 tiny bright/dark cells)
    for (let i = 0; i < 2000; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = Math.random() * 3 + 0.5;
      const bright = Math.random() > 0.45;
      const alpha = Math.random() * 0.15;
      ctx.fillStyle = bright
        ? `rgba(255,255,230,${alpha})`
        : `rgba(220,160,30,${alpha})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    // Octave 2 — medium granulation cells (~400)
    for (let i = 0; i < 400; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = Math.random() * 7 + 2;
      const bright = Math.random() > 0.4;
      const alpha = Math.random() * 0.18;
      ctx.fillStyle = bright
        ? `rgba(255,250,210,${alpha})`
        : `rgba(200,130,30,${alpha})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    // Octave 3 — large supergranulation (~60 cells)
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = Math.random() * 18 + 6;
      const alpha = Math.random() * 0.1;
      ctx.fillStyle = `rgba(255,245,200,${alpha})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    // ── Faculae (bright patches, often near sunspots) ────────────────────────
    const faculaeSeeds = [];
    for (let i = 0; i < 12; i++) {
      const fx = Math.random() * w * 0.6 + w * 0.2;
      const fy = Math.random() * h * 0.5 + h * 0.25;
      faculaeSeeds.push({ x: fx, y: fy });
      const fGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, Math.random() * 20 + 8);
      fGrad.addColorStop(0, 'rgba(255,255,240,0.25)');
      fGrad.addColorStop(0.5, 'rgba(255,250,220,0.1)');
      fGrad.addColorStop(1, 'rgba(255,200,100,0)');
      ctx.fillStyle = fGrad;
      ctx.beginPath(); ctx.arc(fx, fy, 25, 0, Math.PI * 2); ctx.fill();
    }

    // ── Sunspots with umbra (dark core) + penumbra (gray outer ring) ─────────
    const spots = [];
    for (let i = 0; i < 15; i++) {
      const sx = Math.random() * w * 0.65 + w * 0.175;
      const sy = Math.random() * h * 0.55 + h * 0.225;
      const sr = Math.random() * 16 + 5;
      spots.push({ x: sx, y: sy, r: sr });

      // Penumbra (outer — dark brown/gray ring)
      const penGrad = ctx.createRadialGradient(sx, sy, sr * 0.55, sx, sy, sr * 1.15);
      penGrad.addColorStop(0, 'rgba(100,50,15,0.55)');
      penGrad.addColorStop(0.6, 'rgba(130,70,25,0.35)');
      penGrad.addColorStop(1, 'rgba(180,120,60,0)');
      ctx.fillStyle = penGrad;
      ctx.beginPath(); ctx.arc(sx, sy, sr * 1.15, 0, Math.PI * 2); ctx.fill();

      // Umbra (inner — nearly black core)
      const umbGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 0.55);
      umbGrad.addColorStop(0, 'rgba(30,10,2,0.8)');
      umbGrad.addColorStop(0.7, 'rgba(60,25,5,0.5)');
      umbGrad.addColorStop(1, 'rgba(100,50,15,0)');
      ctx.fillStyle = umbGrad;
      ctx.beginPath(); ctx.arc(sx, sy, sr * 0.55, 0, Math.PI * 2); ctx.fill();
    }

    // ── Sunspot group clusters — several spots close together ─────────────────
    for (let g = 0; g < 4; g++) {
      const gx = Math.random() * w * 0.5 + w * 0.25;
      const gy = Math.random() * h * 0.4 + h * 0.3;
      for (let s = 0; s < 5; s++) {
        const sx = gx + (Math.random() - 0.5) * 30;
        const sy = gy + (Math.random() - 0.5) * 20;
        const sr = Math.random() * 6 + 2;

        const pGrad = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 1.2);
        pGrad.addColorStop(0, 'rgba(80,35,10,0.5)');
        pGrad.addColorStop(0.5, 'rgba(120,60,25,0.3)');
        pGrad.addColorStop(1, 'rgba(180,120,60,0)');
        ctx.fillStyle = pGrad;
        ctx.beginPath(); ctx.arc(sx, sy, sr * 1.2, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = 'rgba(35,12,3,0.7)';
        ctx.beginPath(); ctx.arc(sx, sy, sr * 0.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ── Chromospheric network — subtle bright web across surface ──────────────
    for (let i = 0; i < 300; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.strokeStyle = `rgba(255,250,220,${Math.random() * 0.06})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 20);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _makeGlowSprite(color, scale, opacity) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, `rgba(255,220,100,${opacity})`);
    grad.addColorStop(0.3, `rgba(255,180,40,${opacity * 0.6})`);
    grad.addColorStop(0.7, `rgba(255,120,10,${opacity * 0.1})`);
    grad.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: texture, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(scale, scale, 1);
    return sprite;
  }

  // ── Planets ────────────────────────────────────────────────────────────────

  _createPlanets() {
    const planetDefs = [
      { name: 'Mercury', radius: 0.08, orbit: 2.0, roughness: 0.7, metalness: 0.15,
        texGen: 'mercury', normalStrength: 1.2 },
      { name: 'Venus',   radius: 0.16, orbit: 3.2, roughness: 0.25, metalness: 0.05,
        texGen: 'venus', normalStrength: 0.3 },
      { name: 'Earth',   radius: 0.17, orbit: 4.6, roughness: 0.4, metalness: 0.05,
        texGen: 'earth', hasAtmo: true, normalStrength: 0.4 },
      { name: 'Mars',    radius: 0.10, orbit: 6.0, roughness: 0.65, metalness: 0.1,
        texGen: 'mars', normalStrength: 1.0 },
      { name: 'Jupiter', radius: 0.48, orbit: 8.5, roughness: 0.45, metalness: 0.05,
        texGen: 'jupiter' },
      { name: 'Saturn',  radius: 0.40, orbit: 11.0, roughness: 0.35, metalness: 0.05,
        texGen: 'saturn', hasRings: true },
      { name: 'Uranus',  radius: 0.26, orbit: 13.8, roughness: 0.25, metalness: 0.05,
        texGen: 'uranus', tilt: Math.PI / 2 * 0.85 },
      { name: 'Neptune', radius: 0.25, orbit: 16.2, roughness: 0.25, metalness: 0.05,
        texGen: 'neptune', normalStrength: 0.4 }
    ];

    for (const def of planetDefs) {
      const planetGroup = new THREE.Group();
      planetGroup.name = def.name;

      const r = def.radius * SCALE;
      const orbitR = def.orbit * SCALE;

      // Map texGen name to generator method
      const texGenMap = {
        mercury: '_generateMercuryTexture', venus: '_generateVenusTexture',
        earth: '_generateEarthTexture', mars: '_generateMarsTexture',
        jupiter: '_generateJupiterTexture', saturn: '_generateSaturnTexture',
        uranus: '_generateUranusTexture', neptune: '_generateNeptuneTexture'
      };
      const texFnName = texGenMap[def.texGen];
      const texFn = texFnName ? this[texFnName] : null;
      // Generate realistic texture (returns CanvasTexture or {albedo, canvas})
      const texResult = typeof texFn === 'function' ? texFn.call(this) : null;
      const map = texResult && texResult.albedo ? texResult.albedo : texResult;
      const srcCanvas = texResult && texResult.canvas ? texResult.canvas : null;

      const mat = new THREE.MeshStandardMaterial({
        map: map,
        roughness: def.roughness,
        metalness: def.metalness
      });

      // Generate normal map from albedo canvas for rocky planets
      if (srcCanvas && def.normalStrength) {
        mat.normalMap = this._generateNormalMap(srcCanvas, def.normalStrength);
        mat.normalScale = new THREE.Vector2(def.normalStrength * 0.6, def.normalStrength * 0.6);
      }

      const geo = new THREE.SphereGeometry(r, 64, 32);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      planetGroup.add(mesh);

      // Atmosphere for Earth
      if (def.hasAtmo) {
        const atmoGeo = new THREE.SphereGeometry(r * 1.08, 48, 24);
        const atmoMat = new THREE.MeshBasicMaterial({
          color: 0x88bbff, transparent: true, opacity: 0.12, depthWrite: false
        });
        planetGroup.add(new THREE.Mesh(atmoGeo, atmoMat));

        // Separate ocean mesh — slightly smaller, high specular for water highlights
        const oceanGeo = new THREE.SphereGeometry(r * 1.005, 48, 24);
        const oceanMat = new THREE.MeshStandardMaterial({
          color: 0x2255aa, roughness: 0.08, metalness: 0.15, transparent: true,
          opacity: 0.55, depthWrite: false
        });
        this._earthOceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
        planetGroup.add(this._earthOceanMesh);
      }

      // Venus cloud shell — thick sulfuric haze as separate animated mesh
      if (def.name === 'Venus') {
        const cloudGeo = new THREE.SphereGeometry(r * 1.06, 48, 24);
        const cloudTex = this._generateVenusCloudTexture();
        const cloudMat = new THREE.MeshBasicMaterial({
          map: cloudTex, transparent: true, opacity: 0.55, depthWrite: false
        });
        this._venusCloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
        planetGroup.add(this._venusCloudMesh);
      }

      // Saturn's rings
      if (def.hasRings) {
        const ringGeo = new THREE.RingGeometry(r * 1.4, r * 2.2, 128);
        const ringTex = this._generateRingTexture();
        const ringMat = new THREE.MeshBasicMaterial({
          map: ringTex, side: THREE.DoubleSide, transparent: true,
          opacity: 0.7, depthWrite: false
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.rotation.y = 0.4;
        planetGroup.add(ring);

        const ring2Geo = new THREE.RingGeometry(r * 1.55, r * 1.9, 128);
        const ring2Mat = new THREE.MeshBasicMaterial({
          color: 0xddcc88, side: THREE.DoubleSide, transparent: true,
          opacity: 0.3, depthWrite: false
        });
        const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
        ring2.rotation.x = -Math.PI / 2;
        ring2.rotation.y = 0.4;
        planetGroup.add(ring2);
      }

      // Uranus tilt
      if (def.tilt) {
        planetGroup.rotation.z = def.tilt;
      }

      // Random starting orbital angle
      const startAngle = Math.random() * Math.PI * 2;
      planetGroup.position.set(
        Math.cos(startAngle) * orbitR, 0, Math.sin(startAngle) * orbitR
      );

      this.group.add(planetGroup);
      this.planets.push({
        group: planetGroup, mesh,
        orbitRadius: orbitR, speed: RELATIVE_SPEEDS[def.name],
        angle: startAngle, name: def.name, def
      });

      // Store references for animation
      if (def.name === 'Jupiter') this._jupiterMesh = mesh;
      if (def.name === 'Earth' && this._earthOceanMesh) {
        // earthOceanMesh already added to planetGroup above
      }
    }
  }

  // ── Procedural textures (realistic) ────────────────────────────────────────

  /** Mercury — grey desaturated basalt, dense small craters, sharp shadows */
  _generateMercuryTexture() {
    const w = 1024, h = 512;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');

    // Base desaturated grey basalt
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#b5b2ab'); grad.addColorStop(0.3, '#a8a59e');
    grad.addColorStop(0.5, '#b8b5ae'); grad.addColorStop(0.7, '#a09d96');
    grad.addColorStop(1, '#b0ada6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Maria (darker basaltic patches) — more numerous
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const rx = Math.random() * 100 + 35, ry = Math.random() * 55 + 20;
      ctx.fillStyle = `rgba(105,102,96,0.25)`;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2); ctx.fill();
    }

    // Dense small craters — ~450, with rim highlights and inner shadows
    for (let i = 0; i < 450; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const r = Math.random() * 7 + 1.5;
      // Bright rim (sunlit side)
      ctx.strokeStyle = 'rgba(215,210,200,0.75)';
      ctx.lineWidth = Math.random() * 1.2 + 0.4;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      // Shadow inside (dark side of rim)
      ctx.fillStyle = 'rgba(130,125,115,0.35)';
      ctx.beginPath(); ctx.arc(x - r * 0.12, y - r * 0.12, r * 0.72, 0, Math.PI * 2); ctx.fill();
    }

    // Large prominent craters with central peaks
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const r = Math.random() * 22 + 8;
      // Outer rim
      ctx.strokeStyle = 'rgba(200,195,185,0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      // Inner floor
      ctx.fillStyle = 'rgba(175,170,160,0.3)';
      ctx.beginPath(); ctx.arc(x, y, r * 0.82, 0, Math.PI * 2); ctx.fill();
      // Central peak
      if (Math.random() > 0.4) {
        ctx.fillStyle = 'rgba(210,205,195,0.45)';
        ctx.beginPath(); ctx.arc(x + r * 0.05, y + r * 0.03, r * 0.22, 0, Math.PI * 2); ctx.fill();
      }
      // Ray system for some craters
      if (Math.random() > 0.6) {
        for (let j = 0; j < 8; j++) {
          const angle = (j / 8) * Math.PI * 2 + Math.random() * 0.3;
          const rayLen = r * (2 + Math.random() * 3);
          ctx.strokeStyle = 'rgba(220,215,205,0.2)';
          ctx.lineWidth = Math.random() * 2 + 0.5;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(angle) * rayLen, y + Math.sin(angle) * rayLen);
          ctx.stroke();
        }
      }
    }

    // Scarps (linear cliff features)
    for (let i = 0; i < 5; i++) {
      const sx = Math.random() * w * 0.6 + w * 0.2;
      const sy = Math.random() * h * 0.5 + h * 0.25;
      const scarpLen = Math.random() * 120 + 40;
      const scarpAngle = Math.random() * Math.PI;
      ctx.strokeStyle = 'rgba(140,135,125,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      for (let t = 0; t < scarpLen; t += 8) {
        ctx.lineTo(sx + Math.cos(scarpAngle) * t + Math.sin(t * 0.1) * 6,
                   sy + Math.sin(scarpAngle) * t + Math.cos(t * 0.08) * 4);
      }
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return { albedo: tex, canvas: c };
  }

  /** Venus — yellow-orange sulfuric haze with emissive lava cracks */
  _generateVenusTexture() {
    const w = 1024, h = 512;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');

    // Base yellow-orange haze gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#f2e2c4'); grad.addColorStop(0.2, '#e8d5a3');
    grad.addColorStop(0.5, '#f4e4bc'); grad.addColorStop(0.8, '#e5d0a0');
    grad.addColorStop(1, '#eedcb4');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Sulfuric cloud bands — coherent sine-wave patterns
    for (let y = 0; y < h; y += 1) {
      const alpha = 0.03 + Math.abs(Math.sin(y * 0.035)) * 0.07 + Math.abs(Math.sin(y * 0.09 + 2.3)) * 0.04;
      if (alpha > 0.04) {
        ctx.fillStyle = `rgba(255,242,215,${alpha})`;
        ctx.fillRect(0, y, w, 1);
      }
    }

    // Cloud swirl cells
    for (let i = 0; i < 50; i++) {
      const cx = Math.random() * w, cy = Math.random() * h;
      const r = Math.random() * 30 + 10;
      ctx.strokeStyle = `rgba(255,245,222,0.1)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.08) {
        const rr = r + Math.sin(a * 5.5) * r * 0.35;
        const px = cx + Math.cos(a) * rr;
        const py = cy + Math.sin(a) * rr * 0.5;
        a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Lava crack network — sparse branching emissive lines
    const drawLavaBranch = (sx, sy, angle, length, depth) => {
      if (depth <= 0 || length < 3) return;
      ctx.strokeStyle = `rgba(255,120,30,${0.25 + depth * 0.12})`;
      ctx.lineWidth = depth * 0.7 + 0.3;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      let cx = sx, cy = sy;
      for (let t = 0; t < length; t += 4) {
        const wobble = Math.sin(t * 0.15) * 4;
        cx += Math.cos(angle) * 4 + Math.cos(angle + Math.PI / 2) * wobble * 0.1;
        cy += Math.sin(angle) * 4 + Math.sin(angle + Math.PI / 2) * wobble * 0.1;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      // Branch
      if (Math.random() > 0.4) {
        drawLavaBranch(cx, cy, angle + (Math.random() - 0.5) * 1.2, length * 0.55, depth - 1);
      }
      if (Math.random() > 0.55) {
        drawLavaBranch(cx - length * 0.3, cy - length * 0.3, angle - (Math.random() - 0.5) * 1.0, length * 0.45, depth - 1);
      }
    };

    for (let i = 0; i < 12; i++) {
      const sx = Math.random() * w * 0.7 + w * 0.15;
      const sy = Math.random() * h * 0.6 + h * 0.2;
      drawLavaBranch(sx, sy, Math.random() * Math.PI * 2, Math.random() * 40 + 15, 3);
    }

    // Bright lava glow spots at crack intersections
    for (let i = 0; i < 25; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const r = Math.random() * 2.5 + 0.8;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
      glow.addColorStop(0, 'rgba(255,180,60,0.5)');
      glow.addColorStop(0.5, 'rgba(255,120,30,0.2)');
      glow.addColorStop(1, 'rgba(255,80,10,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(x, y, r * 2, 0, Math.PI * 2); ctx.fill();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return { albedo: tex, canvas: c };
  }

  /** Earth — realistic continent shapes with interior terrain detail */
  _generateEarthTexture() {
    const w = 1024, h = 512;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');

    // ── Utility: draw a filled polygon from vertex array ──────────────────────
    const drawPoly = (verts, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(verts[0][0], verts[0][1]);
      for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i][0], verts[i][1]);
      ctx.closePath();
      ctx.fill();
    };

    // ── Utility: draw a filled ellipse ────────────────────────────────────────
    const drawEllipse = (cx, cy, rx, ry, color, rot = 0) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();
    };

    // ── Utility: draw with coastal noise along outline ─────────────────────────
    const drawWithCoastNoise = (verts, color, noiseScale = 3) => {
      // Blurred outline for anti-aliased edge
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(verts[0][0], verts[0][1]);
      for (let i = 1; i < verts.length; i++) {
        ctx.lineTo(verts[i][0], verts[i][1]);
      }
      ctx.closePath();
      ctx.fill();

      // Draw subtle edge noise along borders
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(verts[0][0], verts[0][1]);
      for (let i = 1; i < verts.length; i++) {
        ctx.lineTo(verts[i][0], verts[i][1]);
      }
      ctx.closePath();
      ctx.clip();

      // Interior detail noise
      for (let i = 0; i < 600; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const alpha = Math.random() * 0.08;
        const r = Math.random() * 4 + 1;
        ctx.fillStyle = Math.random() > 0.5
          ? `rgba(255,255,255,${alpha})`
          : `rgba(0,0,0,${alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // OCEAN BASE
    // ═══════════════════════════════════════════════════════════════════════════
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, h);
    oceanGrad.addColorStop(0, '#1a5588');
    oceanGrad.addColorStop(0.2, '#1d5e99');
    oceanGrad.addColorStop(0.5, '#256cb0');
    oceanGrad.addColorStop(0.8, '#1d5e99');
    oceanGrad.addColorStop(1, '#1a5588');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, w, h);

    // ═══════════════════════════════════════════════════════════════════════════
    // CONTINENTS — carefully plotted equirectangular outlines
    // x: 0=180°W(Greenwich-180), 512=0°(Greenwich), 1024=180°E
    // y: 0=90°N, 256=Equator, 512=90°S
    // ═══════════════════════════════════════════════════════════════════════════

    // ── NORTH AMERICA ─────────────────────────────────────────────────────────
    const northAmerica = [
      // Alaska / Arctic coast
      [36, 28], [58, 22], [82, 20], [108, 18], [130, 20], [150, 28],
      [165, 36], [178, 44], [186, 52], [190, 68],
      // Hudson Bay indent
      [180, 72], [168, 65], [158, 60],
      // Eastern Canada / Labrador
      [195, 52], [215, 38], [235, 32], [255, 36], [268, 42], [275, 52],
      // US East Coast
      [278, 62], [272, 73], [260, 84], [252, 92], [240, 98],
      // Florida / Gulf of Mexico
      [235, 102], [228, 108], [222, 114], [210, 118], [198, 116],
      [188, 108], [178, 100], [170, 106], [160, 112], [150, 118],
      // Central America
      [148, 125], [155, 132], [150, 138],
      // Mexico
      [142, 130], [132, 122], [120, 114], [108, 106], [100, 100],
      [90, 94], [80, 88], [68, 80], [56, 72],
      // Baja / California
      [52, 64], [48, 56], [44, 46], [38, 38],
    ];
    drawWithCoastNoise(northAmerica, '#5a8a3c');

    // Interior highlight (lighter green — plains / farmland)
    const naInterior = [
      [80, 40], [110, 34], [140, 38], [170, 44], [180, 55],
      [170, 58], [160, 56], [150, 52], [140, 55], [130, 62],
      [120, 68], [140, 72], [170, 66], [200, 58], [225, 48],
      [245, 46], [255, 55], [250, 65], [235, 72], [210, 78],
      [180, 82], [158, 80], [148, 75], [135, 72], [118, 68],
      [105, 60], [90, 52], [82, 45],
    ];
    drawPoly(naInterior, '#6e9e4c');

    // Canadian Shield (darker)
    drawEllipse(160, 52, 55, 28, '#4a7a30', 0.3);
    // US Midwest (lighter green / yellow-green)
    drawEllipse(195, 64, 35, 18, '#7a9e44', 0);
    // Mexico highlands (drier)
    drawEllipse(155, 108, 30, 16, '#8a8a40', 0.3);

    // ── GREENLAND ─────────────────────────────────────────────────────────────
    const greenland = [
      [288, 14], [305, 10], [320, 12], [332, 18], [336, 28],
      [330, 38], [318, 44], [300, 42], [288, 36], [280, 26], [282, 18],
    ];
    drawWithCoastNoise(greenland, '#e8ecef');
    drawEllipse(310, 28, 18, 12, '#f0f4f6', 0);

    // ── SOUTH AMERICA ─────────────────────────────────────────────────────────
    const southAmerica = [
      // North coast (Venezuela/Colombia)
      [155, 118], [170, 114], [190, 112], [210, 116], [228, 120], [238, 128],
      // Brazil east bulge
      [246, 136], [250, 148], [244, 158], [236, 164],
      // Southern cone (Argentina)
      [228, 172], [220, 180], [212, 190], [208, 200], [200, 208],
      // Chile coast
      [194, 204], [188, 194], [184, 184], [180, 174], [176, 164],
      // Peru/Ecuador
      [172, 152], [168, 140], [164, 130], [160, 122],
    ];
    drawWithCoastNoise(southAmerica, '#4a8a2a');

    // Amazon basin (dark green)
    drawEllipse(208, 140, 36, 22, '#2d7020', 0.1);
    // Brazilian highlands (lighter)
    drawEllipse(230, 150, 18, 12, '#6a9440', 0);
    // Andes spine (brownish)
    drawEllipse(178, 152, 12, 50, '#8a7a50', 0.1);
    // Patagonia (drier)
    drawEllipse(210, 190, 18, 20, '#8a8450', 0);

    // ── EUROPE ────────────────────────────────────────────────────────────────
    const europe = [
      // British Isles
      [448, 42], [455, 38], [462, 42], [460, 50], [452, 52], [444, 48],
      // Scandinavia
      [475, 16], [490, 12], [510, 14], [525, 18], [535, 26],
      [530, 36], [520, 44], [510, 48], [498, 44], [488, 34], [478, 24],
      // Western Europe
      [460, 54], [472, 50], [490, 48], [505, 50], [520, 52],
      [525, 58], [518, 62], [508, 60], [495, 58],
      // Mediterranean coast
      [480, 62], [468, 66], [460, 68], [452, 72], [446, 68], [448, 60],
      // Iberian Peninsula
      [444, 72], [438, 76], [430, 74], [425, 68], [430, 62], [440, 58],
      // Italian peninsula
      [485, 66], [488, 70], [486, 76], [482, 74], [480, 68],
      // Greece / Balkans
      [500, 66], [505, 70], [502, 76], [496, 74], [492, 68],
    ];
    drawWithCoastNoise(europe, '#78a84c');

    // Central European plains
    drawEllipse(485, 52, 38, 14, '#8aae58', 0.1);
    // Alps (darker / higher)
    drawEllipse(478, 62, 14, 6, '#6a8a3e', 0.2);

    // ── AFRICA ────────────────────────────────────────────────────────────────
    const africa = [
      // North coast (Morocco to Egypt)
      [438, 68], [448, 65], [465, 63], [480, 62], [498, 62], [515, 62],
      [530, 64], [542, 66], [550, 70], [555, 76],
      // Horn of Africa
      [560, 82], [562, 90], [558, 96], [550, 98],
      // East Africa
      [542, 108], [538, 120], [535, 132], [532, 142], [528, 150],
      // Southern Africa
      [522, 158], [515, 164], [508, 166], [498, 162], [490, 156],
      // West coast (Angola to Gulf of Guinea)
      [484, 148], [478, 138], [474, 128], [470, 118], [465, 108],
      [458, 98], [452, 88], [445, 80], [440, 74],
    ];
    drawWithCoastNoise(africa, '#84a840');

    // Sahara (desert tan)
    drawEllipse(488, 78, 55, 22, '#c8b870', 0);
    // Sahel (transition zone)
    drawEllipse(488, 96, 50, 10, '#a09848', 0);
    // Congo basin (dark green rainforest)
    drawEllipse(498, 118, 25, 20, '#2d6e1e', 0);
    // East African highlands
    drawEllipse(535, 125, 18, 22, '#7a9040', 0.1);
    // Kalahari / Southern savannah
    drawEllipse(505, 150, 20, 16, '#9a9440', 0);
    // Madagascar
    drawEllipse(558, 142, 5, 14, '#6a9038', 0.1);

    // ── ASIA ──────────────────────────────────────────────────────────────────
    const asia = [
      // Russia (northern coast)
      [538, 22], [570, 16], [610, 14], [660, 12], [710, 14], [750, 18],
      [790, 22], [820, 28], [840, 36], [848, 44],
      // Kamchatka / Russian Far East
      [842, 52], [835, 56], [826, 52], [818, 46],
      // Eastern China coast
      [805, 54], [795, 60], [782, 66], [770, 74], [758, 80],
      // SE Asia (Vietnam, Thailand)
      [750, 84], [742, 92], [735, 98], [728, 106],
      // Malay peninsula
      [720, 112], [715, 118], [710, 122],
      // Indonesia chain (represented as dots)
      // India
      [678, 68], [682, 62], [675, 58], [662, 62], [648, 68],
      [640, 76], [636, 86], [640, 96], [648, 104], [660, 108],
      [672, 106], [682, 98], [686, 88], [684, 78],
      // Middle East
      [560, 64], [570, 64], [582, 66], [595, 68], [610, 70],
      [620, 74], [625, 78], [618, 82], [608, 80], [595, 76],
      [580, 72], [568, 68],
      // Central Asia / Kazakhstan
      [600, 48], [620, 42], [650, 38], [680, 36], [710, 38],
      [735, 44], [720, 52], [700, 54], [670, 52], [640, 50], [610, 50],
    ];
    drawWithCoastNoise(asia, '#6d8a3a');

    // Siberian taiga (dark)
    drawEllipse(680, 30, 110, 20, '#4a7038', 0.1);
    // Central Asian steppe (tan/gold)
    drawEllipse(660, 44, 55, 14, '#b0a858', 0);
    // Gobi desert
    drawEllipse(740, 52, 20, 10, '#c8b868', 0);
    // Chinese plains (green)
    drawEllipse(760, 60, 28, 14, '#7a9a42', 0);
    // India subcontinent (dark green)
    drawEllipse(660, 76, 22, 22, '#408028', 0);
    // Deccan plateau
    drawEllipse(660, 90, 16, 12, '#6a8a38', 0);
    // Arabian peninsula (desert)
    drawEllipse(586, 74, 18, 14, '#d0b868', 0);
    // Persian area
    drawEllipse(605, 68, 14, 10, '#c8b860', 0);

    // ── JAPAN ─────────────────────────────────────────────────────────────────
    drawEllipse(808, 54, 4, 16, '#6a8e3e', 0.15);

    // ── INDONESIA / PHILIPPINES ───────────────────────────────────────────────
    drawEllipse(738, 118, 12, 4, '#5a8a30', 0.2); // Sumatra
    drawEllipse(752, 124, 18, 5, '#5a8830', 0.1); // Borneo
    drawEllipse(772, 122, 10, 4, '#5a8a30', 0);   // Sulawesi
    drawEllipse(768, 132, 5, 14, '#5a8830', 0.2);  // New Guinea (west)
    // Philippines
    drawEllipse(785, 86, 4, 10, '#5a8a30', 0.2);
    drawEllipse(790, 98, 3, 8, '#5a8a30', 0.1);

    // ── AUSTRALIA ─────────────────────────────────────────────────────────────
    const australia = [
      [712, 128], [728, 122], [748, 120], [768, 124], [782, 130],
      [788, 140], [784, 150], [776, 158], [762, 164], [746, 166],
      [730, 162], [718, 156], [710, 148], [706, 138],
    ];
    drawWithCoastNoise(australia, '#c48840');
    // Outback interior
    drawEllipse(748, 142, 32, 18, '#c89848', 0);
    // Eastern ranges
    drawEllipse(780, 140, 8, 28, '#a87838', 0.1);

    // ── NEW ZEALAND ───────────────────────────────────────────────────────────
    drawEllipse(815, 176, 4, 14, '#5a8838', 0.2);
    drawEllipse(818, 184, 3, 8, '#5a8838', 0.15);

    // ── ANTARCTICA ────────────────────────────────────────────────────────────
    ctx.fillStyle = '#f0f4f8';
    ctx.fillRect(0, h - 16, w, 16);
    for (let x = 0; x < w; x += 3) {
      const iceH = 12 + Math.sin(x * 0.025) * 8 + Math.sin(x * 0.06) * 5 + Math.sin(x * 0.12) * 3;
      ctx.fillStyle = 'rgba(238,242,248,0.8)';
      ctx.fillRect(x, h - iceH, 2, iceH);
    }

    // ── ARCTIC ────────────────────────────────────────────────────────────────
    ctx.fillStyle = '#f0f4f6';
    ctx.fillRect(0, 0, w, 8);
    for (let x = 0; x < w; x += 3) {
      const iceH = 5 + Math.sin(x * 0.04) * 5 + Math.sin(x * 0.09) * 3;
      ctx.fillStyle = 'rgba(238,242,246,0.7)';
      ctx.fillRect(x, 0, 2, iceH);
    }
    // Canadian Arctic archipelago
    drawEllipse(140, 14, 20, 6, '#e8ecf2', 0);
    drawEllipse(170, 10, 12, 4, '#e8ecf2', 0);
    // Svalbard
    drawEllipse(500, 10, 6, 3, '#e8ecf2', 0);

    // ── ISLANDS ───────────────────────────────────────────────────────────────
    // Caribbean
    drawEllipse(218, 112, 8, 4, '#6a9038', 0.2);
    drawEllipse(224, 108, 5, 3, '#6a9038', 0.1);
    // Sri Lanka
    drawEllipse(676, 108, 3, 5, '#4a8028', 0);
    // Taiwan
    drawEllipse(792, 70, 3, 5, '#6a8e3e', 0);
    // Hainan
    drawEllipse(770, 78, 3, 3, '#6a8e3e', 0);
    // Iceland
    drawEllipse(430, 28, 6, 4, '#d8e0e0', 0);
    // Falklands
    drawEllipse(208, 208, 3, 3, '#8a8448', 0);

    // ═══════════════════════════════════════════════════════════════════════════
    // MOUNTAIN HIGHLIGHTS (brown/grey ridge lines)
    // ═══════════════════════════════════════════════════════════════════════════
    // Rockies
    for (let i = 0; i < 20; i++) {
      const x = 100 + i * 5 + Math.sin(i * 0.6) * 4;
      const y = 50 + i * 2.2;
      ctx.fillStyle = 'rgba(140,120,90,0.25)';
      ctx.beginPath(); ctx.arc(x, y, 3 + Math.random() * 3, 0, Math.PI * 2); ctx.fill();
    }
    // Andes
    for (let i = 0; i < 30; i++) {
      const x = 180 + Math.sin(i * 0.5) * 8;
      const y = 130 + i * 2.5;
      ctx.fillStyle = 'rgba(140,115,80,0.3)';
      ctx.beginPath(); ctx.arc(x, y, 3 + Math.random() * 3, 0, Math.PI * 2); ctx.fill();
    }
    // Himalayas
    for (let i = 0; i < 12; i++) {
      const x = 645 + i * 3.5;
      const y = 62 + Math.sin(i * 0.8) * 6;
      ctx.fillStyle = 'rgba(150,125,90,0.35)';
      ctx.beginPath(); ctx.arc(x, y, 3 + Math.random() * 3, 0, Math.PI * 2); ctx.fill();
    }
    // Alps
    for (let i = 0; i < 6; i++) {
      const x = 474 + i * 3;
      const y = 60 + Math.sin(i * 0.8) * 3;
      ctx.fillStyle = 'rgba(140,120,90,0.3)';
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CLOUD LAYER — structured atmospheric wisps
    // ═══════════════════════════════════════════════════════════════════════════
    for (let i = 0; i < 150; i++) {
      const cx = Math.random() * w;
      const cy = Math.random() * h;
      const latFrac = cy / h;

      // Avoid dense cloud at equator and poles
      const nearEquator = Math.abs(latFrac - 0.5) < 0.06;
      const nearPoles = Math.abs(latFrac - 0.5) > 0.46;
      if (nearEquator || nearPoles) { if (Math.random() > 0.3) continue; }

      // Prefer mid-latitudes
      const midLat = Math.abs(latFrac - 0.5) > 0.15 && Math.abs(latFrac - 0.5) < 0.44;
      let alpha = midLat ? Math.random() * 0.25 + 0.06 : Math.random() * 0.15 + 0.03;

      const rx = Math.random() * 28 + 5;
      const ry = Math.random() * 5 + 1.5;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, Math.random() * Math.PI * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return { albedo: tex, canvas: c };
  }

  /** Mars — rust red dunes, polar ice cap gradient, canyon ridge details */
  _generateMarsTexture() {
    const w = 1024, h = 512;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');

    // Base red-orange gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#d47050'); grad.addColorStop(0.2, '#e07048');
    grad.addColorStop(0.5, '#d86840'); grad.addColorStop(0.8, '#e87858');
    grad.addColorStop(1, '#d06848');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Dark highland patches
    for (let i = 0; i < 25; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const rx = Math.random() * 60 + 15, ry = Math.random() * 30 + 8;
      ctx.fillStyle = `rgba(140,60,30,0.25)`;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2); ctx.fill();
    }

    // Lighter regions
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const rx = Math.random() * 50 + 10, ry = Math.random() * 25 + 5;
      ctx.fillStyle = `rgba(230,160,120,0.2)`;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2); ctx.fill();
    }

    // Polar ice caps
    ctx.fillStyle = '#f0ece4';
    ctx.fillRect(0, 0, w, 12);
    for (let x = 0; x < w; x += 2) {
      const capH = 8 + Math.sin(x * 0.04) * 6 + Math.sin(x * 0.1) * 3;
      ctx.fillStyle = 'rgba(245,242,235,0.7)';
      ctx.fillRect(x, 0, 2, capH);
    }
    ctx.fillRect(0, h - 10, w, 10);
    for (let x = 0; x < w; x += 2) {
      const capH = 7 + Math.sin(x * 0.04 + 1) * 5;
      ctx.fillStyle = 'rgba(245,242,235,0.65)';
      ctx.fillRect(x, h - capH, 2, capH);
    }

    // Craters
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const r = Math.random() * 6 + 1;
      ctx.strokeStyle = `rgba(180,100,70,0.5)`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(200,120,80,0.2)`;
      ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, Math.PI * 2); ctx.fill();
    }

    // Olympus Mons-like feature
    const ox = w * 0.55, oy = h * 0.4;
    for (let r = 20; r > 0; r -= 3) {
      ctx.strokeStyle = `rgba(200,130,90,0.3)`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(220,150,110,0.2)';
    ctx.beginPath(); ctx.arc(ox, oy, 8, 0, Math.PI * 2); ctx.fill();

    // Valles Marineris — massive canyon system across the equator
    const canyonY = h * 0.52;
    ctx.strokeStyle = 'rgba(100,45,20,0.4)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(w * 0.08, canyonY);
    for (let x = w * 0.08; x < w * 0.55; x += 6) {
      const yOff = Math.sin(x * 0.012) * 8 + Math.sin(x * 0.035) * 5 + Math.sin(x * 0.08) * 3;
      ctx.lineTo(x, canyonY + yOff);
    }
    ctx.stroke();
    // Canyon detail — branching tributaries
    ctx.strokeStyle = 'rgba(110,55,25,0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const bx = w * 0.12 + i * w * 0.05;
      ctx.beginPath();
      ctx.moveTo(bx, canyonY + Math.sin(bx * 0.012) * 8);
      ctx.lineTo(bx + 15, canyonY + 25 + Math.random() * 10);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return { albedo: tex, canvas: c };
  }

  /** Jupiter — detailed bands with Great Red Spot */
  _generateJupiterTexture() {
    const w = 512, h = 256;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');

    // Base tan
    const baseGrad = ctx.createLinearGradient(0, 0, 0, h);
    baseGrad.addColorStop(0, '#d4c0a0'); baseGrad.addColorStop(0.12, '#c8b088');
    baseGrad.addColorStop(0.2, '#e0ccb0'); baseGrad.addColorStop(0.3, '#c4a878');
    baseGrad.addColorStop(0.4, '#dcc8a8'); baseGrad.addColorStop(0.5, '#c8b490');
    baseGrad.addColorStop(0.6, '#d8c4a4'); baseGrad.addColorStop(0.7, '#bc9c6c');
    baseGrad.addColorStop(0.82, '#d4b890'); baseGrad.addColorStop(0.9, '#c8a878');
    baseGrad.addColorStop(1, '#d4c0a0');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, w, h);

    // Horizontal bands — detailed
    for (let y = 0; y < h; y++) {
      const bandNoise = Math.sin(y * 0.3) * 0.06 + Math.sin(y * 0.7) * 0.04
        + Math.sin(y * 1.5) * 0.03 + Math.sin(y * 2.3) * 0.02;
      const alpha = Math.abs(bandNoise) * 1.5;
      if (alpha > 0.02) {
        ctx.fillStyle = bandNoise > 0
          ? `rgba(240,220,180,${alpha})`
          : `rgba(160,120,70,${alpha})`;
        ctx.fillRect(0, y, w, 2);
      }
    }

    // Turbulent band edges
    for (let i = 0; i < 60; i++) {
      const y = Math.random() * h;
      for (let x = 0; x < w; x += 4) {
        const yOff = Math.sin(x * 0.05 + i) * 3;
        ctx.fillStyle = `rgba(200,160,100,0.1)`;
        ctx.fillRect(x, y + yOff, 4, 1);
      }
    }

    // Great Red Spot
    const grsX = w * 0.55, grsY = h * 0.38;
    const grsOuter = ctx.createRadialGradient(grsX, grsY, 0, grsX, grsY, 22);
    grsOuter.addColorStop(0, '#e89070');
    grsOuter.addColorStop(0.5, '#d07858');
    grsOuter.addColorStop(0.8, '#c87050');
    grsOuter.addColorStop(1, 'rgba(200,160,120,0)');
    ctx.fillStyle = grsOuter;
    ctx.beginPath(); ctx.ellipse(grsX, grsY, 28, 14, 0.05, 0, Math.PI * 2); ctx.fill();

    // GRS inner detail
    ctx.fillStyle = '#e8a080';
    ctx.beginPath(); ctx.ellipse(grsX, grsY, 18, 9, 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0c0a0';
    ctx.beginPath(); ctx.ellipse(grsX - 2, grsY - 2, 8, 4, 0.05, 0, Math.PI * 2); ctx.fill();

    // Smaller storms / ovals
    for (let i = 0; i < 5; i++) {
      const sx = Math.random() * w * 0.6 + w * 0.2;
      const sy = Math.random() * h * 0.6 + h * 0.2;
      const sr = Math.random() * 6 + 3;
      ctx.fillStyle = `rgba(240,200,160,0.35)`;
      ctx.beginPath(); ctx.ellipse(sx, sy, sr, sr * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex; // Jupiter: no normal map (gas giant)
  }

  /** Saturn — pale gold with subtle horizontal bands */
  _generateSaturnTexture() {
    const w = 512, h = 256;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');

    // Base pale gold
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#f0e0c0'); grad.addColorStop(0.2, '#e8d5a0');
    grad.addColorStop(0.4, '#f2e4c4'); grad.addColorStop(0.55, '#e8d5a8');
    grad.addColorStop(0.7, '#f0ddb8'); grad.addColorStop(0.85, '#e5d0a0');
    grad.addColorStop(1, '#eedcb0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle horizontal bands
    for (let y = 0; y < h; y += 2) {
      const alpha = 0.04 + Math.abs(Math.sin(y * 0.25)) * 0.06;
      ctx.fillStyle = `rgba(220,200,160,${alpha})`;
      ctx.fillRect(0, y, w, 1);
    }

    // Some band variations
    for (let i = 0; i < 20; i++) {
      const y = Math.random() * h;
      ctx.fillStyle = `rgba(200,180,140,0.06)`;
      ctx.fillRect(0, y, w, Math.random() * 5 + 2);
    }

    // Storm spots (rare on Saturn but visible)
    for (let i = 0; i < 3; i++) {
      const sx = Math.random() * w, sy = Math.random() * h;
      ctx.fillStyle = `rgba(255,250,240,0.2)`;
      ctx.beginPath(); ctx.ellipse(sx, sy, Math.random() * 6 + 2, Math.random() * 3 + 1, 0, 0, Math.PI * 2); ctx.fill();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  /** Saturn's ring texture */
  _generateRingTexture() {
    const w = 512, h = 64;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(200,180,140,0.1)');
    grad.addColorStop(0.12, 'rgba(210,190,150,0.6)');
    grad.addColorStop(0.25, 'rgba(180,160,130,0.3)');
    grad.addColorStop(0.35, 'rgba(220,200,160,0.75)');
    grad.addColorStop(0.5, 'rgba(240,220,180,0.85)');
    grad.addColorStop(0.65, 'rgba(200,180,140,0.55)');
    grad.addColorStop(0.78, 'rgba(190,170,130,0.3)');
    grad.addColorStop(0.9, 'rgba(170,150,110,0.15)');
    grad.addColorStop(1, 'rgba(150,130,90,0.05)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Fine ring lines
    for (let x = 0; x < w; x += 2) {
      const alpha = 0.2 + Math.sin(x * 0.1) * 0.15;
      ctx.fillStyle = `rgba(220,200,160,${alpha})`;
      ctx.fillRect(x, 0, 1, h);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  /** Uranus — pale cyan/blue-green, nearly featureless */
  _generateUranusTexture() {
    const w = 512, h = 256;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#b0ddd8'); grad.addColorStop(0.3, '#a8d8d4');
    grad.addColorStop(0.5, '#b8e0dc'); grad.addColorStop(0.7, '#a0d4d0');
    grad.addColorStop(1, '#acdad6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Very subtle bands
    for (let y = 0; y < h; y += 3) {
      const alpha = 0.02 + Math.abs(Math.sin(y * 0.15)) * 0.03;
      ctx.fillStyle = `rgba(200,240,235,${alpha})`;
      ctx.fillRect(0, y, w, 1);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  /** Neptune — deep blue with subtle cloud streaks */
  _generateNeptuneTexture() {
    const w = 512, h = 256;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');

    // Deep blue gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2848b0'); grad.addColorStop(0.25, '#3058c0');
    grad.addColorStop(0.5, '#3868d0'); grad.addColorStop(0.75, '#3058c0');
    grad.addColorStop(1, '#2848b0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle lighter bands
    for (let i = 0; i < 15; i++) {
      const y = Math.random() * h;
      ctx.fillStyle = `rgba(80,140,220,0.12)`;
      ctx.fillRect(0, y, w, Math.random() * 8 + 2);
    }

    // White cloud streaks
    for (let i = 0; i < 20; i++) {
      const cx = Math.random() * w, cy = Math.random() * h;
      ctx.fillStyle = `rgba(200,220,250,0.2)`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.random() * 30 + 10, Math.random() * 3 + 1, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Great Dark Spot-like feature
    const dsX = w * 0.45, dsY = h * 0.4;
    const dsGrad = ctx.createRadialGradient(dsX, dsY, 0, dsX, dsY, 15);
    dsGrad.addColorStop(0, '#1838a0');
    dsGrad.addColorStop(0.6, '#2040a8');
    dsGrad.addColorStop(1, 'rgba(40,72,184,0)');
    ctx.fillStyle = dsGrad;
    ctx.beginPath(); ctx.ellipse(dsX, dsY, 18, 10, 0, 0, Math.PI * 2); ctx.fill();

    // Bright companion cloud
    ctx.fillStyle = 'rgba(220,235,255,0.3)';
    ctx.beginPath(); ctx.ellipse(dsX + 22, dsY - 5, 8, 3, 0, 0, Math.PI * 2); ctx.fill();

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return { albedo: tex, canvas: c };
  }

  /** Venus cloud layer — thick sulfuric haze bands */
  _generateVenusCloudTexture() {
    const w = 512, h = 256;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.fillRect(0, 0, w, h);

    // Thick cloud bands
    for (let y = 0; y < h; y += 2) {
      const alpha = 0.15 + Math.abs(Math.sin(y * 0.03)) * 0.35 + Math.abs(Math.sin(y * 0.08 + 1.7)) * 0.2;
      ctx.fillStyle = `rgba(255,245,215,${Math.min(0.7, alpha)})`;
      ctx.fillRect(0, y, w, 2);
    }
    // Bright cloud swirls
    for (let i = 0; i < 30; i++) {
      const cx = Math.random() * w, cy = Math.random() * h;
      ctx.fillStyle = `rgba(255,250,235,${Math.random() * 0.4 + 0.1})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.random() * 40 + 10, Math.random() * 4 + 1, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // ── Normal map generator (Sobel-based from albedo canvas) ───────────────────

  /**
   * Generate a tangent-space normal map from an albedo canvas.
   * Uses luminance as height and Sobel operator for gradient.
   * @param {HTMLCanvasElement} albedoCanvas — source albedo texture
   * @param {number} strength — bump intensity multiplier (0.1–2.0)
   * @returns {THREE.CanvasTexture}
   */
  _generateNormalMap(albedoCanvas, strength = 1.0) {
    const w = albedoCanvas.width;
    const h = albedoCanvas.height;
    const srcCtx = albedoCanvas.getContext('2d');
    const srcData = srcCtx.getImageData(0, 0, w, h);

    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = w;
    resultCanvas.height = h;
    const dstCtx = resultCanvas.getContext('2d');
    const dstData = dstCtx.createImageData(w, h);

    const lum = (idx) => srcData.data[idx] * 0.299 + srcData.data[idx + 1] * 0.587 + srcData.data[idx + 2] * 0.114;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const tl = lum(((y - 1) * w + (x - 1)) * 4);
        const tc = lum(((y - 1) * w + x) * 4);
        const tr = lum(((y - 1) * w + (x + 1)) * 4);
        const ml = lum((y * w + (x - 1)) * 4);
        const mr = lum((y * w + (x + 1)) * 4);
        const bl = lum(((y + 1) * w + (x - 1)) * 4);
        const bc = lum(((y + 1) * w + x) * 4);
        const br = lum(((y + 1) * w + (x + 1)) * 4);

        const gx = (-tl + tr - 2 * ml + 2 * mr - bl + br) * strength;
        const gy = (-tl - 2 * tc - tr + bl + 2 * bc + br) * strength;
        const nz = 1.0;
        const len = Math.sqrt(gx * gx + gy * gy + nz * nz);

        const idx = (y * w + x) * 4;
        dstData.data[idx]     = ((gx / len) + 1) * 127.5;
        dstData.data[idx + 1] = ((gy / len) + 1) * 127.5;
        dstData.data[idx + 2] = ((nz / len) + 1) * 127.5;
        dstData.data[idx + 3] = 255;
      }
    }

    dstCtx.putImageData(dstData, 0, 0);
    const tex = new THREE.CanvasTexture(resultCanvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // ── Moon ────────────────────────────────────────────────────────────────────

  _createMoon() {
    const earth = this.planets.find(p => p.name === 'Earth');
    if (!earth) return;

    const earthR = earth.def.radius * SCALE; // 17
    const moonR = earthR * 0.27;             // ~4.6 — realistic ratio
    const moonOrbitR = earthR * 3.5;          // ~60 — visually clear distance

    // Moon pivot — rotates to create orbit around Earth
    const moonPivot = new THREE.Group();
    earth.group.add(moonPivot);

    // Moon mesh
    const moonGeo = new THREE.SphereGeometry(moonR, 32, 16);
    const moonTex = this._generateMoonTexture();
    const moonMat = new THREE.MeshStandardMaterial({
      map: moonTex, roughness: 0.7, metalness: 0.05
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.position.set(moonOrbitR, 0, 0);
    moonPivot.add(moonMesh);

    // Moon label
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = '#cccccc';
    ctx.textAlign = 'center'; ctx.fillText('Moon', 64, 20);
    const labelTex = new THREE.CanvasTexture(canvas);
    const labelMat = new THREE.SpriteMaterial({
      map: labelTex, transparent: true, depthWrite: false, depthTest: false
    });
    const labelSprite = new THREE.Sprite(labelMat);
    labelSprite.scale.set(6, 1.5, 1);
    labelSprite.position.y = moonR + 2;
    moonMesh.add(labelSprite);

    this.moon = {
      pivot: moonPivot,
      mesh: moonMesh,
      orbitRadius: moonOrbitR,
      angle: Math.random() * Math.PI * 2
    };
  }

  /** Simple grey Moon texture with craters */
  _generateMoonTexture() {
    const w = 256, h = 128;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');

    // Base grey
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#d5d2cc'); grad.addColorStop(0.3, '#c8c5bf');
    grad.addColorStop(0.5, '#d0cdc7'); grad.addColorStop(0.7, '#c2bfb9');
    grad.addColorStop(1, '#ccc9c3');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Maria (dark patches)
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      ctx.fillStyle = `rgba(140,138,132,0.35)`;
      ctx.beginPath();
      ctx.ellipse(x, y, Math.random() * 35 + 15, Math.random() * 20 + 8, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // Craters
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const r = Math.random() * 5 + 0.8;
      ctx.strokeStyle = `rgba(180,178,172,0.6)`;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(190,188,182,0.2)`;
      ctx.beginPath(); ctx.arc(x, y, r * 0.75, 0, Math.PI * 2); ctx.fill();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // ── Orbits ─────────────────────────────────────────────────────────────────

  _createOrbits() {
    for (const p of this.planets) {
      const points = [];
      const r = p.orbitRadius;
      const segments = 256;
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({
        color: 0x335577, transparent: true, opacity: 0.3, depthWrite: false
      });
      const line = new THREE.Line(geo, mat);
      this.group.add(line);
      this.orbits.push(line);
    }
  }

  // ── Labels ─────────────────────────────────────────────────────────────────

  _createLabels() {
    for (const p of this.planets) {
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = 'bold 28px sans-serif'; ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center'; ctx.fillText(p.name, 128, 38);
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({
        map: texture, transparent: true, depthWrite: false, depthTest: false
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(16, 4, 1);
      sprite.position.y = p.def.radius * SCALE + 3.5;
      p.group.add(sprite);
      p.label = sprite;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  addTo(scene) {
    scene.add(this.group);
  }

  update(dt) {
    for (const p of this.planets) {
      p.angle += dt * p.speed * BASE_ORBIT_SPEED;
      p.group.position.x = Math.cos(p.angle) * p.orbitRadius;
      p.group.position.z = Math.sin(p.angle) * p.orbitRadius;
      p.mesh.rotation.y += dt * 0.5 * BASE_ORBIT_SPEED;
    }
    // Moon orbit — ~13 orbits per Earth year
    if (this.moon) {
      this.moon.angle += dt * 13.0 * BASE_ORBIT_SPEED;
      this.moon.pivot.rotation.y = this.moon.angle;
    }
    // Venus cloud shell rotation
    if (this._venusCloudMesh) {
      this._venusCloudMesh.rotation.y += dt * 0.04;
    }
    // Earth ocean slow rotation
    if (this._earthOceanMesh) {
      this._earthOceanMesh.rotation.y += dt * 0.015;
    }
    // Jupiter UV offset animation — bands scroll horizontally
    if (this._jupiterMesh && this._jupiterMesh.material.map) {
      this._jupiterMesh.material.map.offset.x += dt * 0.006;
      if (this._jupiterMesh.material.map.offset.x > 1.0) {
        this._jupiterMesh.material.map.offset.x -= 1.0;
      }
    }
    // Subtle sun pulsation
    const pulse = 1 + Math.sin(performance.now() * 0.001) * 0.015;
    this.sunGroup.children[0].scale.setScalar(pulse);
  }

  getEarth() {
    return this.planets.find(p => p.name === 'Earth') || null;
  }

  getSun() {
    return this.sunGroup;
  }

  /** Return planet info by name */
  static getInfo(name) {
    return PLANET_INFO[name] || null;
  }
}
