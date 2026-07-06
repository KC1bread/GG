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

export class SolarSystem {
  constructor() {
    this.group = new THREE.Group();
    this.planets = [];
    this.orbits = [];
    this.labels = [];
    this.moon = null;        // Moon reference for animation

    // Orbit speed — much slower default (was 0.3), adjustable via UI
    this._orbitSpeedMultiplier = 0.08;

    this._createSun();
    this._createPlanets();
    this._createMoon();
    this._createOrbits();
    this._createLabels();
  }

  /** Set orbit speed multiplier (0–2, default 0.08). 0 = frozen. */
  set orbitSpeedMultiplier(v) {
    this._orbitSpeedMultiplier = Math.max(0, Math.min(2, v));
  }
  get orbitSpeedMultiplier() {
    return this._orbitSpeedMultiplier;
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
    const w = 512, h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Base gradient
    const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2);
    grad.addColorStop(0, '#fffbe6');
    grad.addColorStop(0.3, '#ffe08a');
    grad.addColorStop(0.6, '#ffb833');
    grad.addColorStop(0.85, '#ff8800');
    grad.addColorStop(1, '#e65500');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Granulation / sunspots
    for (let i = 0; i < 300; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = Math.random() * 8 + 1;
      const alpha = Math.random() * 0.25;
      const bright = Math.random() > 0.5;
      ctx.fillStyle = bright
        ? `rgba(255,255,220,${alpha})`
        : `rgba(200,100,0,${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dark sunspots
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * w * 0.7 + w * 0.15;
      const y = Math.random() * h * 0.6 + h * 0.2;
      const r = Math.random() * 14 + 4;
      ctx.fillStyle = `rgba(80,30,0,0.5)`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(40,10,0,0.6)`;
      ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, Math.PI * 2); ctx.fill();
    }

    return new THREE.CanvasTexture(canvas);
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
      { name: 'Mercury', radius: 0.08, orbit: 2.0, roughness: 0.7, metalness: 0.15, speed: 4.8,
        texGen: 'mercury' },
      { name: 'Venus',   radius: 0.16, orbit: 3.2, roughness: 0.25, metalness: 0.05, speed: 3.5,
        texGen: 'venus' },
      { name: 'Earth',   radius: 0.17, orbit: 4.6, roughness: 0.4, metalness: 0.05, speed: 2.9,
        texGen: 'earth', hasAtmo: true },
      { name: 'Mars',    radius: 0.10, orbit: 6.0, roughness: 0.65, metalness: 0.1, speed: 2.4,
        texGen: 'mars' },
      { name: 'Jupiter', radius: 0.48, orbit: 8.5, roughness: 0.45, metalness: 0.05, speed: 1.3,
        texGen: 'jupiter' },
      { name: 'Saturn',  radius: 0.40, orbit: 11.0, roughness: 0.35, metalness: 0.05, speed: 0.95,
        texGen: 'saturn', hasRings: true },
      { name: 'Uranus',  radius: 0.26, orbit: 13.8, roughness: 0.25, metalness: 0.05, speed: 0.68,
        texGen: 'uranus', tilt: Math.PI / 2 * 0.85 },
      { name: 'Neptune', radius: 0.25, orbit: 16.2, roughness: 0.25, metalness: 0.05, speed: 0.55,
        texGen: 'neptune' }
    ];

    for (const def of planetDefs) {
      const planetGroup = new THREE.Group();
      planetGroup.name = def.name;

      const r = def.radius * SCALE;
      const orbitR = def.orbit * SCALE;

      // Generate realistic texture
      const texFn = this['_generate' + def.texGen.charAt(0).toUpperCase() + def.texGen.slice(1) + 'Texture'];
      const map = typeof texFn === 'function' ? texFn.call(this) : null;

      const mat = new THREE.MeshStandardMaterial({
        map: map,
        roughness: def.roughness,
        metalness: def.metalness
      });

      const geo = new THREE.SphereGeometry(r, 64, 32);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      planetGroup.add(mesh);

      // Atmosphere for Earth
      if (def.hasAtmo) {
        const atmoGeo = new THREE.SphereGeometry(r * 1.08, 48, 24);
        const atmoMat = new THREE.MeshBasicMaterial({
          color: 0x88bbff, transparent: true, opacity: 0.1, depthWrite: false
        });
        planetGroup.add(new THREE.Mesh(atmoGeo, atmoMat));
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
        orbitRadius: orbitR, speed: def.speed,
        angle: startAngle, name: def.name, def
      });
    }
  }

  // ── Procedural textures (realistic) ────────────────────────────────────────

  /** Mercury — grey, heavily cratered surface with maria */
  _generateMercuryTexture() {
    const w = 512, h = 256;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');

    // Base grey
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#b8b5ae'); grad.addColorStop(0.3, '#a8a59e');
    grad.addColorStop(0.5, '#bab7b0'); grad.addColorStop(0.7, '#a09d96');
    grad.addColorStop(1, '#b0ada6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Maria (darker patches)
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const rx = Math.random() * 70 + 25, ry = Math.random() * 40 + 15;
      ctx.fillStyle = `rgba(100,98,92,0.3)`;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2); ctx.fill();
    }

    // Craters
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const r = Math.random() * 8 + 1;
      const bright = Math.random() > 0.4;
      ctx.strokeStyle = bright ? 'rgba(210,205,195,0.7)' : 'rgba(140,135,125,0.6)';
      ctx.lineWidth = Math.random() * 1.5 + 0.3;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      // Inner shadow
      ctx.fillStyle = bright ? 'rgba(190,185,175,0.3)' : 'rgba(120,115,105,0.25)';
      ctx.beginPath(); ctx.arc(x - r*0.15, y - r*0.15, r * 0.7, 0, Math.PI * 2); ctx.fill();
    }

    // Large prominent craters
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const r = Math.random() * 18 + 6;
      ctx.strokeStyle = 'rgba(180,175,165,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(170,165,155,0.3)';
      ctx.beginPath(); ctx.arc(x, y, r * 0.85, 0, Math.PI * 2); ctx.fill();
      // Central peak
      if (Math.random() > 0.5) {
        ctx.fillStyle = 'rgba(200,195,185,0.4)';
        ctx.beginPath(); ctx.arc(x, y, r * 0.2, 0, Math.PI * 2); ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  /** Venus — yellowish cloudy with subtle swirl patterns */
  _generateVenusTexture() {
    const w = 512, h = 256;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');

    // Base gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#f0e0c0'); grad.addColorStop(0.2, '#e8d5a3');
    grad.addColorStop(0.5, '#f2e0b8'); grad.addColorStop(0.8, '#e5d0a0');
    grad.addColorStop(1, '#ecd8b0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Cloud swirls using sine waves
    for (let y = 0; y < h; y += 2) {
      const alpha = 0.06 + Math.abs(Math.sin(y * 0.04)) * 0.08;
      ctx.fillStyle = `rgba(255,240,210,${alpha})`;
      ctx.fillRect(0, y, w, 1);
    }

    // Horizontal cloud bands
    for (let i = 0; i < 30; i++) {
      const y = Math.random() * h;
      const height = Math.random() * 8 + 2;
      const alpha = Math.random() * 0.15;
      ctx.fillStyle = Math.random() > 0.5
        ? `rgba(255,245,225,${alpha})`
        : `rgba(200,180,140,${alpha})`;
      ctx.fillRect(0, y, w, height);
    }

    // Swirl patterns
    for (let i = 0; i < 40; i++) {
      const cx = Math.random() * w, cy = Math.random() * h;
      const r = Math.random() * 25 + 8;
      ctx.strokeStyle = `rgba(255,245,220,0.12)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.1) {
        const rr = r + Math.sin(a * 5) * r * 0.3;
        const px = cx + Math.cos(a) * rr;
        const py = cy + Math.sin(a) * rr * 0.6;
        a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  /** Earth — blue oceans, green/brown continents, white clouds, ice caps */
  _generateEarthTexture() {
    const w = 512, h = 256;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');

    // Ocean base
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, h);
    oceanGrad.addColorStop(0, '#1a5588'); oceanGrad.addColorStop(0.25, '#2266aa');
    oceanGrad.addColorStop(0.5, '#3377cc'); oceanGrad.addColorStop(0.75, '#2266aa');
    oceanGrad.addColorStop(1, '#1a5588');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, w, h);

    // Helper: draw irregular continent shape
    const drawContinent = (pts, fillColor) => {
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0], pts[i][1]);
      }
      ctx.closePath();
      ctx.fill();
    };

    // North America-like
    drawContinent([
      [60, 30], [140, 20], [180, 40], [200, 70], [170, 100],
      [140, 110], [90, 95], [50, 80], [30, 55]
    ], '#5a8a3c');
    drawContinent([
      [70, 35], [130, 28], [165, 48], [155, 80],
      [100, 85], [60, 65], [45, 45]
    ], '#6b9a44');

    // South America-like
    drawContinent([
      [155, 110], [170, 100], [185, 115], [190, 140],
      [175, 165], [160, 170], [145, 155], [140, 130]
    ], '#4a8a2a');
    drawContinent([
      [160, 115], [178, 125], [172, 150],
      [158, 158], [148, 138]
    ], '#5a9a35');

    // Europe-like
    drawContinent([
      [230, 30], [270, 25], [300, 35], [310, 50],
      [280, 65], [250, 60], [225, 45]
    ], '#7aaa50');

    // Africa-like
    drawContinent([
      [240, 65], [270, 60], [290, 70], [295, 100],
      [280, 130], [260, 145], [245, 130], [235, 100], [230, 80]
    ], '#8aaa40');
    // Sahara
    drawContinent([
      [240, 60], [275, 55], [288, 68],
      [265, 75], [238, 72]
    ], '#c4b070');

    // Asia-like
    drawContinent([
      [310, 25], [370, 15], [420, 20], [450, 35], [440, 55],
      [400, 65], [350, 60], [320, 50], [305, 40]
    ], '#6d8a3a');
    // India
    drawContinent([
      [360, 60], [375, 55], [380, 75], [370, 90], [355, 80]
    ], '#5a8a30');
    // SE Asia
    drawContinent([
      [385, 70], [410, 65], [420, 80], [400, 90], [380, 85]
    ], '#5a9035');

    // Australia-like
    drawContinent([
      [400, 110], [430, 105], [445, 115], [440, 135],
      [420, 140], [400, 130], [390, 118]
    ], '#c48840');

    // Antarctica
    ctx.fillStyle = '#f0f4f8';
    ctx.fillRect(0, h - 18, w, 18);
    // Ice detail
    for (let x = 0; x < w; x += 4) {
      const iceH = 14 + Math.sin(x * 0.03) * 6 + Math.sin(x * 0.07) * 4;
      ctx.fillStyle = 'rgba(240,245,250,0.7)';
      ctx.fillRect(x, h - iceH, 3, iceH);
    }

    // Arctic ice
    ctx.fillStyle = '#f2f6fa';
    ctx.fillRect(0, 0, w, 10);
    for (let x = 0; x < w; x += 3) {
      const iceH = 6 + Math.sin(x * 0.05) * 5;
      ctx.fillStyle = 'rgba(240,245,250,0.6)';
      ctx.fillRect(x, 0, 2, iceH);
    }

    // Greenland
    drawContinent([[170, 18], [195, 12], [210, 20], [200, 32], [178, 28]], '#f0f4f8');

    // Japan / islands
    ctx.fillStyle = '#6a9040';
    ctx.beginPath(); ctx.ellipse(395, 50, 6, 3, 0.2, 0, Math.PI * 2); ctx.fill();

    // Cloud wisps
    for (let i = 0; i < 200; i++) {
      const cx = Math.random() * w, cy = Math.random() * h;
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.random() * 25 + 4, Math.random() * 3 + 1, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  /** Mars — reddish surface with darker highlands, polar caps, craters */
  _generateMarsTexture() {
    const w = 512, h = 256;
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

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
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
    return tex;
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
      angle: Math.random() * Math.PI * 2,
      speed: 13.0  // ~13 orbits per Earth year
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
    const spd = this._orbitSpeedMultiplier;
    for (const p of this.planets) {
      p.angle += dt * p.speed * spd;
      p.group.position.x = Math.cos(p.angle) * p.orbitRadius;
      p.group.position.z = Math.sin(p.angle) * p.orbitRadius;
      p.mesh.rotation.y += dt * 0.5 * spd;
    }
    // Moon orbit
    if (this.moon) {
      this.moon.angle += dt * this.moon.speed * spd;
      this.moon.pivot.rotation.y = this.moon.angle;
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
