import { cn } from '@/lib/utils';

/**
 * Shared hero band for public interior pages, so /exams, /pricing and /blog
 * open with identical rhythm instead of each inventing its own spacing.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('border-b border-border bg-muted/20', className)}>
      <div className="container py-14 sm:py-16">
        <div className="max-w-3xl">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
          )}
          <h1 className="mt-2.5 text-balance text-display-sm sm:text-display-md">{title}</h1>
          {description && (
            <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
