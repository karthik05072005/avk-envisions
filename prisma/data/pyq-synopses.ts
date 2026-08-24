/**
 * Analysis ("synopsis") documents for the previous-year papers.
 *
 * Each entry pairs a test with the Google Drive file holding its question-wise
 * analysis. The PDFs total roughly 270 MB, so they are fetched at install time
 * rather than committed; `npm run db:synopses` downloads them into the synopsis
 * directory, which sits outside the web root.
 *
 * A note on the years. The folder named "2012" holds the 2011 papers, which the
 * filenames inside confirm. For "2015" and "2017" the folder name and the cover
 * heading disagree - the covers read 2014 and 2015 - and AVK confirmed the
 * folders are right, so the slugs follow those. The cover headings in those two
 * sets of PDFs are wrong and should be corrected at source.
 *
 * Current Affairs appears in both Paper I and Paper II every year, while the
 * catalogue carries one Current Affairs test per year. The Paper I document is
 * used for that test; the Paper II current-affairs content is covered by the
 * Paper II whole-paper analysis.
 */
export interface SynopsisSource {
  /** Slug of the test this document analyses. */
  testSlug: string;
  /** Google Drive file id, from the shared PYQ archive. */
  driveFileId: string;
  /** Original location in the archive, kept so a mapping can be traced back. */
  source: string;
}

export const PYQ_SYNOPSES: SynopsisSource[] = [
  {
    testSlug: 'kas-pyq-2011-paper-1',
    driveFileId: '1aBaUwGgr78hflJY3mwhlZHdRQtnPrO6w',
    source: '2012/Paper1+subjectwise/⭐️2011- paper1-ALL Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2011-paper-2',
    driveFileId: '12PWaoNTwMc3G0ZV47CAL6aNmmPuziect',
    source: '2012/Paper2+subjectwise/⭐️KAS_2011_PAPER-2 -ALL-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2011-subject-current-affairs',
    driveFileId: '1bQmKfIHYjLC1MTweAxn-e82wyUvkjfPt',
    source: '2012/Paper1+subjectwise/2011-CA-paper-1.pdf',
  },
  {
    testSlug: 'kas-pyq-2011-subject-environment',
    driveFileId: '1WKy3WaPc2C7UKqaNui7dc7-02Jstqaak',
    source: '2012/Paper2+subjectwise/2011-Environment.pdf',
  },
  {
    testSlug: 'kas-pyq-2011-subject-geography',
    driveFileId: '1Sov44FznQCSo0iGBnWN6k3Jw5ltlFVpd',
    source: '2012/Paper1+subjectwise/2011-geography and.pdf',
  },
  {
    testSlug: 'kas-pyq-2011-subject-history',
    driveFileId: '1JeFTvZJUOj0gdxfnLE8G41iHk-O2pOSK',
    source: '2012/Paper1+subjectwise/2011-History-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2011-subject-indian-economy',
    driveFileId: '1HDYHT9ZAqDnWbBHtnG00KiNNA5BkDJUh',
    source: '2012/Paper1+subjectwise/2011-economic-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2011-subject-indian-polity',
    driveFileId: '19vKEPwDkC-MrZLVrbqNiEH4HWVTBARHh',
    source: '2012/Paper1+subjectwise/2011-polity.pdf',
  },
  {
    testSlug: 'kas-pyq-2011-subject-mental-ability',
    driveFileId: '1eXZ8CRSRrhbJlgFH-4BUM9yMo524PC6a',
    source: '2012/Paper2+subjectwise/2011-CSAT-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2011-subject-science-technology',
    driveFileId: '1RyEyT3_5Cvdc6L3O7TLoVL7sp9hrcHSn',
    source: '2012/Paper2+subjectwise/2011-S&amp;T-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2015-paper-1',
    driveFileId: '1XwUBhcA-UfJpuEO0vbN6OaFp8Fu4VDXo',
    source: '2015/Paper1+subjectwise/⭐️2014-paper1-All-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2015-paper-2',
    driveFileId: '1TGtXZ7heHN8zhYzto1OLiMYcuqlosucb',
    source: '2015/Paper2+subjectwise/⭐️KAS2014_paper_II_ALL_SYNOPSIS.pdf',
  },
  {
    testSlug: 'kas-pyq-2015-subject-current-affairs',
    driveFileId: '1Z-K7yUDSzkNs3VRrDdelxT3rZYEGl0Jz',
    source: '2015/Paper1+subjectwise/2014-CA-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2015-subject-environment',
    driveFileId: '1BguadC_fDNSWSsLxwy8nUZyQ323EIw3A',
    source: '2015/Paper2+subjectwise/2014 Environmental and Ecology.pdf',
  },
  {
    testSlug: 'kas-pyq-2015-subject-geography',
    driveFileId: '1MKiOrxpIr8NY8t2elhrbJyUlvLOP2XlA',
    source: '2015/Paper1+subjectwise/2014-geography-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2015-subject-history',
    driveFileId: '1yCTwPaVqp0949BZh4s5SiqRJWCmmEkEz',
    source: '2015/Paper1+subjectwise/2014-History-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2015-subject-indian-economy',
    driveFileId: '1LFSbKt7vTRz5aMRnmr9U5JxQnbteq2dE',
    source: '2015/Paper1+subjectwise/2014-Economy-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2015-subject-indian-polity',
    driveFileId: '1tJquu_L7zzlfEc_WGgcxszPA_G-HbH1a',
    source: '2015/Paper1+subjectwise/2014-polity-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2015-subject-mental-ability',
    driveFileId: '11V7F46x1fK-_jqNPMANUkPdReiUVrMi-',
    source: '2015/Paper2+subjectwise/2014-CSAT-ANS.pdf',
  },
  {
    testSlug: 'kas-pyq-2015-subject-science-technology',
    driveFileId: '1rB7tplLT_4mvQGAy--gxwVwuzLRAzhkV',
    source: '2015/Paper2+subjectwise/2014 Science and Technology.pdf',
  },
  {
    testSlug: 'kas-pyq-2017-paper-1',
    driveFileId: '1pTeHJ-wxQ6xMGpvehvy8YKkLXyxGfpz3',
    source: '2017/Paper1+subjectwise/⭐️2015-paper1-All-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2017-paper-2',
    driveFileId: '1jfgOL706lIG57Z74lvzbgksXrbovys3l',
    source: '2017/Paper2+subjectwise/⭐️2017-Paper2-All-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2017-subject-current-affairs',
    driveFileId: '1991XOxCjdl2T5yS0LEf8_YLIlV7XMsxX',
    source: '2017/Paper1+subjectwise/2015 -CA-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2017-subject-environment',
    driveFileId: '1nscxSXYtcIX1OiTFmW6m2JoMAc0nx0yD',
    source: '2017/Paper2+subjectwise/2017-Environment-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2017-subject-geography',
    driveFileId: '1aDKwKfRJ4rG7vGXLaLpbjUHy8FnnL8vi',
    source: '2017/Paper1+subjectwise/2015-geography-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2017-subject-history',
    driveFileId: '17cyczmr4dVOAZhmJ5mevfeBpfrKzxkXq',
    source: '2017/Paper1+subjectwise/2015-History-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2017-subject-indian-economy',
    driveFileId: '19uJttt60Oh76OoL1vzUUEBgumBNxfpSK',
    source: '2017/Paper1+subjectwise/2015-economy.pdf',
  },
  {
    testSlug: 'kas-pyq-2017-subject-indian-polity',
    driveFileId: '1VBfccN0bFunivAw_IhxrmuSuKUKceBKN',
    source: '2017/Paper1+subjectwise/2015-Polity-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2017-subject-mental-ability',
    driveFileId: '1vPy7oGQ9_WbhEPZ1E1OiCjWbOM1I39zS',
    source: '2017/Paper2+subjectwise/2017 CSAT-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2017-subject-science-technology',
    driveFileId: '1IrvYXfomVSPVtzWSgP_7HOePv2vwR8wI',
    source: '2017/Paper2+subjectwise/2017-S&amp;T-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2020-paper-1',
    driveFileId: '1D4eI2BMTAOaPqdC_lqhnL0L3ZpP8Gth0',
    source: '2020/Paper1+subjectwise/⭐️2020_PAPER1-ALL-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2020-paper-2',
    driveFileId: '1YPfE0EEiCzEs9Q7BUN2TmkKY8gVrIJg9',
    source: '2020/Paper2+subjectwise/⭐️2020-paper2-All-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2020-subject-current-affairs',
    driveFileId: '1oBXWjfHeCQiP-FeNWSQATtQZ54kVhtx7',
    source: '2020/Paper1+subjectwise/2020-CA-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2020-subject-environment',
    driveFileId: '1YGDfRWy74rZrEaDZwrPkJZEwybINk7FF',
    source: '2020/Paper2+subjectwise/KAS 2020 Environment.pdf',
  },
  {
    testSlug: 'kas-pyq-2020-subject-geography',
    driveFileId: '1awtCyhFuT_Ax_0Yj-yhAb0l4fEv7yBT8',
    source: '2020/Paper1+subjectwise/2020-Geography-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2020-subject-history',
    driveFileId: '1P8GQ_tbqh8qrQH57i5TUmJEnEIVDaL0s',
    source: '2020/Paper1+subjectwise/2020-History-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2020-subject-indian-economy',
    driveFileId: '19emQwWvBkourRHnK5Zy4dEVzOfAMtR8V',
    source: '2020/Paper1+subjectwise/2020-Economy-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2020-subject-indian-polity',
    driveFileId: '1yggS0Q0gv74_bBGDxSJzjqj3ioOYz99z',
    source: '2020/Paper1+subjectwise/2020-polity-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2020-subject-mental-ability',
    driveFileId: '1AgHH5hPW0Sfvjnq6FOjcPmqDyWe9an9n',
    source: '2020/Paper2+subjectwise/KAS 2020 CSAT.pdf',
  },
  {
    testSlug: 'kas-pyq-2020-subject-science-technology',
    driveFileId: '14gQ3b9R_uR4qHCcfnbuPZb2abZt2PhbB',
    source: '2020/Paper2+subjectwise/KAS 2020 Science and Tech.pdf',
  },
  {
    testSlug: 'kas-pyq-2024-august-paper-1',
    driveFileId: '1KpaTvfpTul7GG-RLIRbsiIMcC7fminsQ',
    source: '2024 AUGUST/Paper1+subjectwise/⭐️2024-Aug-1-All-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2024-august-paper-2',
    driveFileId: '1AmvUz95lzud6l8YB2M8c6HGHagmgyrCR',
    source: '2024 AUGUST/Paper2+subjectwise/⭐️KAS_2024_Aug_All_PAPER_II_SYNOPSIS.pdf',
  },
  {
    testSlug: 'kas-pyq-2024-august-subject-current-affairs',
    driveFileId: '1YtOGMY-pJhww5u4Oq4kiV4GyeShsh7H2',
    source: '2024 AUGUST/Paper1+subjectwise/2024-aug-CA.pdf',
  },
  {
    testSlug: 'kas-pyq-2024-august-subject-environment',
    driveFileId: '1JuEbIJFokuxMuA7uWM1aNYSgL232NHeo',
    source: '2024 AUGUST/Paper2+subjectwise/2024-Aug-Environment .pdf',
  },
  {
    testSlug: 'kas-pyq-2024-august-subject-geography',
    driveFileId: '1xKU2n3YCH7Q2-fnH3NbOPs84N0Gcylkh',
    source: '2024 AUGUST/Paper1+subjectwise/2024-aug-geography .pdf',
  },
  {
    testSlug: 'kas-pyq-2024-august-subject-history',
    driveFileId: '1fbUO3PD4NT8kYzkzQRoR-sw9NSoyvKS0',
    source: '2024 AUGUST/Paper1+subjectwise/2024-aug-history .pdf',
  },
  {
    testSlug: 'kas-pyq-2024-august-subject-indian-economy',
    driveFileId: '1jfF7GRk7-86kD31vQqRY6uCUiLvOv-GT',
    source: '2024 AUGUST/Paper1+subjectwise/2024-Aug-Ans-Economy .pdf',
  },
  {
    testSlug: 'kas-pyq-2024-august-subject-indian-polity',
    driveFileId: '1f5umb_hiaYbdpdp4p4idy8dGVsKrkH7-',
    source: '2024 AUGUST/Paper1+subjectwise/2024-aug-polity.pdf',
  },
  {
    testSlug: 'kas-pyq-2024-august-subject-mental-ability',
    driveFileId: '1AD8LF58Q09Ah7qp1aXdVggMYBNq522sg',
    source: '2024 AUGUST/Paper2+subjectwise/2024_Aug_CSAT_Synopsis.pdf',
  },
  {
    testSlug: 'kas-pyq-2024-august-subject-science-technology',
    driveFileId: '1s7ToLZ7ar4EvC2iP73HtVSeEneI7F7n0',
    source: '2024 AUGUST/Paper2+subjectwise/2024-aug-S&amp;T-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2024-december-paper-1',
    driveFileId: '1ILAqi5HEDAqpBkfIxt7WZ6lKAHGWw8l7',
    source: '2024 DECEMBER/Paper1+subjectwise/⭐️KAS_2024_Paper-1_ALL-Ans.pdf',
  },
  {
    testSlug: 'kas-pyq-2024-december-paper-2',
    driveFileId: '1yDQh48RhshORVlP_HevqunFEylwofSuD',
    source: '2024 DECEMBER/Paper2+subjectwise/⭐️KAS-DEC-paper2-ALL-ANALYSIS .pdf',
  },
  {
    testSlug: 'kas-pyq-2024-december-subject-current-affairs',
    driveFileId: '1H_l-cZu7RPTVxn47zo0CIOwTDdD-Eq0E',
    source: '2024 DECEMBER/Paper1+subjectwise/2024-Dec-CA.pdf',
  },
  {
    testSlug: 'kas-pyq-2024-december-subject-environment',
    driveFileId: '11ucab0F-laSRr4T8un5D2Mh3r-ETuxqs',
    source: '2024 DECEMBER/Paper2+subjectwise/KAS_December_Environment.pdf',
  },
  {
    testSlug: 'kas-pyq-2024-december-subject-geography',
    driveFileId: '1JMapH4uaNcq5mOIxSxF8Yfbw6alIFfcX',
    source: '2024 DECEMBER/Paper1+subjectwise/2024-de-geography .pdf',
  },
  {
    testSlug: 'kas-pyq-2024-december-subject-history',
    driveFileId: '18S491rTqaSLNn_poKQ_uEaYijH-D-GVR',
    source: '2024 DECEMBER/Paper1+subjectwise/2024–Dec-history .pdf',
  },
  {
    testSlug: 'kas-pyq-2024-december-subject-indian-economy',
    driveFileId: '1GddNPoNbpqIVATxXRWJp8P8K7e-eUHJc',
    source: '2024 DECEMBER/Paper1+subjectwise/2024-Dec—economy .pdf',
  },
  {
    testSlug: 'kas-pyq-2024-december-subject-indian-polity',
    driveFileId: '18QTVetHyuiX1sfndrrUxOjgxekhKma7t',
    source: '2024 DECEMBER/Paper1+subjectwise/2024-polity-Dec.pdf',
  },
  {
    testSlug: 'kas-pyq-2024-december-subject-mental-ability',
    driveFileId: '10EIE16Rq5cTdFbtfBQpVs1RKO40B6u8K',
    source: '2024 DECEMBER/Paper2+subjectwise/KAS_December_CSAT.pdf',
  },
  {
    testSlug: 'kas-pyq-2024-december-subject-science-technology',
    driveFileId: '19o5u0HUsETa1Ji5K8grSNuO4soQWSJQR',
    source: '2024 DECEMBER/Paper2+subjectwise/KAS_December_Science_and_Tech.pdf',
  },
];
