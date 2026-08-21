/**
 * Exam shell.
 *
 * Deliberately bare: no sidebar, no site header, no navigation chrome. During
 * a timed test the only things on screen should be the paper, the clock and the
 * controls. Every authenticated check happens in the pages themselves.
 */
export default function ExamLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background">{children}</div>;
}
