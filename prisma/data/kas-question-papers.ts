/**
 * The OCR'd KPSC question papers, as held in the shared Drive archive.
 *
 * Committed as a manifest rather than as files: the scans total well over
 * 100 MB, and the importer fetches them on demand exactly as the synopsis
 * installer does. That is what lets the import run on the server instead of
 * only on the machine that happened to download them.
 *
 * `folder` is the Drive folder the file sits in, which is what maps to a series
 * on the site — the folder names and the years printed on the papers do not
 * agree, and the site labels follow the folders.
 */
export interface QuestionPaperSource {
  /** Drive folder, e.g. "2020" or "2024 AUGUST". */
  folder: string;
  /** Google Drive file id. */
  driveFileId: string;
  /** Original file name, which carries the paper number. */
  name: string;
}

export const KAS_QUESTION_PAPERS: QuestionPaperSource[] = [
  { folder: '2012', driveFileId: '1BaUrbyLpLSuu9Fnwps6JTw48-Ob0kiGS', name: 'KAS-2011-Prelims-Paper-1_ocred.pdf' },
  { folder: '2015', driveFileId: '13zqzj9-27jl2IHf1kmkpQpiUh5b5-83O', name: 'KAS-2014-Prelims-Paper-1_ocred.pdf' },
  { folder: '2015', driveFileId: '1xnkBK-b6MrD3OwXWHBgE92Mzm9p6ihUu', name: 'KAS-2014-Prelims-Paper-2_ocred.pdf' },
  { folder: '2017', driveFileId: '1ZSrjngpppeLB3Kx1mLpadT24Llr-hBwc', name: 'KAS-2017-Prelims-Paper-1_ocred.pdf' },
  { folder: '2017', driveFileId: '1KxnOVqjo5UGDibydaBR7ySLCj2sCv2g8', name: 'KAS-2017-Prelims-Paper-2_ocred.pdf' },
  { folder: '2020', driveFileId: '1YhxnZDyDWCXjriOS-z-B7rU2wwcsDbBj', name: 'KAS-2020-Prelims-Paper-1-A-Series_ocred.pdf' },
  { folder: '2020', driveFileId: '1ODY_HViB2Pg6CX2jRdgdgqyYwHQcaswA', name: 'KAS-2020-Prelims-Paper-2-A-Series_ocred.pdf' },
  { folder: '2024 AUGUST', driveFileId: '1id6DTR-xzeUXU4VqGgYQnvEFHMKLiL__', name: 'KAS-2024-Prelims-Aug-Paper-1_ocred.pdf' },
  { folder: '2024 AUGUST', driveFileId: '1TiuGLkGPX6iFg2ndQRIp_iYplLYgxcxD', name: 'KAS-2024-Prelims-Aug-Paper-2_ocred.pdf' },
  { folder: '2024 DECEMBER', driveFileId: '1yo_YYr4PQZSCdb6aZA7wcuo43afqT0DD', name: 'KAS-2024-Prelims-Dec-Paper-1_ocred.pdf' },
  { folder: '2024 DECEMBER', driveFileId: '11OJ63HyqxjtEkbbVtmHQKcA2hv9Yh-F0', name: 'KAS-2024-Prelims-Dec-Paper-2_ocred.pdf' },
];
