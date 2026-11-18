import './style.css';
import * as THREE from 'three';
import { Input } from './core/input.js';
import { audio } from './core/audio.js';
import { portraitURL } from './ui/portrait.js';
import { crestSVG } from './ui/crest.js';
import { hideLoader, showLoader, showToast } from './ui/hud.js';
import { Hud } from './ui/hud.js';
import {
  TEAMS,
  SPORTS,
  SCHOOL,
  VENUES,
  GALLERY,
  venueFor,
  venueForSport,
  CAMPUS_FACTS,
  POLL_CATEGORIES,
  squadFor,
  teamById,
  SQUADS,
  clubRatings,
  clubOverall,
} from './data/seroma.js';
import { FootballGame } from './games/football.js';
import { BasketballGame } from './games/basketball.js';
import { SwimmingGame } from './games/swimming.js';

const app = {
  stage: document.getElementById('stage'),
  ui: document.getElementById('ui'),
  hud: document.getElementById('hud'),
  game: null,
  hudUI: null,
  input: null,
  sport: 'football',
  mode: 'match',
  homeTeam: 'gaucho',
  awayTeam: 'theos',
  homePlayer: null,
  awayPlayer: null,
  history: [],
};

/* ------------------------------- navigation ------------------------------- */
function show(screenId) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  const el = document.getElementById(screenId);
  if (el) el.classList.add('active');
  app.ui.classList.remove('hidden');
  showBackdrop();
}
function showHud() {
  app.ui.classList.add('hidden');
  app.hud.classList.remove('hidden');
  hideBackdrop();
  document.body.classList.add('match-on');
}
function hideHud() {
  app.hud.classList.add('hidden');
  document.body.classList.remove('match-on');
}
function toast(msg) {
  showToast(msg);
}

/* ------------------------------- backdrop --------------------------------- */
/**
 * The menu sits on a live campus backdrop: a full-bleed 3D render that
 * cross-fades when you pick a sport or tap a venue tab. Health-checks the page
 * first, so if an image ever 404s the fallback hero render steps in instead of
 * leaving a hole in the layout.
 */
const backdrop = {
  el: null,
  a: null,
  b: null,
  front: null,
  current: null,
  broken: new Set(),
  checked: new Map(),
};

function backdropReady(src) {
  return new Promise((resolve) => {
    if (backdrop.checked.has(src)) return resolve(backdrop.checked.get(src));
    const img = new Image();
    img.onload = () => {
      backdrop.checked.set(src, true);
      resolve(true);
    };
    img.onerror = () => {
      backdrop.checked.set(src, false);
      backdrop.broken.add(src);
      resolve(false);
    };
    img.src = src;
  });
}

async function setBackdrop(photo, { immediate = false } = {}) {
  const src = `./${photo}`;
  if (!backdrop.el) {
    backdrop.el = document.getElementById('backdrop');
    backdrop.a = document.getElementById('bdA');
    backdrop.b = document.getElementById('bdB');
    backdrop.front = backdrop.a;
  }
  if (!backdrop.el || backdrop.current === src) return;
  backdrop.current = src;
  const ok = await backdropReady(src);
  const finalSrc = ok ? src : './img/hero.jpg';
  const next = backdrop.front === backdrop.a ? backdrop.b : backdrop.a;
  const cur = backdrop.front;
  next.style.backgroundImage = `url("${finalSrc}")`;
  next.classList.add('on');
  if (immediate) next.style.transition = 'none';
  // force the layer to paint before we fade the old one out
  void next.offsetWidth;
  next.style.transition = '';
  cur.classList.remove('on');
  backdrop.front = next;
  document.body.dataset.venueSrc = finalSrc;
}

function hideBackdrop() {
  if (backdrop.el) backdrop.el.classList.add('hidden');
}
function showBackdrop() {
  if (backdrop.el) backdrop.el.classList.remove('hidden');
}

/* --------------------------------- home ---------------------------------- */
function buildHome() {
  const cards = document.getElementById('sportCards');
  cards.innerHTML = '';
  SPORTS.forEach((s) => {
    const b = document.createElement('button');
    b.className = 'sport-card';
    b.innerHTML = `
      <img src="./${s.photo}" alt="${s.photoAlt || s.name + ' at Seroma'}" loading="lazy" />
      <div class="sport-scrim"></div>
      <div class="sport-inner">
        <h3>${s.name}</h3>
        <p>${s.tagline}</p>
        <p style="opacity:.72;margin-top:4px">${s.blurb}</p>
        <div class="go">PLAY ${s.name.toUpperCase()}</div>
      </div>`;
    b.onclick = () => openPlayers(s.id);
    cards.appendChild(b);
  });

  const facts = document.getElementById('campusFacts');
  facts.innerHTML = CAMPUS_FACTS.map(
    (f) => `<div class="fact"><b>${f.title}</b><span>${f.body}</span></div>`
  ).join('');

  const clubs = document.getElementById('clubList');
  clubs.innerHTML = TEAMS.map(
    (t) =>
      `<div class="club"><i style="background:${t.colors.primary}"></i>${t.name}<span style="opacity:.5;font-weight:500"> · ${(SQUADS[t.id] || []).length}</span></div>`
  ).join('');

  const tabs = document.getElementById('venueTabs');
  if (tabs) {
    tabs.innerHTML = VENUES.map(
      (v) =>
        `<button class="venue-btn" data-venue="${v.id}"${v.sport ? ` data-sport="${v.sport}"` : ''}>${v.name}</button>`
    ).join('');
    // keep the highlight in sync whenever the bar is rebuilt
    tabs.querySelectorAll('[data-venue]').forEach((b) => {
      b.classList.toggle('active', b.dataset.venue === activeVenue);
    });
    tabs.querySelectorAll('[data-venue]').forEach((b) => {
      b.onclick = () => {
        audio.click();
        const v = venueFor(b.dataset.venue);
        setVenue(v.id);
        // a venue that hosts a sport also pre-selects it, so the tab does real work
        if (v.sport) {
          app.sport = v.sport;
          document.body.dataset.sport = v.sport;
          buildHome();
        }
      };
    });
  }

  const strip = document.getElementById('renderStrip');
  if (strip) {
    strip.innerHTML =
      `<h2>Campus renders</h2><p class="muted">Tap a scene to set the backdrop.</p><div class="thumb-list">` +
      GALLERY.map(
        (g) =>
          `<button class="thumb" data-gallery="${g.id}" title="${g.label}">
            <img src="./${g.photo}" alt="${g.alt}" loading="lazy" />
            <span>${g.label}</span>
          </button>`
      ).join('') +
      `</div>`;
    strip.querySelectorAll('[data-gallery]').forEach((b) => {
      b.onclick = () => {
        audio.click();
        const g = GALLERY.find((x) => x.id === b.dataset.gallery);
        if (g) {
          setBackdrop(g.photo);
          strip.querySelectorAll('.thumb').forEach((t) => t.classList.toggle('on', t === b));
          caption(g.label, '');
        }
      };
    });
  }

  const awards = document.getElementById('awardsBoard');
  awards.innerHTML = POLL_CATEGORIES.map((cat) => {
    const max = Math.max(...cat.nominees.map((n) => n.votes));
    const sorted = cat.nominees.slice().sort((a, b) => b.votes - a.votes);
    const lead = sorted[0];
    const items = sorted
      .slice(0, 5)
      .map((n) => {
        const team = TEAMS.find((t) => t.name === n.team);
        const col = team ? team.colors.primary : '#f2c14e';
        return `<div class="nominee ${n === lead ? 'lead' : ''}">
          <span class="nm">${n.name}</span>
          <span class="tm">${n.team}</span>
          <div class="bar-track"><i style="width:${Math.round((n.votes / max) * 100)}%;background:${col}"></i></div>
        </div>`;
      })
      .join('');
    return `<div class="award"><h4>${cat.title}</h4>${items}</div>`;
  }).join('');

  document.getElementById('pollLink').href = SCHOOL.poll;
  document.getElementById('year').textContent = new Date().getFullYear();
}

/* --------------------------------- venues --------------------------------- */
let activeVenue = 'jubilee';

function caption(name, line) {
  const el = document.getElementById('venueCaption');
  if (el) el.textContent = line ? `${name} · ${line}` : name;
}

function setVenue(id, { silent = false } = {}) {
  const v = venueFor(id);
  activeVenue = v.id;
  setBackdrop(v.photo);
  document.querySelectorAll('#venueTabs .venue-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.venue === v.id);
  });
  if (!silent) caption(v.name, v.line);
}

/* -------------------------------- quick play ------------------------------- */
/**
 * Three taps: sport -> club -> mode. Nothing else in the way, no scrolling past
 * the campus lore, and the club cards carry real ratings so the choice feels
 * strategic.
 */
const quick = { step: 'sport', sport: null, club: null, mode: 'match' };

const QUICK_STEPS = ['sport', 'club', 'mode'];

function openQuick(sport = null) {
  quick.step = sport ? 'club' : 'sport';
  quick.sport = sport;
  quick.club = null;
  quick.mode = app.mode || 'match';
  renderQuick();
  show('screen-quick');
}

function setQuickStep(step) {
  quick.step = step;
  renderQuick();
}

function renderQuick() {
  const e = (id) => document.getElementById(id);
  const steps = e('quickSteps');
  steps.querySelectorAll('li').forEach((li) => {
    const name = li.dataset.step;
    const idx = QUICK_STEPS.indexOf(name);
    const cur = QUICK_STEPS.indexOf(quick.step);
    li.classList.toggle('on', name === quick.step);
    li.classList.toggle('done', idx < cur);
  });

  document.querySelectorAll('.quick-pane').forEach((p) => {
    p.hidden = p.dataset.pane !== quick.step;
  });

  const stage = document.querySelector('#screen-quick .quick');
  stage.dataset.step = quick.step;

  /* ------------------------------ 1. sport ------------------------------ */
  const sports = e('quickSports');
  if (sports && !sports.dataset.built) {
    sports.innerHTML = SPORTS.map(
      (sp) => `<button class="quick-sport" data-sport="${sp.id}">
        <b>${sp.name}</b>
        <span>${sp.tagline}</span>
      </button>`
    ).join('');
    sports.dataset.built = '1';
    sports.querySelectorAll('[data-sport]').forEach((b) => {
      b.onclick = () => {
        audio.click();
        quick.sport = b.dataset.sport;
        // the campus behind the drawer changes to the venue for that sport
        setVenue(venueForSport(quick.sport).id, { silent: true });
        setQuickStep('club');
      };
    });
  }
  if (sports) {
    sports.querySelectorAll('[data-sport]').forEach((b) => {
      b.classList.toggle('on', b.dataset.sport === quick.sport);
    });
  }

  /* ------------------------------- 2. club ------------------------------ */
  const clubs = e('quickClubs');
  if (clubs) {
    const ratings = clubRatings();
    clubs.innerHTML = TEAMS.map((t) => {
      const r = ratings[t.id] || {};
      const ovr = clubOverall(t.id);
      return `<button class="club-card" data-club="${t.id}" aria-pressed="false">
        <span class="cc-crest">${crestSVG(t, { size: 52 })}</span>
        <span class="cc-body">
          <span class="cc-top">
            <b>${t.name}</b>
            <em class="cc-ovr">${ovr}</em>
          </span>
          <span class="cc-coach">${t.coach}</span>
          <span class="cc-bars">
            ${[['Speed', r.speed], ['Power', r.power], ['Stamina', r.stamina]]
              .map(
                ([label, v]) => `<span class="cc-bar"><i style="width:${v}%"></i>
                  <small>${label}</small><u>${v}</u></span>`
              )
              .join('')}
          </span>
        </span>
      </button>`;
    }).join('');
    clubs.querySelectorAll('[data-club]').forEach((b) => {
      b.onclick = () => {
        audio.click();
        quick.club = b.dataset.club;
        clubs.querySelectorAll('[data-club]').forEach((x) => {
          const on = x.dataset.club === quick.club;
          x.classList.toggle('on', on);
          x.setAttribute('aria-pressed', String(on));
        });
      };
    });
  }

  /* ------------------------------- 3. mode ------------------------------ */
  const modes = e('quickModes');
  if (modes) {
    modes.querySelectorAll('[data-mode]').forEach((b) => {
      b.classList.toggle('on', b.dataset.mode === quick.mode);
      b.onclick = () => {
        audio.click();
        quick.mode = b.dataset.mode;
        renderQuick();
      };
    });
  }

  const preview = e('quickPreview');
  if (preview) {
    if (quick.step === 'mode' && quick.club) {
      const t = teamById(quick.club);
      const sp = SPORTS.find((x) => x.id === quick.sport) || SPORTS[0];
      preview.innerHTML = `
        <div class="qp-card">
          ${crestSVG(t, { size: 56 })}
          <div>
            <b>${t.name}</b>
            <span>${sp.name} · ${quick.mode === 'practice' ? 'Practice' : 'Match'} · ${t.coach}</span>
          </div>
        </div>`;
    } else preview.innerHTML = '';
  }

  /* ------------------------- footer and buttons ------------------------- */
  const recap = e('quickRecap');
  if (recap) {
    const parts = [];
    if (quick.sport) parts.push(SPORTS.find((x) => x.id === quick.sport)?.name);
    if (quick.club) parts.push(teamById(quick.club).name);
    if (quick.step === 'mode') parts.push(quick.mode === 'practice' ? 'Practice' : 'Match');
    recap.textContent = parts.filter(Boolean).join(' · ');
  }

  const back = e('quickBack');
  const go = e('quickGo');
  const atStart = quick.step === 'sport';
  if (back) back.hidden = atStart;
  if (go) {
    const ready = quick.step === 'club' ? !!quick.club : true;
    go.disabled = !ready;
    go.textContent =
      quick.step === 'sport' ? 'CONTINUE →' : quick.step === 'club' ? 'CONTINUE →' : 'KICK OFF ⚡';
  }
}

function quickNext() {
  if (quick.step === 'sport') return setQuickStep('club');
  if (quick.step === 'club') return quick.club ? setQuickStep('mode') : null;
  // commit the choices and go straight to the squad screen
  app.sport = quick.sport || app.sport;
  app.mode = quick.mode;
  app.homeTeam = quick.club || app.homeTeam;
  const others = TEAMS.filter((x) => x.id !== app.homeTeam);
  app.awayTeam = others[Math.floor(Math.random() * others.length)].id;
  app.homePlayer = null;
  app.awayPlayer = null;
  openPlayers(app.sport);
}

function quickBack() {
  const i = QUICK_STEPS.indexOf(quick.step);
  if (i > 0) setQuickStep(QUICK_STEPS[i - 1]);
}

/* ----------------------------- player picker ----------------------------- */
const ROLE_LABELS = ['Forward', 'Winger', 'Midfielder', 'Defender', 'Goalkeeper'];

function openPlayers(sport) {
  app.sport = sport;
  app.matchCount = (app.matchCount || 0) + 1;
  document.body.dataset.sport = sport;
  app.awayTeam = TEAMS.find((t) => t.id !== app.homeTeam)?.id || 'theos';
  const meta = SPORTS.find((s) => s.id === sport);
  document.getElementById('playersTitle').textContent = `Choose your ${sport === 'swimming' ? 'swimmer' : sport === 'basketball' ? 'baller' : 'player'}`;
  document.getElementById('playersSub').textContent = `${meta.name} · ${meta.venue} · Seroma League`;
  document.getElementById('startMatch').textContent =
    sport === 'swimming' ? 'DIVE IN' : sport === 'basketball' ? 'TIP OFF' : 'KICK OFF';
  const modeRow = document.getElementById('modeToggle');
  if (modeRow) modeRow.classList.toggle('hidden', sport === 'swimming');
  buildPlayerPicker();
  show('screen-players');
}

function buildModeToggle() {
  const modes = document.querySelectorAll('#modeToggle .mode-btn');
  const note = document.getElementById('modeNote');
  const notes = {
    match: 'Full match. Crowd in, clock running, opponents pressing.',
    practice: 'Practice: no clock, a keeper you can beat, great for learning the controls.',
  };
  modes.forEach((b) => {
    b.classList.toggle('on', b.dataset.mode === app.mode);
    b.onclick = () => {
      app.mode = b.dataset.mode;
      audio.click();
      buildModeToggle();
    };
  });
  if (note) note.textContent = notes[app.mode];
}

function buildPlayerPicker() {
  buildModeToggle();
  const picker = document.getElementById('teamPicker');
  picker.innerHTML = '';
  TEAMS.forEach((t) => {
    const chip = document.createElement('button');
    chip.className = 'chip' + (t.id === app.homeTeam ? ' on' : '');
    chip.innerHTML = `<i style="background:${t.colors.primary}"></i>${t.name}`;
    chip.onclick = () => {
      app.homeTeam = t.id;
      const others = TEAMS.filter((x) => x.id !== t.id);
      app.awayTeam = others[Math.floor(Math.random() * others.length)].id;
      app.homePlayer = null;
      app.awayPlayer = null;
      audio.click();
      buildPlayerPicker();
    };
    picker.appendChild(chip);
  });

  const grid = document.getElementById('squadGrid');
  grid.innerHTML = '';
  const squad = squadFor(app.homeTeam, 5);
  if (!app.homePlayer || !squad.includes(app.homePlayer)) app.homePlayer = squad[0];
  const team = teamById(app.homeTeam);
  squad.forEach((name, i) => {
    const card = document.createElement('button');
    card.className = 'player-card' + (name === app.homePlayer ? ' on' : '');
    const role = ROLE_LABELS[i % ROLE_LABELS.length];
    const portrait = portraitURL({
      name,
      team,
      sport: app.sport,
      width: 260,
      height: 320,
    });
    card.innerHTML = `
      ${name === app.homePlayer ? '<span class="badge">YOU</span>' : ''}
      <div class="pc-portrait">
        <img src="${portrait}" alt="3D illustration of ${name}" width="260" height="320" loading="lazy" />
        <span class="num">${i + 1}</span>
      </div>
      <div class="pc-meta">
        <div class="pname">${name}</div>
        <div class="role">${role}</div>
      </div>`;
    card.onclick = () => {
      app.homePlayer = name;
      audio.click();
      buildPlayerPicker();
    };
    grid.appendChild(card);
  });

  const away = teamById(app.awayTeam);
  const awaySquad = squadFor(away.id, 5);
  if (!app.awayPlayer || !awaySquad.includes(app.awayPlayer))
    app.awayPlayer = awaySquad[Math.floor(Math.random() * awaySquad.length)];

  const sel = document.getElementById('selectionSummary');
  sel.innerHTML = `<span>${team.name} · ${team.coach}</span><b>${app.homePlayer}</b>vs ${away.name} · ${away.coach}`;
}

/* -------------------------------- gameplay -------------------------------- */
function startGame() {
  showLoader();
  hideHud();
  teardownGame();
  const sport = app.sport;
  const opts = {
    homeTeam: app.homeTeam,
    awayTeam: app.awayTeam,
    homePlayer: app.homePlayer,
    awayPlayer: app.awayPlayer,
    practice: app.mode === 'practice',
    onEvent: (e) => app.hudUI?.onEvent(e),
    onEnd: (r) => finishGame(r),
  };
  let game;
  try {
    if (sport === 'football') game = new FootballGame(app.stage, opts);
    else if (sport === 'basketball') game = new BasketballGame(app.stage, opts);
    else game = new SwimmingGame(app.stage, opts);
  } catch (err) {
    console.error(err);
    hideLoader();
    show('screen-players');
    toast('Could not start the 3D game on this device.');
    return;
  }
  app.game = game;
  const input = new Input(game.canvas);
  app.input = input;
  game.attachInput(input);

  Promise.resolve(game.init())
    .then(() => {
      hideLoader();
      showHud();
      app.hudUI = new Hud(app.hud, {
        sport,
        onAction: (a) => input.action(a),
        onKickDown: () => input.pressKick(),
        onKickUp: () => input.releaseKick(),
        onPause: () => pauseGame(),
        onStroke: () => input.action('kickDown'),
        getTouchStick: () => input.stickVis,
      });
      app.hudUI.reset();
      input.resetPresses();
      input.enabled = true;
      game.start();
      audio.unlock();
      document.body.dataset.sport = sport;
    })
    .catch((err) => {
      console.error(err);
      hideLoader();
      show('screen-players');
      toast('The pitch failed to load. Try again.');
    });
}

function teardownGame() {
  hideHud();
  if (app.hudUI) {
    app.hudUI.destroy();
    app.hudUI = null;
  }
  if (app.game) {
    try {
      app.game.destroy();
    } catch (e) {
      console.error(e);
    }
    app.game = null;
  }
  if (app.input) {
    app.input.destroy();
    app.input = null;
  }
  app.stage.innerHTML = '';
}

let hudLoop = null;
function startHudLoop() {
  cancelAnimationFrame(hudLoop);
  const tick = () => {
    if (app.game && app.hudUI) {
      try {
        app.hudUI.update(app.game.getHUD());
      } catch (e) {
        /* ignore transient teardown errors */
      }
    }
    hudLoop = requestAnimationFrame(tick);
  };
  hudLoop = requestAnimationFrame(tick);
}

function pauseGame() {
  if (!app.game || app.game.finished) return;
  app.game.setPaused(true);
  if (app.input) app.input.enabled = false;
  show('screen-pause');
}
function resumeGame() {
  if (!app.game) return;
  app.game.setPaused(false);
  if (app.input) {
    app.input.enabled = true;
    app.input.keys.clear();
    app.input.setMove(0, 0);
  }
  showHud();
}

function finishGame(result) {
  setTimeout(() => {
    hideHud();
    if (app.hudUI) app.hudUI.destroy();
    app.hudUI = null;
    renderResult(result);
    show('screen-result');
  }, 900);
}

function verdict(html) {
  const el = document.getElementById('resultVerdict');
  if (el) el.innerHTML = html || '';
}

function renderResult(r) {
  const sport = app.sport;
  const title = document.getElementById('resultTitle');
  const kicker = document.getElementById('resultKicker');
  const score = document.getElementById('resultScore');
  const stats = document.getElementById('resultStats');
  const home = teamById(app.homeTeam);
  const away = teamById(app.awayTeam);

  // the 3D celebration/loss art matches the mood of the result
  const photo = document.getElementById('resultPhoto');
  if (photo) {
    const won = r.result === 'win';
    const pool = won ? ['celebration', 'ballgames'] : ['stadium', 'swimmers'];
    const pick = pool[(app.matchCount || 0) % pool.length];
    photo.src = `./img/${pick}.jpg`;
    photo.alt = won
      ? 'Seroma team celebrating with the trophy, 3D render'
      : 'Seroma scenes after the final whistle, 3D render';
  }

  if (sport === 'football') {
    kicker.textContent = 'FULL TIME · SEROMA LEAGUE';
    title.textContent = r.result === 'win' ? 'Victory!' : r.result === 'draw' ? 'Honours even' : 'Defeat';
    score.textContent = `${r.home} – ${r.away}`;
    const s2 = r.stats;
    stats.innerHTML = [
      ['Shots', `${s2.shots}`],
      ['On target', `${s2.onTarget ?? 0}`],
      ['Possession', `${s2.possession ?? 0}%`],
      ['Top speed', `${s2.topSpeedKmh ?? 0}`],
      ['Passes', `${s2.passes}`],
      ['Tackles', `${s2.tackles}`],
    ]
      .map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`)
      .join('');
    verdict(
      r.result === 'win'
        ? `<b>Player of the match.</b> ${s2.goals} goal${s2.goals === 1 ? '' : 's'} from ${s2.shots} shot${
            s2.shots === 1 ? '' : 's'
          }. ${s2.possession ?? 0}% of the ball was yours.`
        : r.result === 'draw'
        ? `<b>Honours even.</b> You kept ${s2.possession ?? 0}% of possession and topped out at ${s2.topSpeedKmh ?? 0} km/h.`
        : `<b>Plenty to build on.</b> ${s2.onTarget ?? 0} of ${s2.shots} shots found the target. The crowd wants more.`
    );
  } else if (sport === 'basketball') {
    kicker.textContent = 'FINAL BUZZER · SEROMA COURT';
    title.textContent = r.result === 'win' ? 'Bucket!' : r.result === 'draw' ? 'Tied up' : 'Rim out';
    score.textContent = `${r.score} – ${r.oppScore}`;
    const bst = r.stats || {};
    stats.innerHTML = [
      ['Your points', r.score],
      ['Best run', r.best],
      ['Opponent', r.oppScore],
      ['Green releases', bst.green ?? 0],
      ['Shots taken', bst.shots ?? 0],
    ]
      .map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`)
      .join('');
    verdict(
      r.result === 'win'
        ? `<b>Bucket after bucket.</b> ${bst.green ?? 0} of your releases dropped through the green.`
        : `<b>Keep shooting.</b> Best run ${r.best}. The net will open up.`
    );
  } else {
    kicker.textContent = 'RACE COMPLETE · SEROMA AQUATICS';
    title.textContent = r.result === 'win' ? 'Gold for you!' : r.position === 2 ? 'Silver lane' : 'Touched out';
    score.textContent = `P${r.position} · ${r.time.toFixed(2)}s`;
    const acc = r.strokes ? Math.round((r.perfect / r.strokes) * 100) : 0;
    stats.innerHTML = [
      ['Position', 'P' + r.position],
      ['Stroke accuracy', acc + '%'],
      ['Perfect strokes', r.perfect],
      ['Strokes', r.strokes],
      ['Time', r.time.toFixed(2) + 's'],
    ]
      .map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`)
      .join('');
    verdict(
      acc >= 60
        ? `<b>Beautiful rhythm.</b> ${acc}% of your strokes hit the sweet spot.`
        : `<b>Tidy up the timing.</b> ${r.perfect} of ${r.strokes} strokes were perfect. Aim for the middle of the cycle.`
    );
  }
  app.lastResult = r;
  const poll = document.getElementById('resultPoll');
  if (poll) poll.href = SCHOOL.poll;
}

/* --------------------------------- wiring -------------------------------- */
function bind() {
  document.getElementById('playNow').onclick = () => {
    audio.unlock();
    audio.click();
    openQuick(null);
  };
  document.getElementById('quickGo').onclick = () => {
    audio.click();
    quickNext();
  };
  document.getElementById('quickBack').onclick = () => {
    audio.click();
    quickBack();
  };
  document.getElementById('quickClose').onclick = () => {
    audio.click();
    show('screen-home');
  };
  document.querySelectorAll('#quickSteps li').forEach((li) => {
    li.onclick = () => {
      const idx = QUICK_STEPS.indexOf(li.dataset.step);
      const cur = QUICK_STEPS.indexOf(quick.step);
      if (idx <= cur) {
        audio.click();
        setQuickStep(li.dataset.step);
      }
    };
  });

  const rotateSkip = document.getElementById('rotateSkip');
  if (rotateSkip) {
    rotateSkip.onclick = () => {
      audio.click();
      document.body.classList.add('rotate-dismissed');
    };
  }

  document.getElementById('howBtn').onclick = () => {
    audio.click();
    show('screen-how');
  };
  document.querySelectorAll('[data-back]').forEach((b) => {
    b.onclick = () => {
      audio.click();
      show('screen-home');
    };
  });
  document.getElementById('startMatch').onclick = () => {
    audio.unlock();
    audio.click();
    startGame();
    startHudLoop();
  };
  document.getElementById('rematch').onclick = () => {
    audio.click();
    startGame();
    startHudLoop();
  };
  document.getElementById('toMenu').onclick = () => {
    audio.click();
    teardownGame();
    show('screen-home');
  };
  document.getElementById('resume').onclick = () => {
    audio.click();
    resumeGame();
  };
  document.getElementById('quitMatch').onclick = () => {
    audio.click();
    teardownGame();
    show('screen-home');
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && app.game && !app.game.finished) pauseGame();
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && app.game && !app.game.finished) {
      const paused = app.game.paused;
      if (paused) resumeGame();
      else pauseGame();
    }
  });
}

/* ---------------------------------- boot --------------------------------- */
function boot() {
  buildHome();
  setVenue(venueForSport(app.sport).id);
  bind();
  show('screen-home');
  // warm the menu image
  const img = new Image();
  img.src = './img/hero.jpg';
  if (!window.WebGLRenderingContext) {
    toast('This device does not support WebGL, so the 3D games cannot run.');
  }
  document.getElementById('loader').classList.add('hidden');
}

boot();
