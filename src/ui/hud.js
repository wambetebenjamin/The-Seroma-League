/** HUD controller: binds a live HUD object to the DOM for each sport. */

const $ = (root, sel) => root.querySelector(sel);

export function showToast(msg, ms = 2200) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('on'), ms);
}

export function showLoader(text = 'Warming up…') {
  const el = document.getElementById('loader');
  if (!el) return;
  const p = el.querySelector('p');
  if (p) p.textContent = text;
  el.classList.remove('hidden');
}
export function hideLoader() {
  document.getElementById('loader')?.classList.add('hidden');
}

export class Hud {
  constructor(root, opts) {
    this.root = root;
    this.opts = opts;
    this.sport = opts.sport;
    this.els = {
      homeScore: $(root, '[data-home-score]'),
      awayScore: $(root, '[data-away-score]'),
      homeName: $(root, '[data-home-name]'),
      awayName: $(root, '[data-away-name]'),
      homeDot: $(root, '[data-home-dot]'),
      awayDot: $(root, '[data-away-dot]'),
      clock: $(root, '[data-clock]'),
      banner: $(root, '#banner'),
      bigBanner: $(root, '#bigBanner'),
      flash: $(root, '#screenFlash'),
      sparks: $(root, '#sparks'),
      stamina: $(root, '[data-stamina]'),
      charge: $(root, '[data-charge]'),
      chargeMeter: $(root, '#chargeMeter'),
      greenZone: $(root, '[data-green-zone]'),
      hint: $(root, '[data-hint]'),
      kick: $(root, '#kickBtn'),
      pause: $(root, '#pauseBtn'),
      reticle: $(root, '#aimReticle'),
      skillRow: $(root, '#skillRow'),
      swimHud: $(root, '#swimHud'),
      progress: $(root, '[data-progress]'),
      rhythm: $(root, '[data-rhythm]'),
      lapLabel: $(root, '[data-lap-label]'),
      posLabel: $(root, '[data-pos-label]'),
      strokeBtn: $(root, '#strokeBtn'),
      stick: $(root, '#stickVisual'),
      scoreboard: $(root, '.scoreboard'),
      chargeLabel: $(root, '#chargeMeter label'),
      kickLabel: $(root, '#kickBtn span'),
    };
    this.skillPills = [];
    this._bindControls();
    this._configureSport();
    this.lastBanner = '';
    // which pills are allowed to show, given the sport and possession
    this.pillState = { attacking: true, defending: false, hasBall: false };
    this._helpOpen = false;
    this._hintFaded = false;
  }

  _configureSport() {
    const { sport } = this;
    const e = this.els;
    const swim = sport === 'swimming';
    e.swimHud.classList.toggle('hidden', !swim);
    e.kick.classList.toggle('hidden', swim);
    e.hudBottom = $(this.root, '.hud-bottom');
    if (e.hudBottom) e.hudBottom.classList.toggle('hidden', swim);
    e.reticle.classList.toggle('hidden', swim);
    e.chargeMeter.classList.toggle('hidden', swim || sport === 'football');
    e.skillRow.querySelectorAll('[data-action]').forEach((b) => {
      const a = b.dataset.action;
      b.classList.toggle('hidden', a.startsWith('skill') && sport !== 'football');
      if (a === 'tackle') b.textContent = sport === 'basketball' ? 'BOX OUT' : sport === 'swimming' ? 'KICK' : 'TACKLE';
      if (a === 'call') b.textContent = sport === 'basketball' ? 'CALL' : sport === 'swimming' ? 'BREATHE' : 'CALL';
    });
    if (e.kickLabel) e.kickLabel.textContent = 'SHOOT';
    e.kick.dataset.sport = sport;
  }

  _bindControls() {
    const e = this.els;
    // football: extra skill buttons on the right rail for touch
    this.skillPills = Array.from(e.skillRow.querySelectorAll('.skill-pill'));
    e.skillRow.querySelectorAll('.skill-pill, .look-pill').forEach((b) => {
      b.classList.toggle('hidden', this.sport !== 'football' && b.classList.contains('skill-pill'));
    });
    e.legend = $(this.root, '#controlLegend');
    if (this.sport !== 'football') {
      if (e.legend) e.legend.classList.add('hidden');
      const help = $(this.root, '#helpToggle');
      if (help) help.classList.add('hidden');
    }
    const kick = e.kick;
    const down = (ev) => {
      ev.preventDefault();
      kick.classList.add('charging');
      this.opts.onKickDown?.();
    };
    const up = (ev) => {
      ev.preventDefault();
      kick.classList.remove('charging');
      this.opts.onKickUp?.();
    };
    // Use property handlers (not addEventListener) so a new Hud instance for the
    // next match replaces the old handlers instead of stacking on top of them.
    kick.onpointerdown = down;
    kick.onpointerup = up;
    kick.onpointercancel = up;
    kick.onpointerleave = (ev) => {
      if (ev.buttons) up(ev);
    };

    e.pause.onclick = () => this.opts.onPause?.();

    e.skillRow.querySelectorAll('[data-action]').forEach((b) => {
      const action = b.dataset.action;
      if (action === 'lookBack') {
        // hold to peek over your shoulder, exactly like right-click
        b.onpointerdown = (ev) => {
          ev.preventDefault();
          this.opts.onAction?.('lookBack');
        };
        b.onpointerup = (ev) => {
          ev.preventDefault();
          this.opts.onAction?.('lookBackEnd');
        };
        b.onpointercancel = () => this.opts.onAction?.('lookBackEnd');
        return;
      }
      b.onclick = () => this.opts.onAction?.(action);
    });

    e.strokeBtn.onpointerdown = (ev) => {
      ev.preventDefault();
      this.opts.onStroke?.();
    };

    // collapsible control legend: starts open, then fades out of the way
    e.helpToggle = $(this.root, '#helpToggle');
    if (e.helpToggle) {
      e.helpToggle.onclick = () => {
        this._helpOpen = !this._helpOpen;
        this._applyHelp();
      };
    }
    this._helpTimer = setTimeout(() => {
      if (!this._helpOpen) this._applyHelp(true);
    }, 10000);

    this._stickLoop();
  }

  /** Show/hide the keyboard legend, and fade it after the opening seconds. */
  _applyHelp(forceFade = false) {
    const e = this.els;
    if (!e.legend) return;
    const show = this._helpOpen;
    e.legend.classList.toggle('open', show);
    e.legend.classList.toggle('faded', !show && (forceFade || this._hintFaded));
    e.legend.setAttribute('aria-hidden', String(!show));
    if (e.helpToggle) {
      e.helpToggle.setAttribute('aria-expanded', String(show));
      e.helpToggle.classList.toggle('on', show);
    }
    if (forceFade) this._hintFaded = true;
  }

  /**
   * Show only the pills that matter right now: while defending you get the
   * tackle, while attacking you get the skills. Everything else is hidden so
   * the pitch stays clear.
   */
  _applyPills(h) {
    const e = this.els;
    if (!e.skillRow) return;
    const attacking = h.hasBall !== false;
    const defending = !attacking;
    const buttons = e.skillRow.querySelectorAll('[data-action]');
    buttons.forEach((b) => {
      const a = b.dataset.action;
      let show = true;
      if (this.sport === 'football') {
        if (a === 'tackle') show = defending;
        else if (a === 'call') show = defending;
        else if (a.startsWith('skill')) show = attacking;
        else if (a === 'lookBack') show = defending;
      } else if (this.sport === 'basketball') {
        if (a === 'tackle') show = defending;
        else if (a === 'call') show = attacking;
        else show = false;
      } else {
        // swimming hides the whole row
        show = false;
      }
      b.classList.toggle('hidden', !show);
    });
  }

  _stickLoop() {
    const tick = () => {
      const vis = this.opts.getTouchStick?.();
      const stick = this.els.stick;
      if (!stick) return;
      if (vis) {
        stick.classList.add('on');
        stick.style.left = vis.x + 'px';
        stick.style.top = vis.y + 'px';
        const knob = stick.querySelector('i');
        const max = vis.max || 70;
        const dx = Math.max(-max, Math.min(max, vis.dx));
        const dy = Math.max(-max, Math.min(max, vis.dy));
        if (knob) {
          knob.style.transform = `translate(${dx * 0.55}px, ${dy * 0.55}px)`;
        }
      } else {
        stick.classList.remove('on');
      }
      this._stickRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  reset() {
    this.lastBanner = '';
    this.els.banner.textContent = '';
    this.els.banner.style.opacity = '0';
  }

  onEvent(e) {
    if (!e) return;
    if (e.type === 'banner') {
      this._flashBanner(e.text);
    } else if (e.type === 'goal') {
      // the celebration: a huge animated banner plus a colour wash
      const good = e.homeScored !== false;
      this.bigBanner(good ? 'GOAL!' : 'CONCEDED', good ? 'good' : 'bad', 2.2);
      this.flash(good ? 'good' : 'bad');
      if (good) this.spark(18);
    } else if (e.type === 'basket') {
      const two = e.pts >= 3 ? '3-POINTER!' : e.pts >= 1 ? 'SHOT!' : 'BUCKET!';
      this.bigBanner(two, 'good', 1.8);
      this.flash('good');
      this.spark(12);
    } else if (e.type === 'perfect') {
      this.flash('perfect');
      this.spark(e.big ? 16 : 9);
    } else if (e.type === 'shot') {
      // full-power strikes hit harder: a jolt on the camera and a hot flash
      if ((e.power || 0) > 0.82) this.flash('power');
    }
  }

  /** Bold, animated centre-screen word: GOAL!, 3-POINTER!, etc. */
  bigBanner(text, tone = 'good', secs = 2) {
    const el = this.els.bigBanner;
    if (!el) return;
    el.textContent = text;
    el.className = 'big-banner on ' + tone;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(this._bigTimer);
    this._bigTimer = setTimeout(() => {
      el.className = 'big-banner';
    }, secs * 1000);
  }

  /** Full-screen colour wash: good (green), perfect (gold-green), power (hot). */
  flash(tone = 'good') {
    const el = this.els.flash;
    if (!el) return;
    el.className = 'screen-flash';
    void el.offsetWidth;
    el.className = 'screen-flash ' + tone;
  }

  /** A burst of little sparks from the centre of the screen. */
  spark(n = 10) {
    const host = this.els.sparks;
    if (!host) return;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i');
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const dist = 70 + Math.random() * 130;
      s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      s.style.setProperty('--dy', Math.sin(ang) * dist * 0.72 + 'px');
      s.style.setProperty('--rot', Math.random() * 360 + 'deg');
      s.style.animationDelay = Math.random() * 0.09 + 's';
      host.appendChild(s);
      setTimeout(() => s.remove(), 900);
    }
  }

  _flashBanner(text) {
    const b = this.els.banner;
    b.textContent = text;
    b.style.opacity = '1';
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
  }

  update(h) {
    const e = this.els;
    if (!h) return;

    if (h.score && typeof h.score === 'object' && 'home' in h.score) {
      // football-style { home, away }
      e.homeScore.textContent = h.score.home;
      e.awayScore.textContent = h.score.away;
    } else if (typeof h.score === 'number') {
      // basketball / solo scoreboard
      e.homeScore.textContent = h.score;
      e.awayScore.textContent = h.oppScore ?? 0;
    }
    if (h.homeTeam) {
      e.homeName.textContent = h.homeTeam.name.toUpperCase();
      e.homeDot.style.background = h.homeTeam.colors.primary;
      if (h.awayTeam) {
        e.awayName.textContent = h.awayTeam.name.toUpperCase();
        e.awayDot.style.background = h.awayTeam.colors.primary;
      }
    }
    if (h.clock) e.clock.textContent = h.clock;

    if (h.stamina !== undefined) {
      e.stamina.style.width = Math.round(h.stamina * 100) + '%';
      e.stamina.style.background =
        h.stamina < 0.25 ? 'linear-gradient(90deg,#e4571f,#f2c14e)' : 'linear-gradient(90deg,#7ed957,#f2c14e)';
    }

    const charge = h.charge || 0;
    if (this.sport === 'basketball' && h.ideal !== undefined) {
      e.chargeMeter.classList.remove('hidden');
      e.chargeLabel.textContent = h.charging ? 'RELEASE IN GREEN' : 'POWER';
      const pct = Math.round(Math.min(charge, 1.2) * 100);
      e.charge.style.width = pct + '%';
      const lo = Math.max(0, (h.ideal - 0.11) * 100);
      const hi = Math.min(100, (h.ideal + 0.11) * 100);
      e.greenZone.style.display = 'block';
      e.greenZone.style.left = lo + '%';
      e.greenZone.style.width = hi - lo + '%';
    } else if (this.sport === 'football') {
      const show = charge > 0;
      e.chargeMeter.classList.toggle('hidden', !show);
      e.charge.style.width = Math.round(Math.min(charge, 1.4) * 71) + '%';
    }

    if (h.hint) e.hint.textContent = h.hint;

    // contextual action pills: only what is useful right now
    if (h.hasBall !== undefined || this.sport !== 'football') this._applyPills(h);

    // football: dim the skill pills while on cooldown, light the kick button
    // when you are looking up at the top corner, and flag look-back
    if (typeof h.skillReady === 'boolean' && this.skillPills.length) {
      this.skillPills.forEach((b) => b.classList.toggle('dim', !h.skillReady));
    }
    if (typeof h.aimingHigh === 'boolean') e.kick.classList.toggle('aim-high', h.aimingHigh && h.hasBall);
    if (typeof h.lookBack === 'boolean' && e.legend) {
      e.legend.classList.toggle('faded', h.lookBack);
    }

    if (h.banner !== undefined) {
      if (h.banner !== this.lastBanner) {
        this.lastBanner = h.banner;
        if (h.banner) this._flashBanner(h.banner);
        else e.banner.style.opacity = '0';
      }
    }

    if (this.sport === 'swimming') {
      e.progress.style.width = (h.pct || 0) + '%';
      e.lapLabel.textContent = `${Math.floor(h.distance || 0)} / ${h.total} m`;
      e.posLabel.textContent = 'P' + (h.position || 1);
      const phase = h.phase ?? 0;
      const band = h.inBand || (phase > 0.42 && phase < 0.58);
      const fill = e.rhythm;
      if (fill) {
        fill.style.background = band
          ? 'linear-gradient(90deg,rgba(122,255,122,.35),rgba(190,255,190,.9))'
          : 'linear-gradient(90deg,rgba(87,215,255,.15),rgba(87,215,255,.55))';
      }
      const strike = this.els.swimHud.querySelector('.rhythm .strike');
      if (strike) strike.style.left = Math.round(phase * 100) + '%';
      e.strokeBtn.textContent = band ? 'STROKE NOW!' : 'STROKE';
    }
  }

  destroy() {
    cancelAnimationFrame(this._stickRaf);
    clearTimeout(this._helpTimer);
    clearTimeout(this._bigTimer);
  }
}
