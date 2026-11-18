/**
 * Diegetic HUD: the power/stamina readouts that live on the pitch instead of
 * on the edges of the screen.
 *
 * Both are flat rings drawn just above the grass around the player's feet, so
 * timing a rising top-corner shot never means looking away from the ball.
 *
 *  - power arc: sweeps from behind the player around to the front as you hold
 *    the kick, and turns gold when the shot is charged enough to reach the
 *    top corner
 *  - stamina ring: a thin complete ring that thins out as you sprint
 *
 * Everything is a single canvas texture reused by one mesh, so it costs one
 * draw call and no per-frame allocation.
 */
import * as THREE from 'three';

const SIZE = 256;

function makeCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  return { c, g: c.getContext('2d') };
}

export class GroundMeter {
  constructor(scene, {
    radius = 0.85,
    y = 0.036,
    powerColor = '#f2c14e',
    staminaColor = '#7ed957',
    lowColor = '#e4571f',
  } = {}) {
    this.radius = radius;
    this.powerColor = powerColor;
    this.staminaColor = staminaColor;
    this.lowColor = lowColor;

    const { c, g } = makeCanvas();
    this.canvas = c;
    this.ctx = g;
    this.tex = new THREE.CanvasTexture(c);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;

    this.material = new THREE.MeshBasicMaterial({
      map: this.tex,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2.9, radius * 2.9), this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = y;
    this.mesh.renderOrder = 4;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);

    this._lastKey = '';
    this._visible = false;
    this._glow = 0;
  }

  /** Place the ring at a world position, facing the camera's yaw. */
  setPosition(x, z, yaw = 0) {
    this.mesh.position.x = x;
    this.mesh.position.z = z;
    // keep the arc opening behind the camera so it reads as "under your feet"
    this.mesh.rotation.z = -yaw;
  }

  /**
   * @param {object} s
   *   charge: 0..1.4 held power
   *   stamina: 0..1
   *   charging: whether the player is currently winding up
   *   perfect: charge is in the sweet spot
   *   visible: whether to draw at all
   */
  update(s) {
    const visible = !!s.visible;
    if (visible !== this._visible) {
      this.mesh.visible = visible;
      this._visible = visible;
    }
    if (!visible) return;

    const charge = Math.max(0, Math.min(1.4, s.charge || 0));
    const stamina = s.stamina === undefined ? 1 : Math.max(0, Math.min(1, s.stamina));
    const charging = !!s.charging;
    const perfect = !!s.perfect;

    // quantise so we only repaint when something visibly changed
    const key = [
      Math.round(charge * 60),
      Math.round(stamina * 40),
      charging ? 1 : 0,
      perfect ? 1 : 0,
    ].join(':');
    if (key === this._lastKey) return;
    this._lastKey = key;

    const g = this.ctx;
    const c = SIZE / 2;
    const R = SIZE * 0.4;
    g.clearRect(0, 0, SIZE, SIZE);

    /* ---------------------------- stamina ring ---------------------------- */
    // thin, always present, full circle: reads at a glance under your feet
    g.lineWidth = 10;
    g.strokeStyle = 'rgba(0,0,0,0.32)';
    g.beginPath();
    g.arc(c, c, R, 0, Math.PI * 2);
    g.stroke();

    const stamColor = stamina < 0.25 ? this.lowColor : this.staminaColor;
    g.lineWidth = 7;
    g.strokeStyle = stamColor;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(c, c, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * stamina);
    g.stroke();

    /* ----------------------------- power arc ----------------------------- */
    if (charging || charge > 0.02) {
      const spread = Math.PI * 1.25; // 225 degrees of sweep in front
      const start = Math.PI * 0.62;
      const t = Math.min(1, charge / 1.2);

      // track
      g.lineWidth = 20;
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      g.lineCap = 'butt';
      g.beginPath();
      g.arc(c, c, R - 20, start, start + spread);
      g.stroke();

      // fill
      const color = perfect ? '#fff3b8' : this.powerColor;
      g.lineWidth = 16;
      g.strokeStyle = color;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(c, c, R - 20, start, start + spread * t);
      g.stroke();

      // sweet-spot notch, so you can see when the shot is fully charged
      const sweet = start + spread * 0.82;
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(c + Math.cos(sweet) * (R - 34), c + Math.sin(sweet) * (R - 34));
      g.lineTo(c + Math.cos(sweet) * (R - 4), c + Math.sin(sweet) * (R - 4));
      g.stroke();
    }

    this.tex.needsUpdate = true;
    this.material.opacity = 1;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.tex.dispose();
  }
}
