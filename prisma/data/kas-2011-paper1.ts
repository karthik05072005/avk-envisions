/**
 * KAS Prelims 2011, Paper I — the complete 100-question paper.
 *
 * Transcribed from the official paper with its answer key. `correct` is a
 * ZERO-BASED index into `options`, so option 1 in the paper is `correct: 0`.
 *
 * `note` carries a caveat onto the question's internal review note. It is used
 * where the source key itself flags an answer as disputed, or where the item
 * depends on artwork (a map) that the transcription does not include. Those
 * questions are still loaded — they are part of the real paper — but a human
 * should look at them before the paper is used for anything ranked.
 *
 * No explanations are invented here. Where the paper supplies no reasoning,
 * the seed generates a one-line restatement of the key rather than fabricating
 * a justification that might be wrong.
 */

export interface PaperQuestion {
  n: number;
  subject: string;
  body: string;
  options: string[];
  /** Zero-based index of the keyed answer. */
  correct: number;
  note?: string;
}

export const KAS_2011_PAPER1: PaperQuestion[] = [
  // --- Q1–Q20 --------------------------------------------------------------
  { n: 1, subject: 'Current Affairs', body: 'Who won her first Grand Slam title by winning the Australian Open 2012?', options: ['Victoria Azarenka', 'Svetlana Kuznetsova', 'Maria Sharapova', 'Caroline Wozniacki'], correct: 0 },
  { n: 2, subject: 'Current Affairs', body: 'Fifth World Future Energy Summit was held in:', options: ['Abu Dhabi', 'New Delhi', 'Tehran', 'Dhaka'], correct: 0 },
  { n: 3, subject: 'Current Affairs', body: 'Where was the 14th World Sanskrit Conference held?', options: ['Kyoto, Japan', 'Beijing, China', 'Colombo, Sri Lanka', 'Kuala Lumpur, Malaysia'], correct: 0 },
  { n: 4, subject: 'Current Affairs', body: 'India’s IMR dropped from ___ to ___ per 1,000 live births during 2010?', options: ['50 → 47', '52 → 49', '53 → 48', '48 → 47'], correct: 0 },
  { n: 5, subject: 'Current Affairs', body: 'Which two countries had female infant mortality higher than male infant mortality?', options: ['Venezuela and Cambodia', 'Nigeria and Ghana', 'China and India', 'Indonesia and China'], correct: 2 },
  { n: 6, subject: 'Current Affairs', body: 'What is SHADE?', options: ['Pact among naval forces of India, Japan and China', 'Pact among armed forces of India, Japan and China', 'Pact among naval forces of India, Japan and Russia', 'Pact among armed forces of India, Japan and Russia'], correct: 0 },
  { n: 7, subject: 'Current Affairs', body: 'Mana Airport, Raipur was renamed:', options: ['Swami Vivekanand', 'Ramakrishna Paramahamsa', 'Mahatma Gandhi', 'Jawaharlal Nehru'], correct: 0 },
  { n: 8, subject: 'Science & Technology', body: 'T-cells are a:', options: ['White Blood Cell', 'Red Blood Cell', 'Liver Cell', 'Cancerous Cell'], correct: 0 },
  { n: 9, subject: 'Current Affairs', body: 'Which PSU lender called off its Visa–Elavon joint venture?', options: ['Union Bank', 'State Bank of India', 'Syndicate Bank', 'Corporation Bank'], correct: 1 },
  { n: 10, subject: 'Current Affairs', body: 'Indian Car of the Year 2012', options: ['Toyota Etios Liva', 'Maruti Suzuki Swift', 'Hyundai Verna', 'Hyundai Eon'], correct: 1 },
  { n: 11, subject: 'Environment', body: 'One of Karnataka’s sanctuaries that has been taken out of the Tiger Conservation Programme is:', options: ['Bandipur National Park', 'Anshi National Park', 'Nagarhole National Park', 'Bhadra Wildlife Sanctuary'], correct: 0, note: 'The source answer key flags this item. Verify against the official KPSC key before using in a ranked test.' },
  { n: 12, subject: 'Science & Technology', body: 'NASA announced it had found the most massive ever:', options: ['Star', 'Planet', 'Black hole', 'Alien'], correct: 2 },
  { n: 13, subject: 'Science & Technology', body: 'Smart-e-Pants are:', options: ['Underwear monitoring vital signs and uploading information to a mobile device', 'Diapers notifying parents', 'Pants connected to a video game', 'Electronic shorts for spinal-cord injuries'], correct: 0 },
  { n: 14, subject: 'Current Affairs', body: 'Country most optimistic in Nielsen Global Consumer Confidence survey:', options: ['India', 'Australia', 'Germany', 'Japan'], correct: 0 },
  { n: 15, subject: 'Environment', body: 'Which neighbouring country sought Karnataka’s help in tiger conservation?', options: ['Bhutan', 'Myanmar', 'Sri Lanka', 'Bangladesh'], correct: 0 },
  { n: 16, subject: 'Science & Technology', body: 'Metal found more effective than lead in cancer chemotherapy with fewer side effects:', options: ['Silver', 'Copper', 'Zinc', 'Selenium'], correct: 1 },
  { n: 17, subject: 'Current Affairs', body: 'St James’s Palace announced that it would:', options: ['Close for two-year renovation', 'Allow tourists into Queen’s private quarters', 'Install a helicopter pad', 'Rent rooms during London Olympics'], correct: 3 },
  { n: 18, subject: 'Environment', body: 'Which country agreed with the international effort to list Chrysotile Asbestos as hazardous?', options: ['India', 'Ukraine', 'Kyrgyzstan', 'Canada'], correct: 3, note: 'Keyed as Canada in the source answer key.' },
  { n: 19, subject: 'Current Affairs', body: 'Which US Republican presidential hopeful first dropped out after the Iowa caucuses?', options: ['Jon Huntsman', 'Michelle Bachmann', 'Herman Cain', 'Rick Santorum'], correct: 0 },
  { n: 20, subject: 'History', body: 'Northernmost known Harappan settlement in India:', options: ['Mandu', 'Harappa', 'Lothal', 'Ropar'], correct: 3 },

  // --- Q21–Q40 -------------------------------------------------------------
  { n: 21, subject: 'Current Affairs', body: 'Kannada writers who won Jnanpith and Saraswati Samman respectively in 2011', options: ['S.L. Bhyrappa → Chandrashekara Kambara', 'Chandrashekara Kambara → S.L. Bhyrappa', 'U.R. Ananthamurthy → S.L. Bhyrappa', 'Chandrashekara Kambara → Chidanandamurthy'], correct: 1 },
  { n: 22, subject: 'Current Affairs', body: 'Salman Rushdie controversy at which Literary Festival?', options: ['Bikaner', 'Udaipur', 'Jaipur', 'Ahmedabad'], correct: 2 },
  { n: 23, subject: 'Current Affairs', body: 'India and Bangladesh were negotiating water sharing of:', options: ['Ganga', 'Brahmaputra', 'Vaarana', 'Teesta'], correct: 3 },
  { n: 24, subject: 'Current Affairs', body: 'Intercensal period and next Census', options: ['5 years, 2016', '10 years, 2021', '10 years, 2020', '5 years, 2015'], correct: 1 },
  { n: 25, subject: 'Current Affairs', body: 'Chief Justices of India and Karnataka', options: ['Vikramjit Sen – S.H. Kapadia', 'S.H. Kapadia – V.B. Sabhahith', 'S.H. Kapadia – Vikramjit Sen', 'Sowmitra Sen – J.S. Khehar'], correct: 2 },
  { n: 26, subject: 'Current Affairs', body: 'Pro-democratic forces and Arab Spring', options: ['Libya – Arab Summer', 'Libya – Arab Spring', 'Egypt – Arab Summer', 'Egypt – Arab Spring'], correct: 3 },
  { n: 27, subject: 'Current Affairs', body: 'Middle-East country facing serious internal political/humanitarian problems in Jan–Feb 2012', options: ['Saudi Arabia', 'Yemen', 'Syria', 'Iraq'], correct: 2 },
  { n: 28, subject: 'Current Affairs', body: '2012 was declared Year of Mathematics for Ramanujan’s:', options: ['75th birthday', '100th birthday', '125th birthday', '150th birthday'], correct: 2 },
  { n: 29, subject: 'Current Affairs', body: 'Karnataka creamy-layer income limit raised from:', options: ['₹1 lakh → ₹2 lakh', '₹2 lakh → ₹3.5 lakh', '₹2 lakh → ₹4 lakh', '₹3 lakh → ₹3.5 lakh'], correct: 1 },
  { n: 30, subject: 'Current Affairs', body: 'Election Commission ordered masking of party-symbol statues in:', options: ['Himachal Pradesh', 'Jharkhand', 'Madhya Pradesh', 'Uttar Pradesh'], correct: 3 },
  { n: 31, subject: 'Current Affairs', body: 'Jana Gana Mana was composed by and had completed:', options: ['Bankim Chandra Chatterjee, 100th', 'Rabindranath Tagore, 100th', 'Bankim Chandra Chatterjee, 125th', 'Rabindranath Tagore, 125th'], correct: 1 },
  { n: 32, subject: 'Current Affairs', body: 'US Presidential elections are held every ___ years and were scheduled for:', options: ['5 years – November 2012', '5 years – November 2013', '4 years – November 2012', '4 years – November 2013'], correct: 2 },
  { n: 33, subject: 'Current Affairs', body: 'Police revolt in February 2012 forced which President out of office?', options: ['Maldives', 'Lakshadweep', 'Uganda', 'Philippines'], correct: 0 },
  { n: 34, subject: 'Current Affairs', body: 'Cricket World Cup 2011 — consider the following statements:\n\nI. Final was played in Kolkata.\nII. Yuvraj Singh was Man of the Series.', options: ['Both true', 'Only I true', 'Only II true', 'Both false'], correct: 2 },
  { n: 35, subject: 'Current Affairs', body: 'Consider the following statements:\n\nI. Strong dissent against Dow Chemicals’ London Olympics sponsorship.\nII. Fukushima reactor was severely damaged by earth tremor in March 2011.', options: ['Both true', 'Only I true', 'Only II true', 'Both false'], correct: 1, note: 'The source answer key flags this item — both statements are arguably true. Verify against the official KPSC key.' },
  { n: 36, subject: 'Current Affairs', body: 'British-Indian centenarian marathoner', options: ['Milkha Singh', 'Surya Veer Singh', 'Gagan Singh', 'Fauja Singh'], correct: 3 },
  { n: 37, subject: 'Current Affairs', body: '“Human safaris” exposed exploitation of which protected tribe?', options: ['Santhal', 'Maram', 'Jarawa', 'Lambani'], correct: 2 },
  { n: 38, subject: 'Current Affairs', body: 'India–France Medium Multirole Combat Aircraft', options: ['Rafale', 'MiG', 'Eurofighter', 'Jaguar'], correct: 0 },
  { n: 39, subject: 'Current Affairs', body: 'Veteran diplomat and writer who passed away', options: ['M.L. Sondhi', 'A.K. Damodaran', 'Appadurai', 'Brijesh Mishra'], correct: 1 },
  { n: 40, subject: 'Current Affairs', body: 'Supreme Court cancelled how many 2G licences?', options: ['102', '112', '122', '132'], correct: 2 },

  // --- Q41–Q60 -------------------------------------------------------------
  { n: 41, subject: 'History', body: '“Grand Old Man of India”', options: ['Lala Lajpat Rai', 'Bal Gangadhar Tilak', 'Surendranath Banerjee', 'Dadabhai Naoroji'], correct: 3 },
  { n: 42, subject: 'History', body: 'Gandhi’s South African settlement', options: ['Phoenix Settlement', 'Sarvodaya Enclave', 'Young India', 'Unto the Last'], correct: 0 },
  { n: 43, subject: 'History', body: 'Ashokan inscriptions — consider the following statements:\n\na. Most inscriptions were in Prakrit; northwest had Aramaic/Greek.\nb. Most Prakrit inscriptions used Brahmi.\nc. Some northwest inscriptions used Kharosthi.', options: ['a and b', 'Only a', 'b and c', 'a, b and c'], correct: 3 },
  { n: 44, subject: 'History', body: 'Akbar’s land classification — consider the following:\n\na. Polaj\nb. Parauti\nc. Chachar\nd. Banjar', options: ['Only d', 'a and b', 'a, c and d', 'All above'], correct: 3 },
  { n: 45, subject: 'History', body: '1857 — which pair is wrongly matched?', options: ['Kunwar Singh – Bihar', 'Nana Saheb – Nagpur', 'Birjis Qadr – Lucknow', 'Shah Mal – Barout'], correct: 1 },
  { n: 46, subject: 'History', body: 'Two proper industrial cities during colonial period', options: ['Calcutta and Bombay', 'Bombay and Madras', 'Jamshedpur and Kanpur', 'Jamshedpur and Bombay'], correct: 0 },
  { n: 47, subject: 'History', body: 'Who advised Gandhi to travel around British India for a year?', options: ['Bal Gangadhar Tilak', 'Mohammed Ali Jinnah', 'Gopal Krishna Gokhale', 'Lala Lajpat Rai'], correct: 2 },
  { n: 48, subject: 'History', body: 'Jinnah’s Fourteen Points — consider the following:\n\na. Delhi Proposals\nb. Calcutta Amendments\nc. Separate Electorate\nd. Reservation for Muslims in Government service', options: ['a and b only', 'c and d only', 'a and d only', 'All above'], correct: 3, note: 'Keyed as "All above" in the source answer key.' },
  { n: 49, subject: 'History', body: '“Devanampriya” and “Priyadarshi”', options: ['Harshavardhana', 'Mahavira', 'Gautama Buddha', 'Ashoka'], correct: 3 },
  { n: 50, subject: 'History', body: 'Rowlatt Act — consider the following:\n\na. Greater/stricter press control\nb. Trial of political offenders by judges without juries\nc. Internment without trial\nd. Martial law throughout India', options: ['a and d', 'a, b and c', 'b, c and d', 'All'], correct: 1 },
  { n: 51, subject: 'History', body: 'Belgaum Congress Session, 1924 — consider the following:\n\na. All India Khilafat Conference\nb. All India Hindu Mahasabha\nc. All India Non-Brahmin Conference\nd. All India Social Conference', options: ['a, b, d', 'b, c, d', 'a, c, d', 'All above'], correct: 3 },
  { n: 52, subject: 'History', body: 'Influences of Karnataka Vaibhava — consider the following:\n\na. Cultural solidarity among Kannadigas\nb. Inspired freedom fighters\nc. Awareness of Karnataka’s glorious past', options: ['a and c', 'a and b', 'b and c', 'All above'], correct: 3 },
  { n: 53, subject: 'History', body: 'Developments between 7th and 5th century BCE — consider the following:\n\na. Intellectual life was in ferment\nb. Old tribal structure was disintegrating\nc. Smaller regional kingdoms had disappeared', options: ['a and b', 'b and c', 'a and c', 'All above'], correct: 0 },
  { n: 54, subject: 'History', body: 'Activities in the “constitutional phase” of the National Movement — consider the following:\n\na. Promotion of Khadi\nb. Non-Cooperation Movement\nc. Salt Satyagraha\nd. Struggle against untouchability', options: ['a and d', 'a and c', 'b and d', 'c and d'], correct: 0 },
  { n: 55, subject: 'History', body: 'Facts known to Aryabhata — consider the following:\n\na. Earth moves round the Sun\nb. Reasons for eclipses\nc. Stars reflected Sun’s light\nd. Planets moved in elliptical paths around Sun', options: ['a, b, c', 'b, c, d', 'a, c, d', 'a, b, d'], correct: 0 },
  { n: 56, subject: 'Geography', body: 'Identify the correct pair of warm and cold ocean currents each respectively, which are indicated by an arrow with a code on the given world map.\n\n[The original paper printed a world map here. It is not reproduced in this transcription.]', options: ['a, b', 'd, c', 'ab, cd', 'ad, bc'], correct: 1, note: 'DEPENDS ON MISSING ARTWORK. The original question is unanswerable without the printed world map, which this transcription does not include. Attach the map image or withdraw this question before the paper is used.' },
  { n: 57, subject: 'Geography', body: 'Arrange in sequence for Igneous, Sedimentary and Metamorphic rocks:\n\na. Some rocks are relatively soft and yield powder when scratched.\nb. They contain crystals and no rounded particles.\nc. Rocks remain broadly in original position but are altered by internal/external forces.', options: ['a, b, c', 'c, b, a', 'b, a, c', 'a, c, b'], correct: 2 },
  { n: 58, subject: 'Geography', body: 'Match List I with List II and select the correct answer from the codes given:\n\nList I (Agent)\nA. River\nB. Glacier\nC. Wind\nD. Underground water\nE. Sea waves\n\nList II (Land form)\n1. Inselberg\n2. Natural bridges\n3. Chasms\n4. Comb ridge\n5. Alluvial terraces', options: ['A-5 B-3 C-2 D-4 E-1', 'A-5 B-4 C-1 D-2 E-3', 'A-5 B-3 C-2 D-1 E-4', 'A-2 B-1 C-3 D-4 E-5'], correct: 0, note: 'Keyed as code (1) in the source answer key.' },
  { n: 59, subject: 'Geography', body: 'Soil formed by weathering under humid tropical conditions, rich in iron and aluminium oxides', options: ['Red soils', 'Laterite soils', 'Tropical Black earths', 'Chernozem soils'], correct: 1 },
  { n: 60, subject: 'Geography', body: 'North-to-South vegetation sequence across Africa', options: ['Savanna → Desert → Rainforest → Mediterranean → Savanna → Desert', 'Rainforest → Savanna → Desert → Mediterranean → Savanna → Desert', 'Mediterranean → Rainforest → Desert → Savanna → Desert → Mediterranean', 'Desert → Savanna → Rainforest → Savanna → Desert → Mediterranean'], correct: 3 },

  // --- Q61–Q80 -------------------------------------------------------------
  { n: 61, subject: 'Geography', body: 'Match List I with List II and select the correct answer from the codes given:\n\nList I (Lakes)\nA. Lake Turkana (Rudolf)\nB. Lake Onega\nC. Lake Vanern\nD. Lake Reindeer\nE. Lake Michigan\n\nList II (Countries)\n1. Russia\n2. Kenya\n3. Canada\n4. USA\n5. Sweden', options: ['A-2 B-1 C-5 D-3 E-4', 'A-4 B-3 C-1 D-2 E-5', 'A-1 B-2 C-3 D-5 E-4', 'A-3 B-1 C-4 D-5 E-2'], correct: 0, note: 'The source key reads only "all five match as indicated", without naming a code. Code (1) is the option that correctly pairs Turkana–Kenya, Onega–Russia, Vanern–Sweden, Reindeer–Canada and Michigan–USA, so it is keyed here. Confirm against the official KPSC key.' },
  { n: 62, subject: 'Geography', body: 'Physiography of India and Karnataka — consider the following statements:\n\na. Indo-Gangetic Plain has an average elevation higher than South India.\nb. West-flowing Karnataka rivers can be linked from their lower reaches to east-flowing rivers.', options: ['a only', 'b only', 'Both', 'Both false'], correct: 3 },
  { n: 63, subject: 'Geography', body: 'Match List I with List II and select the correct answer from the codes given:\n\nList I (Port)\nA. Tuticorin\nB. Mumbai\nC. Goa\nD. Mangalore\nE. Cochin\n\nList II (Leading product exported)\n1. Spices\n2. Iron-ore\n3. Granite\n4. Refined petroleum products\n5. Fertilizers', options: ['A-2 B-1 C-5 D-3 E-4', 'A-5 B-4 C-2 D-3 E-1', 'A-5 B-4 C-2 D-1 E-3', 'A-3 B-1 C-5 D-2 E-4'], correct: 1, note: 'Keyed as code (2) in the source answer key.' },
  { n: 64, subject: 'Geography', body: 'Aurora Borealis occurs in:', options: ['Stratosphere', 'Troposphere', 'Ozonosphere', 'Ionosphere'], correct: 3 },
  { n: 65, subject: 'Geography', body: 'Ganga Delta is:', options: ['Arcuate Delta', 'Estuarine Delta', 'Cuspate Delta', 'Bird’s-foot Delta'], correct: 0 },
  { n: 66, subject: 'Geography', body: 'Which ethnic/geographical groups are correctly matched?\n\na. Eskimo – Canada\nb. Oran – Norway\nc. Lapps – India\nd. Gonds – Africa', options: ['a and b', 'a only', 'b and c', 'd only'], correct: 1 },
  { n: 67, subject: 'Geography', body: 'Rivers believed older than the Himalayas — consider the following:\n\na. Indus\nb. Ganga\nc. Brahmaputra\nd. Sutlej', options: ['a, b, c', 'b, c, d', 'a, b, d', 'a, c, d'], correct: 3 },
  { n: 68, subject: 'Geography', body: 'Why are more lunar eclipses visible from a given place?', options: ['More lunar eclipses occur in a year', 'Lunar eclipses are visible throughout a hemisphere while solar eclipses are not', 'Lunar eclipses are more publicised', 'Lunar eclipses are always complete'], correct: 1 },
  { n: 69, subject: 'Geography', body: 'Karnataka agro-climatic regions are based on — consider the following:\n\na. Rainfall pattern\nb. Soil types and relief\nc. Crops produced and marketing\nd. Labour and transport', options: ['a, b, c', 'b, c, d', 'a, c, d', 'a, b, d'], correct: 0 },
  { n: 70, subject: 'Geography', body: 'From Equator to Poles — consider the following:\n\na. Variety of plants/animals increases\nb. Variety decreases\nc. Temperature increases\nd. Temperature decreases', options: ['a, b', 'b, c', 'a, c', 'b, d'], correct: 3 },
  { n: 71, subject: 'Indian Polity', body: 'Joint Sitting of Parliament is presided over by:', options: ['President', 'Chairman of Rajya Sabha', 'Speaker of Lok Sabha', 'Specially elected chairman'], correct: 2 },
  { n: 72, subject: 'Indian Polity', body: 'Which is NOT a Departmentally Related Standing Committee?', options: ['Committee on Welfare of SCs/STs', 'Committee on Social Justice and Empowerment', 'Committee on Labour', 'Committee on Rural Development'], correct: 0 },
  { n: 73, subject: 'Indian Polity', body: 'Which is the correct Commission–Issue combination?', options: ['Anti-Sikh riots 1984 – Justice Srikrishna', 'Mumbai riots 1992–93 – Justice Nanavati', 'Review of Constitution – Justice Venkatachalaiah', 'Tamil Nadu–Kerala river dispute – Justice Mahajan'], correct: 2 },
  { n: 74, subject: 'Indian Polity', body: 'Women’s Reservation Bill status at the time', options: ['Passed Lok Sabha, awaiting Rajya Sabha', 'Passed Rajya Sabha, awaiting Lok Sabha', 'Introduced in Rajya Sabha', 'Sent to Social Justice Committee'], correct: 2, note: 'Keyed for the period the paper was set. The Bill’s status has changed since.' },
  { n: 75, subject: 'History', body: 'Freedom fighter who worked for revival of village/cottage industries', options: ['Rajkumari Amrit Kaur', 'Sushila Nayar', 'Vijayalakshmi Pandit', 'Kamaladevi Chattopadhyay'], correct: 3 },
  { n: 76, subject: 'Indian Polity', body: 'Directive Principles are in:', options: ['Part III', 'Part V', 'Part IV', 'Part VI'], correct: 2 },
  { n: 77, subject: 'Indian Polity', body: 'Which statement about the President of India is correct?', options: ['President is not part of Parliament', 'President is part of Parliament', 'President is not elected by Electoral College', 'President directly elected by people'], correct: 1 },
  { n: 78, subject: 'Indian Polity', body: 'Legislative Council can be created/abolished by:', options: ['Parliament alone', 'State Assembly alone', 'Parliament on recommendation/resolution of State Legislature', 'President on Governor’s recommendation'], correct: 2 },
  { n: 79, subject: 'Indian Polity', body: 'Which subject is NOT in the Union List?', options: ['Citizenship', 'Fisheries', 'Posts and Telegraphs', 'Extradition'], correct: 1 },
  { n: 80, subject: 'Indian Polity', body: 'Treaties and Parliament', options: ['Constitution provides for ratification of all treaties by Parliament', 'Constitution does not provide for general parliamentary ratification', 'Ratification under certain circumstances only', 'Treaties but not conventions'], correct: 1 },

  // --- Q81–Q100 ------------------------------------------------------------
  { n: 81, subject: 'Indian Polity', body: 'Why was NCTC opposed by many Chief Ministers? Consider the following:\n\na. Takes away State power over law and order\nb. Can investigate/take action without informing States\nc. Adversely affects federal structure\nd. States lose all anti-terror powers', options: ['a, d', 'c, d', 'a, c', 'b, c'], correct: 2, note: 'The source answer key flags this item; statement b is also commonly cited. Verify against the official KPSC key.' },
  { n: 82, subject: 'Indian Polity', body: '1980 Supreme Court case striking down amendments giving unlimited Parliament power under Article 368', options: ['Minerva Mills', 'Kesavananda Bharati', 'Golaknath', 'Bommai'], correct: 0 },
  { n: 83, subject: 'History', body: 'Justice Somashekar Committee investigated:', options: ['Attack on churches', 'Denotification of land', 'Illegal mining', 'BPL-card irregularities'], correct: 2 },
  { n: 84, subject: 'Indian Polity', body: 'Right to livelihood in DPSP is based on:', options: ['Socialist principles', 'Gandhian principles', 'Liberal principles', 'Anarchic principles'], correct: 0 },
  { n: 85, subject: 'Indian Polity', body: 'True spirit of bicameralism', options: ['One-third Rajya Sabha members retire every two years', 'President nominates experts', 'Lok Sabha represents people; Rajya Sabha represents States', 'Rajya Sabha cannot initiate Money Bills'], correct: 2 },
  { n: 86, subject: 'Indian Economy', body: 'Lowest national-income measure in 2010–11', options: ['GDP at market prices', 'GDP at factor cost/current prices', 'GDP at factor cost/constant prices', 'NDP at market prices'], correct: 3 },
  { n: 87, subject: 'Indian Economy', body: 'Fiscal deficit and primary deficit would be equal if:', options: ['Major subsidies were zero', 'Defence expenditure was zero', 'Recovery of loans was zero', 'Interest payments were zero'], correct: 3 },
  { n: 88, subject: 'Indian Economy', body: 'Direct Taxes Code Bill 2010 aimed to consolidate:', options: ['Income-tax laws only', 'Wealth-tax laws only', 'Direct-tax laws and replace Income Tax Act + Wealth Tax Act with one legislation', 'Direct-tax laws but with separate legislation'], correct: 2 },
  { n: 89, subject: 'Indian Economy', body: 'Food inflation in WPI was measured by:', options: ['Food Index — primary food articles', 'WPI of manufactured food products', 'WPI of primary goods', 'Food Index — primary food articles + manufactured food products'], correct: 3 },
  { n: 90, subject: 'Indian Economy', body: '32% priority-sector lending target applied to:', options: ['Public-sector banks', 'Private-sector banks', 'Foreign banks with offices in India', 'Domestic scheduled commercial banks'], correct: 2, note: 'Keyed under the RBI norms applicable when the paper was set.' },
  { n: 91, subject: 'Indian Economy', body: 'Credit-rating agencies for India’s sovereign rating include:', options: ['Standard & Poor’s', 'National Stock Exchange', 'S&P CNX Nifty', 'Bombay Stock Exchange'], correct: 0 },
  { n: 92, subject: 'Indian Economy', body: 'Insurance penetration means:', options: ['Premium / population', 'Premium / GDP', 'Life premium / health-risk population', 'Non-life premium / total assets'], correct: 1 },
  { n: 93, subject: 'Indian Economy', body: 'BRIC countries', options: ['Bangladesh, Russia, Ireland, Congo', 'Belgium, Romania, Iran, Canada', 'Brazil, Russia, Italy, China', 'Brazil, Russia, India, China'], correct: 3 },
  { n: 94, subject: 'Indian Economy', body: 'India’s current account does NOT include:', options: ['Exports and imports', 'Non-factor services and transfers', 'Income from factor services', 'Foreign Direct Investment'], correct: 3 },
  { n: 95, subject: 'Indian Economy', body: 'India’s service exports since 2000–01 largely contributed by:', options: ['Business services', 'Financial services', 'Software services', 'Communication services'], correct: 2 },
  { n: 96, subject: 'Indian Economy', body: 'Which statement was NOT correct regarding FDI in retailing on 10 January 2012?', options: ['FDI in cash-and-carry wholesale trading is permitted', 'FDI in single-brand retailing allowed up to 100%', 'FDI in multi-brand retailing is prohibited', 'FDI in both single-brand and multi-brand retailing is allowed'], correct: 3 },
  { n: 97, subject: 'Indian Economy', body: '“Swabhimaan” was a:', options: ['Social inclusion programme for poverty alleviation', 'Education inclusion programme', 'Social welfare programme for elderly', 'Financial inclusion programme using technology/branchless banking'], correct: 3 },
  { n: 98, subject: 'Indian Economy', body: 'Decadal population growth during 2001–2011', options: ['17.64%', '16.64%', '15.64%', '14.64%'], correct: 0 },
  { n: 99, subject: 'Indian Economy', body: 'Child Sex Ratio — 2001 vs 2011. Consider the following:\n\na. Declined from 927 to 914\nb. Decline significant in J&K and Rajasthan\nc. Sex ratio improved in Punjab\nd. Child sex ratio increased in Maharashtra', options: ['a only', 'a, b, c', 'a, c, d', 'a, b'], correct: 1 },
  { n: 100, subject: 'Indian Economy', body: 'Rashtriya Krishi Vikas Yojana (RKVY) — consider the following:\n\na. Introduced during 11th Five Year Plan\nb. Funds provided as 100% Central grant\nc. Comprehensive District Agricultural Development Plans\nd. Encourages more investment in agriculture', options: ['a and b', 'a, b, c', 'b, c, d', 'b and c'], correct: 2, note: 'The source notes this as the paper’s intended key; statement a is also correct on the plain facts. Verify against the official KPSC key.' },
];
