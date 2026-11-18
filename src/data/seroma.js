/**
 * THE SEROMA LEAGUE — data layer
 * Squads, coaches and award nominees are taken from "THE SEROMA LEAGUE VOTING POLL"
 * (Google Form). School context from seroma.ac.ug (Seroma Christian High School, Mukono, Uganda).
 */

export const SCHOOL = {
  name: 'Seroma Christian High School',
  short: 'SEROMA',
  motto: 'Heads But Not Tails',
  vision: 'The Global Hub for Christ-centred Education and Services.',
  mission:
    'To equip Christ-centred, self-motivated and skilled emerging leaders through quality education.',
  founded: 2002,
  founders: 'Lt. Col. Robert and Mrs Margaret Sekidde',
  values: ['Lordship', 'Integrity', 'Excellence', 'Teamwork', 'Hard Work', 'Respect for Others & Property'],
  location: 'Mukono, Uganda',
  phone: '+256 776 880 831',
  email: 'seroma.ac@gmail.com',
  site: 'https://www.seroma.ac.ug/',
  poll: 'https://docs.google.com/forms/d/e/1FAIpQLSeHAlmLZ1cJ18nCanmuQ_6eIEw-BDF8pdDCyPcHeoOXy_l6KA/viewform',
};

/** Team colours: primary, secondary (kit trim), shorts. */
export const TEAMS = [
  {
    id: 'licans',
    name: 'Licans',
    coach: 'TUMUSIIME RONALD',
    colors: { primary: '#f4c518', secondary: '#1c2541', shorts: '#1c2541' },
    accent: '#f4c518',
  },
  {
    id: 'celestials',
    name: 'Celestials',
    coach: 'KISAKYE RODNEY',
    colors: { primary: '#f2f4f8', secondary: '#7b5cff', shorts: '#7b5cff' },
    accent: '#a48bff',
  },
  {
    id: 'galacticals',
    name: 'Galacticals',
    coach: 'MALINGA CHARLES',
    colors: { primary: '#2f6df6', secondary: '#0b1b3f', shorts: '#0b1b3f' },
    accent: '#4f8bff',
  },
  {
    id: 'levites',
    name: 'Levites',
    coach: 'MUKAMA MARTIN',
    colors: { primary: '#7a3ff2', secondary: '#ffffff', shorts: '#ffffff' },
    accent: '#9b6bff',
  },
  {
    id: 'legendaries',
    name: 'Legendaries',
    coach: 'KAGIMU MIKE',
    colors: { primary: '#111318', secondary: '#e9c46a', shorts: '#111318' },
    accent: '#e9c46a',
  },
  {
    id: 'gaucho',
    name: 'FC Gaucho',
    coach: 'KIRUNGI JOSEPHAT',
    colors: { primary: '#e63946', secondary: '#f1faee', shorts: '#f1faee' },
    accent: '#ff6b6b',
  },
  {
    id: 'raptors',
    name: 'Raptors',
    coach: 'KATO SWITCH',
    colors: { primary: '#1f9d55', secondary: '#0d2b1a', shorts: '#0d2b1a' },
    accent: '#41d68a',
  },
  {
    id: 'rostocks',
    name: 'Rostocks',
    coach: 'GOLOOBA AHMED',
    colors: { primary: '#f77f00', secondary: '#14213d', shorts: '#14213d' },
    accent: '#ffa143',
  },
  {
    id: 'titans',
    name: 'Titans',
    coach: 'ENOCH TRESH',
    colors: { primary: '#6c757d', secondary: '#ffd166', shorts: '#ffd166' },
    accent: '#adb5bd',
  },
  {
    id: 'theos',
    name: 'Theos',
    coach: 'NAKACHWA SAMALIE',
    colors: { primary: '#00a8a8', secondary: '#032b2b', shorts: '#032b2b' },
    accent: '#3ee0e0',
  },
  {
    id: 'elites',
    name: 'Elites',
    coach: 'SHAMIM NUDU',
    colors: { primary: '#c1121f', secondary: '#0a0a0a', shorts: '#0a0a0a' },
    accent: '#ff4d5e',
  },
  {
    id: 'spartans',
    name: 'Spartans',
    coach: 'KAAYA JOEL',
    colors: { primary: '#264653', secondary: '#e76f51', shorts: '#e76f51' },
    accent: '#5896a8',
  },
];

/** Players exactly as listed on the voting poll, grouped by club. */
export const SQUADS = {
  licans: ['NAKI BELINDA', 'HOTIMUS JOSEPH', 'OPIO JOSHUA', 'ARINDA BAKER', 'SSERWADA RICHIE'],
  celestials: ['TENDO MILVET', 'SSEMUJJU FELIX', 'WALUBIRI COLLINS', 'AMIGO INNOCENT'],
  galacticals: ['NAKALEMA GYVEN', 'WAMBETE JUDAH', 'KAWEESA IVAN', 'KAMULEGEYA IBRAH'],
  levites: ['SAMANTHA SAIRE', 'MAKEDDE TERANCE', 'ATEGEKA MARVIN', 'DENG MARTIN'],
  legendaries: ['NAMULINDWA FAIRUZ', 'KYOTAKALILE KIM', 'SSEKIZIYIVU IAN', 'KIZITO MIKE', 'ALPHA KENNEDY'],
  gaucho: ['TEBA RACHEAL', 'KELLY KEVIN', 'OKOT TOBY', 'DRICHI FRANCIS', 'MARK MULUWA'],
  raptors: ['GAYI VINCENT'],
  rostocks: ['BALAM OWORA'],
  titans: [],
  theos: [
    'MWESIGWA DAVID',
    'KIYAGA ALEX',
    'SSALI VICENT',
    'SEMBUYA RONALD',
    'EKWONG EMMANUEL',
    'MUHAME ELISHA',
  ],
  elites: ['SENYONJO NICHOLAS', 'NATAL EMMANUEL', 'SEMBATYA JOSEPH', 'JUMA IDRIS'],
  spartans: ['ENOCH TRESH', 'SSENYONDO NELLY', 'JJUNJU EDGAR'],
};

/** Academy / junior players used to complete match-day squads on the pitch. */
export const FILLERS = {
  licans: ['T. KIGGUNDU', 'B. NAMBI'],
  celestials: ['A. NABIRYE', 'P. OKELLO'],
  galacticals: ['S. KIRABO', 'M. OCHIENG'],
  levites: ['D. NANSUBUGA', 'G. WASSWA'],
  legendaries: ['I. MASABA', 'F. NAKATO'],
  gaucho: ['C. LUBEGA', 'R. ATIM'],
  raptors: ['J. MUSOKE', 'K. AKANDWANAHO', 'H. NAIGAGA', 'E. BYARUHANGA'],
  rostocks: ['W. OYAA', 'L. NABUKENYA', 'T. SENTONGO', 'P. ACHOLA'],
  titans: ['A. MUKASA', 'N. KEMIGISHA', 'S. ODONGO', 'B. ATUHAIRE', 'D. KIZZA'],
  theos: ['J. BUKENYA'],
  elites: ['R. KAKOOZA', 'V. NABWIRE'],
  spartans: ['Z. KATO', 'Y. NAMULI'],
};

/** Award categories and nominees — straight from the poll. `votes` = seeded fan share. */
export const POLL_CATEGORIES = [
  {
    id: 'coach',
    title: 'Best Coach of the Season',
    nominees: [
      { name: 'TUMUSIIME RONALD', team: 'Licans', votes: 118 },
      { name: 'KISAKYE RODNEY', team: 'Celestials', votes: 96 },
      { name: 'MALINGA CHARLES', team: 'Galacticals', votes: 132 },
      { name: 'MUKAMA MARTIN', team: 'Levites', votes: 88 },
      { name: 'KAGIMU MIKE', team: 'Legendaries', votes: 74 },
      { name: 'KIRUNGI JOSEPHAT', team: 'FC Gaucho', votes: 141 },
      { name: 'KATO SWITCH', team: 'Raptors', votes: 51 },
      { name: 'GOLOOBA AHMED', team: 'Rostocks', votes: 44 },
      { name: 'ENOCH TRESH', team: 'Titans', votes: 61 },
    ],
  },
  {
    id: 'female',
    title: 'Best Female Player of the Season',
    nominees: [
      { name: 'NAKACHWA SAMALIE', team: 'Theos', votes: 103 },
      { name: 'NAKALEMA GYVEN', team: 'Galacticals', votes: 94 },
      { name: 'NAMULINDWA FAIRUZ', team: 'Legendaries', votes: 87 },
      { name: 'SAMANTHA SAIRE', team: 'Levites', votes: 79 },
      { name: 'TENDO MILVET', team: 'Celestials', votes: 121 },
      { name: 'SHAMIM NUDU', team: 'Elites', votes: 66 },
      { name: 'TEBA RACHEAL', team: 'FC Gaucho', votes: 58 },
      { name: 'NAKI BELINDA', team: 'Licans', votes: 72 },
    ],
  },
  {
    id: 'keeper',
    title: 'Best Goalkeeper of the Season',
    nominees: [
      { name: 'SENYONJO NICHOLAS', team: 'Elites', votes: 96 },
      { name: 'WAMBETE JUDAH', team: 'Galacticals', votes: 112 },
      { name: 'KELLY KEVIN', team: 'FC Gaucho', votes: 78 },
      { name: 'MWESIGWA DAVID', team: 'Theos', votes: 64 },
      { name: 'HOTIMUS JOSEPH', team: 'Licans', votes: 53 },
      { name: 'KYOTAKALILE KIM', team: 'Legendaries', votes: 47 },
      { name: 'KAAYA JOEL', team: 'Spartans', votes: 39 },
    ],
  },
  {
    id: 'defender',
    title: 'Best Defender of the Season',
    nominees: [
      { name: 'NATAL EMMANUEL', team: 'Elites', votes: 88 },
      { name: 'KIYAGA ALEX', team: 'Theos', votes: 71 },
      { name: 'SSEKIZIYIVU IAN', team: 'Legendaries', votes: 65 },
      { name: 'SSERWADA RICHIE', team: 'Licans', votes: 83 },
      { name: 'SSALI VICENT', team: 'Theos', votes: 54 },
      { name: 'ENOCH TRESH', team: 'Spartans', votes: 49 },
      { name: 'OKOT TOBY', team: 'FC Gaucho', votes: 58 },
      { name: 'GAYI VINCENT', team: 'Raptors', votes: 36 },
    ],
  },
  {
    id: 'midfielder',
    title: 'Best Midfielder of the Season',
    nominees: [
      { name: 'EKWONG EMMANUEL', team: 'Theos', votes: 108 },
      { name: 'SEMBATYA JOSEPH', team: 'Elites', votes: 92 },
      { name: 'OPIO JOSHUA', team: 'Licans', votes: 84 },
      { name: 'KAWEESA IVAN', team: 'Galacticals', votes: 76 },
      { name: 'WALUBIRI COLLINS', team: 'Celestials', votes: 69 },
      { name: 'SEMBUYA RONALD', team: 'Theos', votes: 63 },
      { name: 'DRICHI FRANCIS', team: 'FC Gaucho', votes: 57 },
      { name: 'SSENYONDO NELLY', team: 'Spartans', votes: 41 },
      { name: 'KIZITO MIKE', team: 'Legendaries', votes: 38 },
      { name: 'ATEGEKA MARVIN', team: 'Levites', votes: 44 },
    ],
  },
  {
    id: 'forward',
    title: 'Best Forward of the Season',
    nominees: [
      { name: 'DENG MARTIN', team: 'Levites', votes: 126 },
      { name: 'ARINDA BAKER', team: 'Licans', votes: 111 },
      { name: 'JUMA IDRIS', team: 'Elites', votes: 97 },
      { name: 'ALPHA KENNEDY', team: 'Legendaries', votes: 88 },
      { name: 'MUHAME ELISHA', team: 'Theos', votes: 81 },
      { name: 'AMIGO INNOCENT', team: 'Celestials', votes: 74 },
      { name: 'KAMULEGEYA IBRAH', team: 'Galacticals', votes: 66 },
      { name: 'BALAM OWORA', team: 'Rostocks', votes: 48 },
      { name: 'MARK MULUWA', team: 'FC Gaucho', votes: 52 },
      { name: 'JJUNJU EDGAR', team: 'Spartans', votes: 43 },
    ],
  },
];

export const SPORTS = [
  {
    id: 'football',
    name: 'Football',
    tagline: 'Jubilee Pitch · 5-a-side',
    icon: '⚽',
    blurb: 'See the pitch through your own eyes. Look where you want to shoot.',
    photo: 'img/football.jpg',
    photoAlt: 'Football at Seroma, 3D render',
    venue: 'Jubilee Pitch',
  },
  {
    id: 'basketball',
    name: 'Basketball',
    tagline: 'Seroma Court · 3x3',
    icon: '🏀',
    blurb: 'Hold, aim at the rim, and let it fly over the defenders.',
    photo: 'img/basketball.jpg',
    photoAlt: 'Basketball at Seroma, 3D render',
    venue: 'Seroma Court',
  },
  {
    id: 'swimming',
    name: 'Swimming',
    tagline: 'Seroma Aquatics · 50m',
    icon: '🏊',
    blurb: 'Tap in rhythm, keep your lane, and chase down the leaders.',
    photo: 'img/swimming.jpg',
    photoAlt: 'Swimming at Seroma, 3D render',
    venue: 'Aquatics Centre',
  },
];

export const CAMPUS_FACTS = [
  { title: 'Founded 2002', body: 'Started by Lt. Col. Robert and Mrs Margaret Sekidde with a handful of students.' },
  { title: 'Four-star school', body: 'Ranked among the nine four-star private secondary schools in Uganda (2009 MoES ranking).' },
  { title: 'O & A Level', body: 'Ordinary Level S1–S4 and Advanced Level S5–S6, with a full co-curricular programme.' },
  { title: 'Sporting powerhouse', body: 'Seroma hosts national USSSA Ball Games and has won national swimming titles.' },
  { title: 'Wisdom Hall', body: 'The terracotta-roofed assembly hall at the heart of campus life and worship.' },
  { title: 'Christ-centred', body: 'Lordship, Integrity, Excellence, Teamwork, Hard Work and Respect shape every Seroma student.' },
];

export function teamById(id) {
  return TEAMS.find((t) => t.id === id) || TEAMS[0];
}

/** Players for a club, padded with academy names so every match squad is full. */
export function squadFor(id, minimum = 5, mustInclude = null) {
  const base = (SQUADS[id] || []).slice();
  if (mustInclude && !base.includes(mustInclude)) base.unshift(mustInclude);
  const extra = (FILLERS[id] || []).slice();
  let i = 0;
  while (base.length < minimum && i < extra.length) base.push(extra[i++]);
  while (base.length < minimum) base.push('SEROMA XI ' + (base.length + 1));
  return base;
}

export function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
}
