/**
 * KAS Prelims 2026 - the 12-test series timetable.
 *
 * Transcribed from the published AVK Envisions schedule. Tests 1-8 are
 * subject-wise papers on consecutive Sundays; tests 9-12 are two full
 * examination days, each running Paper I in the morning and Paper II in the
 * afternoon - which is why two entries share a date and are distinguished by
 * `paperNumber` and `session`.
 *
 * Every test is 100 questions, matching the real paper.
 */
export interface ScheduledTest {
  /** Position in the series, 1-12. */
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
  /** MORNING = 10:00-12:00, AFTERNOON = 14:00-16:00. */
  session: 'MORNING' | 'AFTERNOON';
}

export const KAS_2026_SCHEDULE: ScheduledTest[] = [
  {
    no: 1,
    date: '2026-09-06',
    day: 'Sunday',
    name: 'Polity',
    syllabus:
      'Complete Indian Polity: Historical background & making of the Constitution; Preamble; salient features; Union & Territory; Citizenship; Fundamental Rights; DPSP; Fundamental Duties; Constitutional Amendments; Basic Structure Doctrine; important Articles & Schedules; federal & unitary features; Centre-State relations; President; Vice-President; Prime Minister & Council of Ministers; Parliament & Parliamentary Committees; Supreme Court; High Courts; Governor; Chief Minister & State Council of Ministers; State Legislature; Panchayati Raj & Municipalities; Election Commission; UPSC/KPSC; CAG; Finance Commission; Attorney General & Advocate General; Constitutional & Statutory Bodies; Tribunals; Emergency provisions; Special Provisions; Anti-Defection; RTI; Lokayukta; Governance & e-Governance.',
    subject: 'Indian Polity',
    paperNumber: null,
    session: 'MORNING',
  },
  {
    no: 2,
    date: '2026-09-13',
    day: 'Sunday',
    name: 'History',
    syllabus:
      'Complete Indian & Karnataka History: Prehistoric India; Indus Valley Civilization; Vedic Age; Mahajanapadas; Buddhism & Jainism; Mauryas; Sangam Age; Satavahanas; Gupta & post-Gupta period; Cholas; Pallavas; Chalukyas; Rashtrakutas; Delhi Sultanate; Vijayanagara; Bahmani & Deccan Sultanates; Mughals; Bhakti & Sufi movements; Ancient & Medieval Karnataka; Art, Architecture, Literature & Culture; European arrival; British expansion; administration & economic policies; Revolt of 1857; social & religious reform movements; tribal & peasant movements; INC; Swadeshi; revolutionary movement; Gandhian movements; Non-Cooperation; Civil Disobedience; Quit India; Independence & Partition; post-independence developments; Karnataka Freedom Movement; Karnataka Unification; important personalities, reform, art & culture.',
    subject: 'History',
    paperNumber: null,
    session: 'MORNING',
  },
  {
    no: 3,
    date: '2026-09-20',
    day: 'Sunday',
    name: 'Geography',
    syllabus:
      'Complete World, India & Karnataka Geography: Earth structure; rocks & minerals; plate tectonics; earthquakes & volcanoes; geomorphology; atmosphere; temperature & pressure; winds; monsoon mechanism; cyclones; rainfall; climate types; oceans; tides & currents; marine resources; soils; natural vegetation; biomes; world physical geography; geographical phenomena; India & Karnataka physiography; Himalayas; plains; plateau; coasts & islands; drainage; monsoon & climate; soils; vegetation; agriculture; irrigation; minerals; energy; industries; transport; population; migration; urbanisation; regional development; disasters; Karnataka rivers, forests, resources & regional geography.',
    subject: 'Geography',
    paperNumber: null,
    session: 'MORNING',
  },
  {
    no: 4,
    date: '2026-09-27',
    day: 'Sunday',
    name: 'Economy + Budget & Economic Survey',
    syllabus:
      'Complete Indian & Karnataka Economy: Basic economic concepts; national income; GDP/GNP/NNP; economic growth & development; inflation & deflation; unemployment; poverty; inequality; demographic dividend; banking; RBI; monetary policy; money supply; interest rates; financial inclusion; commercial banks; NBFCs; capital & money markets; Balance of Payments; exchange rate; external sector; fiscal policy; taxation; Union Budget; government revenue & expenditure; fiscal deficit; public debt; subsidies; economic planning; NITI Aayog; economic reforms; agriculture; MSP; PDS; food security; rural economy; industries; MSMEs; infrastructure; energy; digital economy; inclusive & sustainable growth; major government schemes; Union Budget; Economic Survey; Karnataka Budget; Karnataka Economic Survey; Karnataka Economy; current economic developments.',
    subject: 'Indian Economy',
    paperNumber: null,
    session: 'MORNING',
  },
  {
    no: 5,
    date: '2026-10-04',
    day: 'Sunday',
    name: 'Environment & Ecology',
    syllabus:
      'Complete Environment & Ecology: Ecology; ecosystems; energy flow; food chains & food webs; ecological pyramids; nutrient cycles; populations & communities; ecological succession; habitats; biodiversity; biodiversity hotspots; endemic & threatened species; IUCN; protected areas; National Parks; Wildlife Sanctuaries; Biosphere Reserves; conservation; forests; wetlands; marine ecosystems; Karnataka biodiversity; climate change; greenhouse gases; global warming; ozone depletion; El Nino & La Nina; air, water, soil, noise & plastic pollution; waste management; EIA; environmental laws; institutions; NGT; UNFCCC; Kyoto Protocol; Paris Agreement; CBD; CITES; Ramsar; Montreal Protocol; SDGs; sustainable development; renewable energy; carbon markets; Karnataka environmental issues.',
    subject: 'Environment',
    paperNumber: null,
    session: 'MORNING',
  },
  {
    no: 6,
    date: '2026-10-11',
    day: 'Sunday',
    name: 'Science & Technology',
    syllabus:
      'Complete Science & Technology: Physics - mechanics, heat, light, sound, electricity, magnetism; Chemistry - atoms & molecules, periodic table, chemical reactions, acids/bases/salts, metals/non-metals, carbon compounds; Biology - cell, tissues, human body, nutrition, diseases, immunity, genetics, evolution, microorganisms, agriculture & food science, everyday science; Space & ISRO; satellites; launch vehicles; astronomy; nuclear technology; defence technology; missiles & drones; biotechnology; genetic engineering; vaccines; stem cells; genomics; nanotechnology; AI/ML; robotics; quantum technology; semiconductors; 5G/6G; IoT; blockchain; cybersecurity; digital technology; supercomputing; green technology; renewable energy; emerging technologies.',
    subject: 'Science & Technology',
    paperNumber: null,
    session: 'MORNING',
  },
  {
    no: 7,
    date: '2026-10-18',
    day: 'Sunday',
    name: 'Current Affairs',
    syllabus:
      'Previous 1 Year Current Affairs: National; International; Karnataka; Polity & Governance; Economy; Environment; Science & Technology; Government Schemes; Reports & Indices; International Organisations; Summits & Conventions; Awards; Appointments; Sports; Defence; Space; important personalities, places & events. Special focus: Union Budget; Economic Survey; Karnataka Budget; Karnataka Economic Survey; important recent developments relevant to KAS.',
    subject: 'Current Affairs',
    paperNumber: null,
    session: 'MORNING',
  },
  {
    no: 8,
    date: '2026-10-25',
    day: 'Sunday',
    name: 'CSAT',
    syllabus:
      'Complete CSAT: Reading comprehension; passages; inference; number system; simplification; fractions & decimals; percentages; ratio & proportion; averages; profit & loss; interest; basic algebra; geometry; mensuration; tables, charts & graphs; data interpretation; logical & analytical reasoning; statements & conclusions; assumptions; syllogism; coding-decoding; blood relations; directions; ranking; sequences; puzzles; data sufficiency; decision making; problem solving; time & work; pipes & cisterns; speed & distance; boats & streams; permutations & combinations basics; probability basics; advanced arithmetic & data interpretation.',
    subject: 'Mental Ability',
    paperNumber: null,
    session: 'MORNING',
  },
  {
    no: 9,
    date: '2026-11-01',
    day: 'Sunday',
    name: 'Full Prelims Simulation - 1: Paper I',
    syllabus:
      'Complete Paper I - Full-Length Simulation. Balanced coverage of the complete General Studies syllabus with Current Affairs integration.',
    subject: null,
    paperNumber: 1,
    session: 'MORNING',
  },
  {
    no: 10,
    date: '2026-11-01',
    day: 'Sunday',
    name: 'Full Prelims Simulation - 1: Paper II',
    syllabus:
      'Complete Paper II - Full-Length Simulation. Comprehensive coverage based on the complete Paper II syllabus, with exam-level difficulty and balanced question distribution.',
    subject: null,
    paperNumber: 2,
    session: 'AFTERNOON',
  },
  {
    no: 11,
    date: '2026-11-08',
    day: 'Sunday',
    name: 'Full Prelims Simulation - 2: Paper I',
    syllabus:
      'Complete Paper I - Full-Length Simulation. Fresh mixed paper with complete syllabus coverage, Current Affairs integration and exam-level difficulty.',
    subject: null,
    paperNumber: 1,
    session: 'MORNING',
  },
  {
    no: 12,
    date: '2026-11-08',
    day: 'Sunday',
    name: 'Full Prelims Simulation - 2: Paper II',
    syllabus:
      'Complete Paper II - Full-Length Simulation. Fresh mixed paper with complete Paper II coverage and examination-level difficulty.',
    subject: null,
    paperNumber: 2,
    session: 'AFTERNOON',
  },
];
