/**
 * KAS Prelims 2026 — the 21-test series timetable.
 *
 * Transcribed from the published AVK Envisions schedule. Every test is 100
 * questions in the paid series; the free series runs the same 21 topics as
 * 20-question samples.
 *
 * Tests 16–21 are three examination days, each running Paper I in the morning
 * and Paper II in the afternoon — which is why two entries share a date and are
 * distinguished by `paperNumber` and `session`.
 */
export interface ScheduledTest {
  /** Position in the series, 1–21. */
  no: number;
  /** ISO date the test unlocks. */
  date: string;
  /** Weekday, as printed on the timetable. */
  day: string;
  /** Test name as advertised. */
  name: string;
  /** Full syllabus text shown on the test's briefing screen. */
  syllabus: string;
  /** Subject this test belongs to, matched against the catalogue by name. */
  subject: string | null;
  /** Paper I or II on a full-length simulation day; null for sectional tests. */
  paperNumber: number | null;
  /** MORNING = 10:00–12:00, AFTERNOON = 14:00–16:00. */
  session: 'MORNING' | 'AFTERNOON';
}

export const KAS_2026_SCHEDULE: ScheduledTest[] = [
  {
    no: 1,
    date: '2026-08-25',
    day: 'Tuesday',
    name: 'Polity – 1',
    syllabus:
      'Constitutional history & making; Preamble; salient features; Union & Territory; Citizenship; Fundamental Rights; DPSP; Fundamental Duties; Constitutional Amendments; Basic Structure; important Articles & Schedules; federal/unitary features; Centre–State relations.',
    subject: 'Indian Polity',
    paperNumber: null,
    session: 'MORNING',
  },
  {
    no: 2,
    date: '2026-08-29',
    day: 'Saturday',
    name: 'Polity – 2',
    syllabus:
      'President; Vice-President; PM & Council of Ministers; Parliament & Committees; Supreme Court; High Courts; Governor; CM & State Council; State Legislature; Panchayati Raj & Municipalities; ECI; UPSC/KPSC; CAG; Finance Commission; AGI/Advocate General; Constitutional & Statutory Bodies; Tribunals; Emergency; Special Provisions; Anti-Defection; RTI; Lokayukta; Governance & e-Governance.',
    subject: 'Indian Polity',
    paperNumber: null,
    session: 'MORNING',
  },
  {
    no: 3,
    date: '2026-09-02',
    day: 'Wednesday',
    name: 'History – 1',
    syllabus:
      'Prehistoric India; Indus Valley; Vedic Age; Mahajanapadas; Buddhism & Jainism; Mauryas; Sangam Age; Satavahanas; Gupta & post-Gupta period; Cholas; Pallavas; Chalukyas; Rashtrakutas; Delhi Sultanate; Vijayanagara; Bahmani & Deccan Sultanates; Mughals; Bhakti & Sufi movements; Ancient/Medieval Karnataka; Art, Architecture, Literature & Culture.',
    subject: 'History',
    paperNumber: null,
    session: 'MORNING',
  },
  {
    no: 4,
    date: '2026-09-06',
    day: 'Sunday',
    name: 'History – 2',
    syllabus:
      'European arrival; British expansion; administration & economic policies; Revolt of 1857; reform movements; tribal & peasant movements; INC; Swadeshi; revolutionary movement; Gandhian movements; Non-Cooperation; Civil Disobedience; Quit India; post-constitutional developments; Independence & Partition; post-independence integration; Karnataka Freedom Movement; Karnataka Unification; important personalities, reform, art & culture.',
    subject: 'History',
    paperNumber: null,
    session: 'MORNING',
  },
  {
    no: 5,
    date: '2026-09-10',
    day: 'Thursday',
    name: 'Geography – 1',
    syllabus:
      'Earth structure; rocks & minerals; plate tectonics; earthquakes & volcanoes; geomorphology; atmosphere; temperature & pressure; winds; monsoon mechanism; cyclones; rainfall; climate types; oceans; tides & currents; marine resources; soils; natural vegetation; biomes; world physical geography; geographical phenomena.',
    subject: 'Geography',
    paperNumber: null,
    session: 'MORNING',
  },
  {
    no: 6,
    date: '2026-09-14',
    day: 'Monday',
    name: 'Geography – 2',
    syllabus:
      'India & Karnataka Geography: physiography; Himalayas; plains; plateau; coasts & islands; drainage; monsoon & climate; soils; vegetation; agriculture; irrigation; minerals; energy; industries; transport; population; migration; urbanisation; regional development; disasters; Karnataka rivers, forests, resources & regional geography.',
    subject: 'Geography',
    paperNumber: null,
    session: 'MORNING',
  },
  {
    no: 7,
    date: '2026-09-18',
    day: 'Friday',
    name: 'CSAT – 1',
    syllabus:
      'Reading comprehension; passages; inference; number system; simplification; fractions/decimals; percentages; ratio & proportion; averages; profit & loss; interest; basic algebra; geometry; mensuration; tables, charts, graphs & basic data interpretation.',
    subject: 'Mental Ability',
    paperNumber: null,
    session: 'MORNING',
  },
  {
    no: 8,
    date: '2026-09-22',
    day: 'Tuesday',
    name: 'Economy – 1',
    syllabus:
      'Economic concepts; national income; GDP/GNP/NNP; growth & development; inflation/deflation; unemployment; poverty; inequality; demographic dividend; banking; RBI; monetary policy; money supply; interest rates; financial inclusion; commercial banks; NBFCs; capital/money markets; Balance of Payments; exchange rate; external sector. Priority: Budget & Economic Survey + current economic developments.',
    subject: 'Indian Economy',
    paperNumber: null,
    session: 'MORNING',
  },
  {
    no: 9,
    date: '2026-09-26',
    day: 'Saturday',
    name: 'Economy – 2',
    syllabus:
      'Fiscal policy; taxation; Union Budget; government revenue/expenditure; fiscal deficit; public debt; subsidies; economic planning; NITI Aayog; reforms; agriculture; MSP; PDS; food security; rural economy; industries; MSMEs; infrastructure; energy; digital economy; inclusive/sustainable growth; schemes; Karnataka Budget, Karnataka Economic Survey & Karnataka Economy. Priority: Budget & Economic Survey.',
    subject: 'Indian Economy',
    paperNumber: null,
    session: 'MORNING',
  },
  {
    no: 10,
    date: '2026-09-30',
    day: 'Wednesday',
    name: 'Environment & Ecology – 1',
    syllabus:
      'Ecology; ecosystems; energy flow; food chains/webs; ecological pyramids; nutrient cycles; populations & communities; succession; habitats; biodiversity; hotspots; endemic/threatened species; IUCN; protected areas; National Parks; Wildlife Sanctuaries; Biosphere Reserves; conservation; forests; wetlands; marine ecosystems; Karnataka biodiversity.',
    subject: 'Environment',
    paperNumber: null,
    session: 'MORNING',
  },
  {
    no: 11,
    date: '2026-10-04',
    day: 'Sunday',
    name: 'Environment & Ecology – 2',
    syllabus:
      'Climate change; greenhouse gases; global warming; ozone depletion; El Nino/La Nina; air/water/soil/noise/plastic pollution; waste management; EIA; environmental laws; institutions; NGT; UNFCCC; Kyoto Protocol; Paris Agreement; CBD; CITES; Ramsar; Montreal Protocol; SDGs; sustainable development; renewable energy; carbon markets; Karnataka environmental issues.',
    subject: 'Environment',
    paperNumber: null,
    session: 'MORNING',
  },
  {
    no: 12,
    date: '2026-10-08',
    day: 'Thursday',
    name: 'Science & Technology – 1',
    syllabus:
      'Physics; mechanics; heat; light; sound; electricity; magnetism; Chemistry; atoms/molecules; periodic table; reactions; acids/bases/salts; metals/non-metals; carbon compounds; Biology; cell; tissues; human body; nutrition; diseases; immunity; genetics; evolution; microorganisms; agriculture & food science; everyday science.',
    subject: 'Science & Technology',
    paperNumber: null,
    session: 'MORNING',
  },
  {
    no: 13,
    date: '2026-10-12',
    day: 'Monday',
    name: 'Science & Technology – 2',
    syllabus:
      'Space & ISRO; satellites; launch vehicles; astronomy; nuclear technology; defence; missiles & drones; biotechnology; genetic engineering; vaccines; stem cells; genomics; nanotechnology; AI/ML; robotics; quantum technology; semiconductors; 5G/6G; IoT; blockchain; cybersecurity; digital technology; supercomputing; green technology; renewable energy; emerging technologies.',
    subject: 'Science & Technology',
    paperNumber: null,
    session: 'MORNING',
  },
  {
    no: 14,
    date: '2026-10-16',
    day: 'Friday',
    name: 'CSAT – 2',
    syllabus:
      'Advanced comprehension; logical & analytical reasoning; statements/conclusions; assumptions; syllogism; coding-decoding; blood relations; directions; ranking; sequences; puzzles; data sufficiency; decision making; problem solving; time & work; pipes & cisterns; speed & distance; boats & streams; permutations/combinations basics; probability basics; advanced arithmetic & data interpretation.',
    subject: 'Mental Ability',
    paperNumber: null,
    session: 'MORNING',
  },
  {
    no: 15,
    date: '2026-10-19',
    day: 'Monday',
    name: 'Current Affairs',
    syllabus:
      'Previous 1 Year Current Affairs: National; International; Karnataka; Polity & Governance; Economy; Environment; Science & Technology; Government Schemes; Reports & Indices; International Organisations; Summits & Conventions; Awards; Appointments; Sports; Defence; Space; important personalities, places & events. Special Priority: Union Budget, Economic Survey, Karnataka Budget & Karnataka Economic Survey.',
    subject: 'Current Affairs',
    paperNumber: null,
    session: 'MORNING',
  },
  {
    no: 16,
    date: '2026-10-25',
    day: 'Sunday',
    name: 'Final Prelims Simulation – 1: Paper I',
    syllabus:
      'Complete Paper I — full-length simulation. Balanced coverage of the complete Paper I syllabus with current-affairs integration.',
    subject: null,
    paperNumber: 1,
    session: 'MORNING',
  },
  {
    no: 17,
    date: '2026-10-25',
    day: 'Sunday',
    name: 'Final Prelims Simulation – 1: Paper II',
    syllabus:
      'Complete Paper II — full-length simulation. Balanced coverage of the complete Paper II syllabus with current-affairs integration.',
    subject: null,
    paperNumber: 2,
    session: 'AFTERNOON',
  },
  {
    no: 18,
    date: '2026-11-01',
    day: 'Sunday',
    name: 'Final Prelims Simulation – 2: Paper I',
    syllabus:
      'Complete Paper I — full-length simulation. Fresh mixed paper with exam-level difficulty and current-affairs integration.',
    subject: null,
    paperNumber: 1,
    session: 'MORNING',
  },
  {
    no: 19,
    date: '2026-11-01',
    day: 'Sunday',
    name: 'Final Prelims Simulation – 2: Paper II',
    syllabus:
      'Complete Paper II — full-length simulation. Fresh mixed paper with exam-level difficulty and current-affairs integration.',
    subject: null,
    paperNumber: 2,
    session: 'AFTERNOON',
  },
  {
    no: 20,
    date: '2026-11-08',
    day: 'Sunday',
    name: 'Final Prelims Simulation – 3: Paper I',
    syllabus: 'Complete Paper I — full-length simulation. Final exam-oriented Paper I simulation.',
    subject: null,
    paperNumber: 1,
    session: 'MORNING',
  },
  {
    no: 21,
    date: '2026-11-08',
    day: 'Sunday',
    name: 'Final Prelims Simulation – 3: Paper II',
    syllabus: 'Complete Paper II — full-length simulation. Final exam-oriented Paper II simulation.',
    subject: null,
    paperNumber: 2,
    session: 'AFTERNOON',
  },
];

/** The examination the series prepares for. */
export const KAS_2026_EXAM_DATE = '2026-11-15';
