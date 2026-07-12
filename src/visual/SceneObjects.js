import * as THREE from 'three';

/**
 * addReferenceScene — adds target star (Proxima Centauri) and scene lighting.
 * Grid and standalone Earth have been removed; the SolarSystem provides all planets.
 */
export function addReferenceScene(scene) {
  // ---- PBR lighting — balanced ambient + hemisphere + sun directional -----------
  // Hemisphere: warm sky / cool ground for subtle colour variation
  const hemiLight = new THREE.HemisphereLight(0xffeedd, 0x223344, 0.2);
  scene.add(hemiLight);

  // Ambient fill — low base so dark sides are visible but clearly in shadow
  const ambient = new THREE.AmbientLight(0xfff8ee, 0.3);
  scene.add(ambient);

  // Main sun light — primary directional light revealing PBR normal map detail.
  // Positioned off-origin so the light direction is well-defined.
  // Intensity balanced so lit side is bright (~1.0–1.1 total) without clipping to white.
  const sunLight = new THREE.DirectionalLight(0xfff4e8, 0.7);
  sunLight.position.set(0, 10, 1);
  sunLight.target.position.set(0, 0, 0);
  scene.add(sunLight);
  scene.add(sunLight.target);

  // ---- Target star (Proxima Centauri / destination, far away) -----------------
  const targetGroup = new THREE.Group();

  const targetGeo = new THREE.SphereGeometry(3.5, 32, 16);
  const targetMat = new THREE.MeshBasicMaterial({ color: 0xfff1a8 });
  const target = new THREE.Mesh(targetGeo, targetMat);
  targetGroup.add(target);

  // Target glow sprite
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 128;
  glowCanvas.height = 128;
  const gctx = glowCanvas.getContext('2d');
  const grad = gctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,241,168,0.5)');
  grad.addColorStop(0.4, 'rgba(255,220,100,0.2)');
  grad.addColorStop(0.8, 'rgba(255,180,40,0.03)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 128, 128);
  const glowTex = new THREE.CanvasTexture(glowCanvas);
  const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true
  }));
  glowSprite.scale.set(40, 40, 1);
  targetGroup.add(glowSprite);

  // Point light at target
  const targetLight = new THREE.PointLight(0xfff1a8, 200, 80);
  targetLight.position.set(0, 0, 0);
  targetGroup.add(targetLight);

  // Place destination far beyond the scaled-up solar system
  targetGroup.position.set(0, 0, -3000);
  scene.add(targetGroup);

  return { target, targetGroup };
}
