/**
 * AVK Envisions KAS 50 Days — the published day-by-day timetable.
 *
 * 10 Sep 2026 → 29 Oct 2026, one 50-question paper a day, then a final
 * revision window of 30 Oct – 14 Nov and the Prelims on 15 Nov 2026.
 *
 * Transcribed from the published schedule. `subject` is matched against the
 * catalogue by name, so the strings here must stay exactly as the subjects are
 * named there — the /50-days page groups consecutive days by paper and subject
 * into the coloured bands, which is why the order matters as much as the dates.
 *
 * `focus` becomes the paper's title, since that is what the page shows as the
 * day's heading.
 */
export interface FiftyDay {
  /** Day 1-50. */
  day: number;
  /** ISO date the paper unlocks. */
  date: string;
  /** 1 or 2 — which of the two Prelims papers the day belongs to. */
  paper: 1 | 2;
  /** Catalogue subject name, or null where the day spans several. */
  subject: string | null;
  /** The day's key focus. Shown as the paper's title. */
  focus: string;
  /** Syllabus detail for the briefing screen. */
  topics: string;
}

// The revision window and exam date live in src/lib/enums.ts, so the page and
// this timetable cannot drift apart. Re-exported here only so a reader of the
// schedule can see what follows day 50 without hunting for it.
export {
  KAS_PRELIMS_DATE,
  KAS_REVISION_FROM,
  KAS_REVISION_TO,
} from '../../src/lib/enums';

export const KAS_50_DAYS: FiftyDay[] = [
  // --- Paper 1 · Polity & Governance ---------------------------------------
  {
    day: 1,
    date: '2026-09-10',
    paper: 1,
    subject: 'Indian Polity',
    focus: 'Constitutional Foundations',
    topics:
      'Constitutional history; Constituent Assembly; Preamble; salient features; citizenship; Union & territory',
  },
  {
    day: 2,
    date: '2026-09-11',
    paper: 1,
    subject: 'Indian Polity',
    focus: 'Fundamental Rights & Constitutional Principles',
    topics:
      'Fundamental Rights; DPSP; Fundamental Duties; Constitutional Remedies; Basic Structure; Constitutional Amendments',
  },
  {
    day: 3,
    date: '2026-09-12',
    paper: 1,
    subject: 'Indian Polity',
    focus: 'Union Executive & Parliament',
    topics:
      'President; Vice-President; Prime Minister; Council of Ministers; Parliament; parliamentary procedures',
  },
  {
    day: 4,
    date: '2026-09-13',
    paper: 1,
    subject: 'Indian Polity',
    focus: 'Judiciary, Federalism & Governance',
    topics:
      'Supreme Court; High Courts; Centre–State relations; Governor; State Legislature; Local Government; Elections; Constitutional & Statutory Bodies; RTI; Karnataka administration',
  },
  {
    day: 5,
    date: '2026-09-14',
    paper: 1,
    subject: 'Indian Polity',
    focus: 'COMPLETE POLITY & GOVERNANCE TEST',
    topics:
      'Full subject test covering Indian Polity, Governance, Constitution and Karnataka administration',
  },

  // --- Paper 1 · History & Culture -----------------------------------------
  {
    day: 6,
    date: '2026-09-15',
    paper: 1,
    subject: 'History',
    focus: 'Ancient India — Foundations',
    topics:
      'Indus Valley Civilisation; Vedic Age; Mahajanapadas; Buddhism; Jainism; Mauryas',
  },
  {
    day: 7,
    date: '2026-09-16',
    paper: 1,
    subject: 'History',
    focus: 'Ancient India — Culture & Empires',
    topics:
      'Post-Mauryan period; Sangam age; Gupta period; ancient culture; literature; science; architecture',
  },
  {
    day: 8,
    date: '2026-09-17',
    paper: 1,
    subject: 'History',
    focus: 'Medieval India',
    topics: 'Delhi Sultanate; Vijayanagara; Bahmani; Mughals; Marathas; medieval culture',
  },
  {
    day: 9,
    date: '2026-09-18',
    paper: 1,
    subject: 'History',
    focus: 'Modern India & Karnataka',
    topics:
      'European expansion; British rule; Mysore; Hyder Ali; Tipu Sultan; Revolt of 1857; social reform; nationalism; Karnataka freedom movement',
  },
  {
    day: 10,
    date: '2026-09-19',
    paper: 1,
    subject: 'History',
    focus: 'COMPLETE HISTORY & CULTURE TEST',
    topics:
      'Full History & Culture test including National Movement and Karnataka History & Culture',
  },

  // --- Paper 1 · Geography --------------------------------------------------
  {
    day: 11,
    date: '2026-09-20',
    paper: 1,
    subject: 'Geography',
    focus: 'Physical Geography',
    topics: 'Earth; interior; rocks; plate tectonics; earthquakes; volcanoes; geomorphology',
  },
  {
    day: 12,
    date: '2026-09-21',
    paper: 1,
    subject: 'Geography',
    focus: 'Atmosphere, Climate & Oceans',
    topics: 'Atmosphere; climate; monsoon; oceans; currents; natural vegetation; soils',
  },
  {
    day: 13,
    date: '2026-09-22',
    paper: 1,
    subject: 'Geography',
    focus: 'Geography of India',
    topics: 'Physiography; rivers; climate; soils; vegetation; major geographical regions',
  },
  {
    day: 14,
    date: '2026-09-23',
    paper: 1,
    subject: 'Geography',
    focus: 'Resources, Economy & Karnataka Geography',
    topics:
      'Agriculture; minerals; energy; industries; population; transport; Karnataka geography',
  },
  {
    day: 15,
    date: '2026-09-24',
    paper: 1,
    subject: 'Geography',
    focus: 'COMPLETE GEOGRAPHY TEST',
    topics: 'World + India + Karnataka Geography',
  },

  // --- Paper 1 · Economy ----------------------------------------------------
  {
    day: 16,
    date: '2026-09-25',
    paper: 1,
    subject: 'Indian Economy',
    focus: 'Basic Economy',
    topics:
      'GDP/GVA; national income; growth & development; inflation; unemployment; poverty',
  },
  {
    day: 17,
    date: '2026-09-26',
    paper: 1,
    subject: 'Indian Economy',
    focus: 'Money & Banking',
    topics:
      'RBI; monetary policy; banking system; financial institutions; financial inclusion',
  },
  {
    day: 18,
    date: '2026-09-27',
    paper: 1,
    subject: 'Indian Economy',
    focus: 'Fiscal Policy',
    topics: 'Taxation; government finances; deficits; public debt; public expenditure',
  },
  {
    day: 19,
    date: '2026-09-28',
    paper: 1,
    subject: 'Indian Economy',
    focus: 'Sectors, External Sector & Reforms',
    topics: 'Agriculture; industry; infrastructure; external sector; economic reforms',
  },
  {
    day: 20,
    date: '2026-09-29',
    paper: 1,
    subject: 'Indian Economy',
    focus: 'UNION + KARNATAKA BUDGET & ECONOMIC SURVEY',
    topics:
      'Key allocations; policies; data; priorities; findings; important terms; implications',
  },
  {
    day: 21,
    date: '2026-09-30',
    paper: 1,
    subject: 'Indian Economy',
    focus: 'GOVERNMENT SCHEMES & POLICIES',
    topics:
      'Central + Karnataka schemes; objectives; target groups; ministries/departments; recent changes',
  },
  {
    day: 22,
    date: '2026-10-01',
    paper: 1,
    subject: 'Indian Economy',
    focus: 'COMPLETE ECONOMY TEST',
    topics: 'Indian + Karnataka Economy; Budget; Economic Survey; Schemes & Policies',
  },

  // --- Paper 2 · Environment & Ecology -------------------------------------
  {
    day: 23,
    date: '2026-10-02',
    paper: 2,
    subject: 'Environment',
    focus: 'Ecology & Ecosystems',
    topics: 'Ecology; ecosystems; food chains/webs; biodiversity; biomes',
  },
  {
    day: 24,
    date: '2026-10-03',
    paper: 2,
    subject: 'Environment',
    focus: 'Forests, Wildlife & Conservation',
    topics:
      'Forests; wildlife; protected areas; national parks; sanctuaries; biodiversity conservation; Karnataka',
  },
  {
    day: 25,
    date: '2026-10-04',
    paper: 2,
    subject: 'Environment',
    focus: 'Pollution & Climate Change',
    topics: 'Pollution; climate change; global warming; environmental degradation',
  },
  {
    day: 26,
    date: '2026-10-05',
    paper: 2,
    subject: 'Environment',
    focus: 'Environmental Governance & Sustainability',
    topics:
      'Environmental laws; institutions; conventions; sustainable development; environmental disasters',
  },
  {
    day: 27,
    date: '2026-10-06',
    paper: 2,
    subject: 'Environment',
    focus: 'COMPLETE ENVIRONMENT & ECOLOGY TEST',
    topics: 'Full Environment & Ecology test with Karnataka and contemporary issues',
  },

  // --- Paper 2 · Science & Technology ---------------------------------------
  {
    day: 28,
    date: '2026-10-07',
    paper: 2,
    subject: 'Science & Technology',
    focus: 'Physics, Chemistry & Everyday Science',
    topics: 'Core concepts; everyday applications; important scientific phenomena',
  },
  {
    day: 29,
    date: '2026-10-08',
    paper: 2,
    subject: 'Science & Technology',
    focus: 'Biology, Health & Biotechnology',
    topics:
      'Human body; diseases; health; biotechnology; contemporary developments',
  },
  {
    day: 30,
    date: '2026-10-09',
    paper: 2,
    subject: 'Science & Technology',
    focus: 'Space, Defence, Nuclear & Energy',
    topics: 'Space; defence technology; nuclear technology; energy; renewable energy',
  },
  {
    day: 31,
    date: '2026-10-10',
    paper: 2,
    subject: 'Science & Technology',
    focus: 'AI, IT & Emerging Technologies',
    topics:
      'AI; information technology; semiconductors; communication; emerging technologies',
  },
  {
    day: 32,
    date: '2026-10-11',
    paper: 2,
    subject: 'Science & Technology',
    focus: 'COMPLETE SCIENCE & TECHNOLOGY TEST',
    topics: 'Full Science & Technology test',
  },

  // --- Paper 2 · Mental Ability ---------------------------------------------
  {
    day: 33,
    date: '2026-10-12',
    paper: 2,
    subject: 'Mental Ability',
    focus: 'Numeracy Foundations',
    topics: 'Number systems; simplification; percentages; ratios; averages',
  },
  {
    day: 34,
    date: '2026-10-13',
    paper: 2,
    subject: 'Mental Ability',
    focus: 'Arithmetic Applications',
    topics:
      'Profit & loss; interest; time & work; time-speed-distance; ages; mixtures',
  },
  {
    day: 35,
    date: '2026-10-14',
    paper: 2,
    subject: 'Mental Ability',
    focus: 'Reasoning & Data Interpretation',
    topics:
      'Data interpretation; tables; graphs; logical reasoning; analytical reasoning',
  },
  {
    day: 36,
    date: '2026-10-15',
    paper: 2,
    subject: 'Mental Ability',
    focus: 'COMPLETE MENTAL ABILITY TEST',
    topics:
      'Comprehension; reasoning; decision-making; problem-solving; numeracy; data interpretation',
  },

  // --- Days 37–40 · Paper-wise revision -------------------------------------
  {
    day: 37,
    date: '2026-10-16',
    paper: 1,
    subject: null,
    focus: 'PAPER 1 REVISION — HISTORY + GEOGRAPHY',
    topics:
      'Complete Paper 1 revision: History; Geography; Karnataka History & Culture; relevant national/international current affairs',
  },
  {
    day: 38,
    date: '2026-10-17',
    paper: 1,
    subject: null,
    focus: 'PAPER 1 REVISION — POLITY + ECONOMY',
    topics:
      'Complete Paper 1 revision: Polity; Economy; Social Development; Union/Karnataka Budget & Economic Survey; relevant current affairs',
  },
  {
    day: 39,
    date: '2026-10-18',
    paper: 2,
    subject: null,
    focus: 'PAPER 2 REVISION — KARNATAKA + ENVIRONMENT',
    topics:
      'Karnataka current affairs; Karnataka Government programmes/policies; Environment & Ecology',
  },
  {
    day: 40,
    date: '2026-10-19',
    paper: 2,
    subject: null,
    focus: 'PAPER 2 REVISION — SCIENCE + MENTAL ABILITY',
    topics: 'Science & Technology; Mental Ability; Karnataka-specific developments',
  },

  // --- Days 41–50 · Full paper practice -------------------------------------
  // Alternating Paper 1 and Paper 2, 100 questions each. `subject` is null so
  // the page bands these as one run of full-paper practice rather than
  // splitting them by subject.
  {
    day: 41,
    date: '2026-10-20',
    paper: 1,
    subject: null,
    focus: 'FULL PAPER 1',
    topics: 'Complete Paper 1 syllabus — 100 questions',
  },
  {
    day: 42,
    date: '2026-10-21',
    paper: 2,
    subject: null,
    focus: 'FULL PAPER 2',
    topics: 'Complete Paper 2 syllabus — 100 questions',
  },
  {
    day: 43,
    date: '2026-10-22',
    paper: 1,
    subject: null,
    focus: 'FULL PAPER 1',
    topics: 'Complete Paper 1 syllabus — 100 questions',
  },
  {
    day: 44,
    date: '2026-10-23',
    paper: 2,
    subject: null,
    focus: 'FULL PAPER 2',
    topics: 'Complete Paper 2 syllabus — 100 questions',
  },
  {
    day: 45,
    date: '2026-10-24',
    paper: 1,
    subject: null,
    focus: 'FULL PAPER 1',
    topics: 'Complete Paper 1 syllabus — 100 questions',
  },
  {
    day: 46,
    date: '2026-10-25',
    paper: 2,
    subject: null,
    focus: 'FULL PAPER 2',
    topics: 'Complete Paper 2 syllabus — 100 questions',
  },
  {
    day: 47,
    date: '2026-10-26',
    paper: 1,
    subject: null,
    focus: 'FULL PAPER 1',
    topics: 'Complete Paper 1 syllabus — 100 questions',
  },
  {
    day: 48,
    date: '2026-10-27',
    paper: 2,
    subject: null,
    focus: 'FULL PAPER 2',
    topics: 'Complete Paper 2 syllabus — 100 questions',
  },
  {
    day: 49,
    date: '2026-10-28',
    paper: 1,
    subject: null,
    focus: 'FULL PAPER 1',
    topics: 'Complete Paper 1 syllabus — 100 questions',
  },
  {
    day: 50,
    date: '2026-10-29',
    paper: 2,
    subject: null,
    focus: 'FULL PAPER 2',
    topics: 'Complete Paper 2 syllabus — 100 questions',
  },
];
