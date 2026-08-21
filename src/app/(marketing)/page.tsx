import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Brain,
  CheckCircle2,
  ClipboardList,
  Gauge,
  LineChart,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Users,
} from 'lucide-react';

import { CourseTracks } from '@/components/site/course-tracks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EXAM_CATEGORY_LABELS, type ExamCategory } from '@/lib/enums';
import { formatCompactNumber, formatPaise } from '@/lib/utils';
import { getCourseTracks } from '@/server/services/catalogue-service';
import {
  getFaqs,
  getFeaturedExams,
  getFeaturedTestSeries,
  getPlatformStats,
  getPublishedPlans,
  getSuccessStories,
  getTestimonials,
} from '@/server/services/marketing-service';

export const metadata: Metadata = {
  title: 'Prepare Smarter. Perform Better. Achieve More.',
  description:
    'Full-length mock tests, sectional practice and a question bank that adapts to you — with analytics that show exactly which topics to fix next.',
  alternates: { canonical: '/' },
};

/**
 * Homepage.
 *
 * Every section reads from the database so the content team can change it
 * without a deploy. Sections whose data has not been populated yet are omitted
 * entirely rather than rendering an empty shell.
 */
export default async function HomePage() {
  const [tracks, exams, series, stats, plans, testimonials, stories, faqs] = await Promise.all([
    getCourseTracks(),
    getFeaturedExams(8),
    getFeaturedTestSeries(3),
    getPlatformStats(),
    getPublishedPlans(),
    getTestimonials(3),
    getSuccessStories(3),
    getFaqs(undefined, 6),
  ]);

  return (
    <>
      <Hero />
      <TrackChooser tracks={tracks} />
      {stats.questions > 0 && <StatsStrip stats={stats} />}
      {exams.length > 0 && <ExamCategories exams={exams} />}
      {series.length > 0 && <PopularSeries series={series} />}
      <WhyAvk />
      <AnalyticsShowcase />
      <AiShowcase />
      {stories.length > 0 && <SuccessStories stories={stories} />}
      <HowItWorks />
      {plans.length > 0 && <Pricing plans={plans} />}
      {testimonials.length > 0 && <Testimonials testimonials={testimonials} />}
      {faqs.length > 0 && <Faqs faqs={faqs} />}
      <FinalCta />
    </>
  );
}

// ---------------------------------------------------------------------------

function Hero() {
  return (
    <section className="relative overflow-hidden bg-mesh-hero">
      {/* Decorative grid; hidden from assistive tech. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(60%_50%_at_50%_0%,black,transparent)]"
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:56px_56px] opacity-40" />
      </div>

      <div className="container relative py-20 sm:py-28 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="brand" className="mb-6 px-3 py-1">
            <Sparkles aria-hidden="true" />
            Built for serious exam preparation
          </Badge>

          <h1 className="text-balance text-display-md sm:text-display-lg lg:text-display-xl">
            Prepare smarter.
            <br />
            <span className="bg-brand-gradient bg-clip-text text-transparent">
              Perform better.
            </span>{' '}
            Achieve more.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            AVK Visions combines full-length mocks, sectional tests and a deep question bank with
            analytics that tell you precisely which topics are costing you marks — and what to do
            about them.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="xl" variant="brand" className="w-full sm:w-auto">
              <Link href="/test-series">
                Explore test series
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline" className="w-full sm:w-auto">
              <Link href="/register">Start practising free</Link>
            </Button>
          </div>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {['No credit card to start', 'Free mock tests included', 'Cancel anytime'].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function StatsStrip({
  stats,
}: {
  stats: { students: number; questions: number; tests: number; attempts: number };
}) {
  const items = [
    { label: 'Practice questions', value: formatCompactNumber(stats.questions), icon: BookOpenCheck },
    { label: 'Tests published', value: formatCompactNumber(stats.tests), icon: ClipboardList },
    { label: 'Students preparing', value: formatCompactNumber(stats.students), icon: Users },
    { label: 'Tests attempted', value: formatCompactNumber(stats.attempts), icon: Target },
  ];

  return (
    <section className="border-y border-border bg-muted/30" aria-label="Platform statistics">
      <div className="container grid grid-cols-2 gap-6 py-10 lg:grid-cols-4">
        {items.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-3.5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">{value}</p>
              <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'center' | 'left';
}) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
      )}
      <h2 className="mt-2.5 text-balance text-display-sm sm:text-display-md">{title}</h2>
      {description && (
        <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ExamCategories({ exams }: { exams: Awaited<ReturnType<typeof getFeaturedExams>> }) {
  return (
    <section className="container py-20 sm:py-24">
      <SectionHeading
        eyebrow="Exams we cover"
        title="Choose your exam, we handle the rest"
        description="Each exam has its own syllabus tree, question bank and test series — built to match the real paper, not a generic template."
      />

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {exams.map((exam) => (
          <Link key={exam.id} href={`/exams/${exam.slug}`} className="group rounded-xl">
            <Card interactive className="h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="flex size-11 items-center justify-center rounded-xl text-sm font-bold"
                    style={
                      exam.colorHex
                        ? { backgroundColor: `${exam.colorHex}1A`, color: exam.colorHex }
                        : undefined
                    }
                  >
                    {exam.shortName.slice(0, 4)}
                  </span>
                  <Badge variant="muted" size="sm">
                    {EXAM_CATEGORY_LABELS[exam.category as ExamCategory] ?? exam.category}
                  </Badge>
                </div>

                <h3 className="mt-4 font-semibold leading-tight tracking-tight transition-colors group-hover:text-primary">
                  {exam.name}
                </h3>
                {exam.description && (
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {exam.description}
                  </p>
                )}

                <p className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{exam.testCount} tests</span>
                  <span aria-hidden="true">·</span>
                  <span>{exam.seriesCount} series</span>
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-9 text-center">
        <Button asChild variant="outline">
          <Link href="/exams">
            View all exams
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function PopularSeries({ series }: { series: Awaited<ReturnType<typeof getFeaturedTestSeries>> }) {
  return (
    <section className="border-y border-border bg-muted/20 py-20 sm:py-24">
      <div className="container">
        <SectionHeading
          eyebrow="Test series"
          title="Structured series, not a pile of tests"
          description="Every series follows a deliberate progression — foundation, sectional, then full-length mocks under real exam conditions."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {series.map((item) => (
            <Card key={item.id} interactive className="flex h-full flex-col overflow-hidden">
              <CardContent className="flex flex-1 flex-col p-6">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="brand" size="sm">
                    {item.exam.shortName}
                  </Badge>
                  {item.discountPercent > 0 && (
                    <Badge variant="success" size="sm">
                      {item.discountPercent}% off
                    </Badge>
                  )}
                </div>

                <h3 className="mt-4 text-lg font-semibold leading-tight tracking-tight">
                  {item.name}
                </h3>
                {item.tagline && (
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {item.tagline}
                  </p>
                )}

                <ul className="mt-5 space-y-2.5">
                  {item.features.slice(0, 4).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <CheckCircle2
                        className="mt-0.5 size-4 shrink-0 text-success"
                        aria-hidden="true"
                      />
                      <span className="leading-relaxed text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold tracking-tight">
                      {item.priceInPaise === 0 ? 'Free' : formatPaise(item.priceInPaise)}
                    </span>
                    {item.comparePriceInPaise > item.priceInPaise && (
                      <span className="text-sm text-muted-foreground line-through">
                        {formatPaise(item.comparePriceInPaise)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.testCount} tests included
                  </p>

                  <Button asChild fullWidth className="mt-4">
                    <Link href={`/test-series/${item.slug}`}>View series</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-9 text-center">
          <Button asChild variant="outline">
            <Link href="/test-series">
              Browse all test series
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const WHY_POINTS = [
  {
    icon: Target,
    title: 'Weak topics, identified honestly',
    body: 'A topic is only flagged once you have attempted enough questions for the signal to mean something — never after a single mistake.',
  },
  {
    icon: Timer,
    title: 'A test engine that does not lose work',
    body: 'Answers autosave continuously and the timer is server-authoritative, so a refresh, a dropped connection or a closed tab costs you nothing.',
  },
  {
    icon: LineChart,
    title: 'Analytics you can act on',
    body: 'Score, accuracy, speed and percentile tracked over time — with a clear next step, not twelve charts and no conclusion.',
  },
  {
    icon: BookOpenCheck,
    title: 'A question bank that is actually reviewed',
    body: 'Every question passes human review before publication, and reported questions are triaged and fixed.',
  },
  {
    icon: Gauge,
    title: 'Practice tuned to your level',
    body: 'Adaptive practice pulls from your weak topics and previous mistakes instead of serving the same easy questions again.',
  },
  {
    icon: ShieldCheck,
    title: 'Fair, exam-like conditions',
    body: 'Randomised questions and options, a real countdown and integrity checks that keep the leaderboard meaningful.',
  },
] as const;

function WhyAvk() {
  return (
    <section className="container py-20 sm:py-24">
      <SectionHeading
        eyebrow="Why AVK Visions"
        title="Built by people who take preparation seriously"
        description="No inflated claims, no vanity metrics. Just the things that genuinely move a score."
      />

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {WHY_POINTS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-xl border border-border bg-card p-6 shadow-card">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary-muted text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <h3 className="mt-4 font-semibold leading-tight tracking-tight">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function AnalyticsShowcase() {
  const bars = [
    { label: 'Physics', value: 78, tone: 'bg-chart-1' },
    { label: 'Chemistry', value: 64, tone: 'bg-chart-2' },
    { label: 'Mathematics', value: 41, tone: 'bg-chart-3' },
  ];

  return (
    <section className="border-y border-border bg-muted/20 py-20 sm:py-24">
      <div className="container grid items-center gap-12 lg:grid-cols-2">
        <div>
          <SectionHeading
            align="left"
            eyebrow="Performance intelligence"
            title="Know exactly what is costing you marks"
            description="After every test, AVK Visions breaks your performance down by subject, chapter, topic and difficulty — then ranks what to revise first by how much it will actually move your score."
          />

          <ul className="mt-8 space-y-4">
            {[
              'Accuracy, speed and consistency scored separately',
              'Topic mastery tracked across every attempt',
              'Improving and declining topics surfaced automatically',
              'Time spent per question compared against the cohort',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
                <span className="text-sm leading-relaxed text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>

          <Button asChild className="mt-8">
            <Link href="/register">
              See it on your own data
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>

        {/* Illustrative preview of the analytics panel. Static by design — it
            demonstrates the layout without implying these are real results. */}
        <Card variant="elevated" className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Subject accuracy</p>
                <p className="text-xs text-muted-foreground">Last 5 attempts</p>
              </div>
              <Badge variant="success" size="sm">
                <TrendingUp aria-hidden="true" />
                +8%
              </Badge>
            </div>

            <div className="mt-6 space-y-5">
              {bars.map((bar) => (
                <div key={bar.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{bar.label}</span>
                    <span className="tabular-nums text-muted-foreground">{bar.value}%</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${bar.tone}`}
                      style={{ width: `${bar.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recommended next
              </p>
              <p className="mt-1.5 text-sm leading-relaxed">
                Spend your next session on <strong>Definite Integration</strong> — it appears in 3 of
                your last 5 tests and your accuracy there is 34%.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function AiShowcase() {
  const prompts = [
    'Why do I keep losing marks in Rotational Motion?',
    'Build me a practice set from my weakest topics.',
    'What should I study today with 90 minutes?',
    'Analyse my last five mock tests.',
  ];

  return (
    <section className="container py-20 sm:py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Card variant="elevated" className="order-2 overflow-hidden lg:order-1">
          <CardContent className="space-y-3 p-6">
            <div className="flex items-center gap-2.5 border-b border-border pb-4">
              <span className="flex size-9 items-center justify-center rounded-lg bg-brand-gradient text-primary-foreground">
                <Brain className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold">AVK AI Coach</p>
                <p className="text-xs text-muted-foreground">Grounded in your own attempt history</p>
              </div>
            </div>

            {prompts.map((prompt) => (
              <div
                key={prompt}
                className="rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-sm leading-relaxed"
              >
                {prompt}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="order-1 lg:order-2">
          <SectionHeading
            align="left"
            eyebrow="AI preparation"
            title="A coach that has actually read your results"
            description="The AI Coach works from your attempts, your accuracy and your topic mastery — not generic advice. Ask it why you are stuck, and it answers with reference to the questions you got wrong."
          />

          <ul className="mt-8 space-y-4">
            {[
              'Explains your specific mistakes, question by question',
              'Generates practice sets targeted at your weak areas',
              'Plans a realistic study day around the time you have',
              'Only ever sees your own data — never another student’s',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
                <span className="text-sm leading-relaxed text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function SuccessStories({ stories }: { stories: Awaited<ReturnType<typeof getSuccessStories>> }) {
  return (
    <section className="border-y border-border bg-muted/20 py-20 sm:py-24">
      <div className="container">
        <SectionHeading
          eyebrow="Success stories"
          title="Students who put in the work"
          description="Real results from students who prepared with AVK Visions."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {stories.map((story) => (
            <Card key={story.id} className="h-full">
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  {story.rank && (
                    <Badge variant="brand" size="sm">
                      {story.rank}
                    </Badge>
                  )}
                  {story.examName && (
                    <Badge variant="muted" size="sm">
                      {story.examName} {story.year ?? ''}
                    </Badge>
                  )}
                </div>

                <blockquote className="mt-4 text-pretty text-sm leading-relaxed text-muted-foreground">
                  “{story.quote}”
                </blockquote>

                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-sm font-semibold">{story.studentName}</p>
                  {story.achievement && (
                    <p className="text-xs text-muted-foreground">{story.achievement}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-9 text-center">
          <Button asChild variant="outline">
            <Link href="/success-stories">
              Read all stories
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const STEPS = [
  {
    title: 'Pick your exam',
    body: 'Choose the exam you are preparing for and set a target year. Your entire dashboard reshapes around it.',
  },
  {
    title: 'Take a diagnostic test',
    body: 'One full-length attempt is enough for the platform to establish a baseline across every subject.',
  },
  {
    title: 'Follow the analysis',
    body: 'Your weak topics are ranked by impact. Practise them directly from the report, in one click.',
  },
  {
    title: 'Repeat and measure',
    body: 'Each new attempt updates your trends, so improvement is something you can see rather than assume.',
  },
] as const;

function HowItWorks() {
  return (
    <section className="container py-20 sm:py-24">
      <SectionHeading
        eyebrow="How it works"
        title="Four steps, then repeat"
        description="The loop is deliberately simple, because consistency beats complexity."
      />

      <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="relative rounded-xl border border-border bg-card p-6 shadow-card">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              {index + 1}
            </span>
            <h3 className="mt-4 font-semibold leading-tight tracking-tight">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Pricing({ plans }: { plans: Awaited<ReturnType<typeof getPublishedPlans>> }) {
  return (
    <section className="border-y border-border bg-muted/20 py-20 sm:py-24" id="pricing">
      <div className="container">
        <SectionHeading
          eyebrow="Pricing"
          title="Straightforward plans"
          description="Start free. Upgrade when the platform has proven itself to you, not before."
        />

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              variant={plan.isFeatured ? 'elevated' : 'default'}
              className={plan.isFeatured ? 'relative border-primary/40' : 'relative'}
            >
              {plan.isFeatured && (
                <Badge variant="default" className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Most popular
                </Badge>
              )}

              <CardContent className="flex h-full flex-col p-6">
                <h3 className="text-lg font-semibold tracking-tight">{plan.name}</h3>
                {plan.tagline && (
                  <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
                )}

                <div className="mt-5 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tracking-tight">
                    {plan.priceInPaise === 0 ? 'Free' : formatPaise(plan.priceInPaise)}
                  </span>
                  {plan.priceInPaise > 0 && (
                    <span className="text-sm text-muted-foreground">
                      / {plan.durationDays >= 365 ? 'year' : `${plan.durationDays} days`}
                    </span>
                  )}
                </div>

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                      <span className="leading-relaxed text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  fullWidth
                  variant={plan.isFeatured ? 'brand' : 'outline'}
                  className="mt-7"
                >
                  <Link href={plan.priceInPaise === 0 ? '/register' : `/pricing?plan=${plan.slug}`}>
                    {plan.priceInPaise === 0 ? 'Start free' : 'Choose plan'}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Testimonials({ testimonials }: { testimonials: Awaited<ReturnType<typeof getTestimonials>> }) {
  return (
    <section className="container py-20 sm:py-24">
      <SectionHeading eyebrow="What students say" title="Feedback from the people using it daily" />

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {testimonials.map((testimonial) => (
          <Card key={testimonial.id} className="h-full">
            <CardContent className="flex h-full flex-col p-6">
              <blockquote className="flex-1 text-pretty text-sm leading-relaxed text-muted-foreground">
                “{testimonial.quote}”
              </blockquote>
              <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary-muted text-xs font-semibold text-primary">
                  {testimonial.studentName.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-semibold">{testimonial.studentName}</p>
                  <p className="text-xs text-muted-foreground">
                    {[testimonial.examName, testimonial.city].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Faqs({ faqs }: { faqs: Awaited<ReturnType<typeof getFaqs>> }) {
  return (
    <section className="border-t border-border bg-muted/20 py-20 sm:py-24">
      <div className="container">
        <SectionHeading eyebrow="FAQ" title="Questions students ask before starting" />

        {/* Native <details> keeps this fully accessible and zero-JS. */}
        <div className="mx-auto mt-12 max-w-3xl divide-y divide-border rounded-xl border border-border bg-card">
          {faqs.map((faq) => (
            <details key={faq.id} className="group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium [&::-webkit-details-marker]:hidden">
                {faq.question}
                <span
                  aria-hidden="true"
                  className="grid size-6 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Button asChild variant="ghost">
            <Link href="/faq">
              See all questions
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function FinalCta() {
  return (
    <section className="container py-20 sm:py-24">
      <div className="relative overflow-hidden rounded-2xl bg-brand-gradient px-6 py-16 text-center sm:px-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(255,255,255,0.18),transparent)]"
        />

        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-balance text-display-sm text-primary-foreground sm:text-display-md">
            One more test. One step closer.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty leading-relaxed text-primary-foreground/85">
            Create a free account, attempt a mock test, and see your first performance report in
            under an hour.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="xl" variant="secondary" className="w-full sm:w-auto">
              <Link href="/register">
                Create your free account
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="xl"
              variant="ghost"
              className="w-full text-primary-foreground hover:bg-white/10 hover:text-primary-foreground sm:w-auto"
            >
              <Link href="/test-series">Browse test series</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The four course tracks, sitting directly under the hero.
 *
 * Placed above every other section because choosing a track is the first real
 * decision a visitor makes; everything below it is supporting evidence.
 */
function TrackChooser({ tracks }: { tracks: Awaited<ReturnType<typeof getCourseTracks>> }) {
  return (
    <section className="container py-16 sm:py-20" aria-labelledby="courses-heading">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          KPSC KAS Courses
        </p>
        <h2 id="courses-heading" className="mt-2 text-balance text-display-sm">
          Choose the right path for your preparation
        </h2>
        <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
          Start free to find your level, then move to full-length tests, previous year papers and
          chapterwise drills as your preparation sharpens.
        </p>
      </div>

      <CourseTracks tracks={tracks} className="mt-8" />
    </section>
  );
}
