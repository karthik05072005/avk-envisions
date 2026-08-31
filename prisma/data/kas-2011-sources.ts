/**
 * The refreshed 2011 papers, supplied separately from the main archive.
 *
 * Two complete papers plus a subject-wise split of each. The complete papers
 * fill the two full-length tests; the subject files are what say which subject
 * a question belongs to, because the complete papers carry no subject headings
 * of their own.
 *
 * Committed as a manifest and fetched at import time — the Paper II scan alone
 * is 80 MB.
 */
export interface Kas2011Source {
  driveFileId: string;
  name: string;
  /** 1 or 2. */
  paperNumber: number;
  /** Catalogue subject, or null for a complete paper. */
  subject: string | null;
}

export const KAS_2011_SOURCES: Kas2011Source[] = [
  {
    driveFileId: '1FgqITlzofENZ_1Qf8qbNiBUy-I-9Gign',
    name: 'KAS_2011_Current_Affairs.pdf',
    paperNumber: 1,
    subject: 'Current Affairs',
  },
  {
    driveFileId: '1T_YdqAt0tKqnQea4e_z85BPl3fyDhgVu',
    name: 'KAS_2011_Economy.pdf',
    paperNumber: 1,
    subject: 'Indian Economy',
  },
  {
    driveFileId: '1-vA8laHSZtWXEaXyGq2-wifwnUd04U0R',
    name: 'KAS_2011_Geography.pdf',
    paperNumber: 1,
    subject: 'Geography',
  },
  {
    driveFileId: '1NhbpePnqVAu4Ym4s3ELzlWrGjYdUZ14z',
    name: 'KAS_2011_History.pdf',
    paperNumber: 1,
    subject: 'History',
  },
  {
    driveFileId: '1_5ZTss4a4tyZdNDtCSEEZPqsq9LdTwfR',
    name: 'KAS_2011_Polity.pdf',
    paperNumber: 1,
    subject: 'Indian Polity',
  },
  {
    driveFileId: '1jl7yI8QYqFb9x9RTchraR2Bacc4LNp3s',
    name: 'KAS_2011_PaperI_complete.pdf',
    paperNumber: 1,
    subject: null,
  },
  {
    driveFileId: '16659QSUxZKiTKh6kNVXHCD0thNxy7PTO',
    name: 'KAS_2011_CSAT.pdf',
    paperNumber: 2,
    subject: 'Mental Ability',
  },
  {
    driveFileId: '1jGB5Ne4Wr-vS9_QpeD9o2lvWQZex9JuQ',
    name: 'KAS_2011_ENVIRONMENT_ECOLOGY.pdf',
    paperNumber: 2,
    subject: 'Environment',
  },
  {
    driveFileId: '1Lblr3WEbLqypvRxHa3DvL09Y3RvIeWf9',
    name: 'KAS_2011_SCIENCE_TECHNOLOGY.pdf',
    paperNumber: 2,
    subject: 'Science & Technology',
  },
  {
    driveFileId: '1aASZpx0ZAH7wAX5qByWFRBnhSYGV5xzd',
    name: 'KAS_2011_PAPER_II-complete.pdf',
    paperNumber: 2,
    subject: null,
  },
];
