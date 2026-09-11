/**
 * Landing.jsx
 * ---------------------------------------------------------------------
 * The public homepage at "/". This is a deliberately different concept
 * from the previous version of this page: instead of an editorial
 * "ledger" layout (asymmetric hero, alternating feature rows), this one
 * is a centered hero over a bento-style product mosaic -- small tiles
 * showing different parts of the app at a glance -- followed by a card
 * grid of features and an FAQ accordion. Typography is its own pairing
 * too (Bricolage Grotesque + Inter), distinct from both the product's
 * fonts and the previous landing page's fonts, so the marketing site
 * keeps a fresh identity of its own rather than converging on one look.
 *
 * Login and Register are the ONLY way in -- there is no path from this
 * page to the Dashboard without going through one of them (enforced by
 * ProtectedRoute regardless of what this page does), and the CTAs never
 * offer a "skip straight to the Dashboard" shortcut.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
} from 'recharts';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CalendarCheck2,
  Receipt,
  Users,
  Target,
  CheckSquare2,
} from 'lucide-react';

function useLandingFonts() {
  useEffect(() => {
    const id = 'landing-fonts-v2';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&family=Inter:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }, []);
}

const display = { fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" };

const REVENUE = [
  { m: 'A', v: 12 }, { m: 'B', v: 18 }, { m: 'C', v: 15 }, { m: 'D', v: 24 },
  { m: 'E', v: 21 }, { m: 'F', v: 30 }, { m: 'G', v: 27 }, { m: 'H', v: 36 },
];
const PIPELINE_MINI = [
  { s: 'New', v: 6 }, { s: 'Contacted', v: 9 }, { s: 'Qualified', v: 5 }, { s: 'Won', v: 7 },
];

const FEATURES = [
  { icon: Target, name: 'Leads', copy: 'A pipeline board from first reply to signed proposal, with follow-ups that never slip.' },
  { icon: Users, name: 'Clients & Projects', copy: 'Every client, their currency, and every project and payment tied to them.' },
  { icon: CalendarCheck2, name: 'Meetings', copy: 'A real calendar plus a searchable history of everything already held.' },
  { icon: CheckSquare2, name: 'Tasks', copy: 'A working board that flags what is overdue before a client has to ask.' },
  { icon: Receipt, name: 'Invoices', copy: 'A GST-ready template -- fill it in, save it, download a finished PDF.' },
  { icon: ArrowUpRight, name: 'Payments', copy: 'A manual ledger -- totals paid and owed recalculate the moment you log one.' },
];

const FAQS = [
  {
    q: 'Do I need a credit card to start?',
    a: 'No. Register with an email and password, or continue with Google, and you\u2019re in your own workspace immediately.',
  },
  {
    q: 'Is Brew Minds connected to a payment processor?',
    a: 'No -- payments are a manual ledger. Whenever money actually arrives, you log it, and every total in the app recalculates from that.',
  },
  {
    q: 'Can I use this on my phone?',
    a: 'Yes. The whole workspace, including the Kanban boards and calendar, is built to work on a phone or tablet, not just a desktop screen.',
  },
  {
    q: 'What happens to my data if I delete a client?',
    a: 'Deleting a client also removes their projects, since a project can\u2019t meaningfully exist without the client it belongs to. Payments, meetings and documents tied to that project are kept as history with the reference cleared, not deleted.',
  },
];

function BentoCard({ className = '', children }) {
  return (
    <div
      className={`rounded-2xl border border-[#EDEAE3] bg-white p-5 shadow-[0_1px_2px_rgba(20,18,14,0.04)] transition-shadow hover:shadow-[0_8px_24px_-8px_rgba(20,18,14,0.12)] ${className}`}
    >
      {children}
    </div>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#EDEAE3] py-5">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-4 text-left">
        <span className="text-[15px] font-medium text-[#171412]">{q}</span>
        <ChevronDown size={18} className={`shrink-0 text-[#171412]/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#171412]/60">{a}</p>}
    </div>
  );
}

export default function Landing() {
  useLandingFonts();

  return (
    <div className="bg-[#FAF9F6] text-[#171412]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ---- Nav ------------------------------------------------------------- */}
      <header className="sticky top-0 z-20 border-b border-[#EDEAE3] bg-[#FAF9F6]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-6">
          <span className="text-lg font-semibold" style={display}>
            Brew Minds
          </span>
          <nav className="flex items-center gap-3 sm:gap-5">
            <Link to="/login" className="rounded-full px-4 py-2 text-sm font-medium text-[#171412]/70 transition-colors hover:bg-[#171412]/5 hover:text-[#171412]">
              Log in
            </Link>
            <Link
              to="/register"
              className="rounded-full bg-[#D2540A] px-5 py-2 text-sm font-semibold text-white shadow-[0_6px_16px_-6px_rgba(210,84,10,0.5)] transition-all hover:-translate-y-0.5 hover:bg-[#B3480C]"
            >
              Register
            </Link>
          </nav>
        </div>
      </header>

      {/* ---- Hero: centered ---------------------------------------------------- */}
      <section className="mx-auto max-w-3xl px-5 pb-4 pt-16 text-center sm:px-6 sm:pt-24">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#EDEAE3] bg-white px-3.5 py-1.5 text-xs font-medium text-[#171412]/60">
          <span className="h-1.5 w-1.5 rounded-full bg-[#3D7A5D]" /> Built for freelancers &amp; small studios
        </span>
        <h1 className="mx-auto mt-6 max-w-2xl text-[2.5rem] font-semibold leading-[1.1] tracking-tight sm:text-6xl" style={display}>
          Your whole freelance business, on one screen.
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-[#171412]/60 sm:text-lg">
          Leads, clients, projects, payments, meetings, tasks, documents and invoices --
          Brew Minds keeps all of it in sync so you stop rebuilding the same picture across
          six different tools.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-full bg-[#171412] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_-8px_rgba(23,20,18,0.4)] transition-all hover:-translate-y-0.5 hover:bg-black"
          >
            Create your account <ArrowRight size={16} />
          </Link>
          <Link to="/login" className="rounded-full px-7 py-3.5 text-sm font-semibold text-[#171412]/70 transition-colors hover:bg-[#171412]/5 hover:text-[#171412]">
            I already have an account
          </Link>
        </div>
        <p className="mt-5 text-xs text-[#171412]/40">Free to start &middot; Registration or Google sign-in required</p>
      </section>

      {/* ---- Bento product mosaic ------------------------------------------------ */}
      <section className="mx-auto max-w-6xl px-5 py-14 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
          <BentoCard className="lg:col-span-2 lg:row-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-[#171412]/40">Payments received</p>
            <p className="mt-1 text-3xl font-semibold" style={display}>$48,200</p>
            <p className="text-xs text-[#3D7A5D]">+18% vs. last period</p>
            <div className="mt-4 h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={REVENUE} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D2540A" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#D2540A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke="#D2540A" strokeWidth={2.5} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </BentoCard>

          <BentoCard className="lg:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-[#171412]/40">Leads by stage</p>
            <div className="mt-3 h-20">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={PIPELINE_MINI} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="s" tick={{ fontSize: 9, fill: '#171412', opacity: 0.4 }} axisLine={false} tickLine={false} />
                  <Bar dataKey="v" fill="#171412" fillOpacity={0.85} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </BentoCard>

          <BentoCard>
            <p className="text-xs font-medium uppercase tracking-wide text-[#171412]/40">Today</p>
            <div className="mt-3 space-y-2.5">
              {['9:00  Kickoff call', '2:30  Design review'].map((line) => (
                <div key={line} className="flex items-center gap-2 text-sm">
                  <CalendarCheck2 size={14} className="shrink-0 text-[#D2540A]" />
                  <span className="text-[#171412]/70">{line}</span>
                </div>
              ))}
            </div>
          </BentoCard>

          <BentoCard>
            <p className="text-xs font-medium uppercase tracking-wide text-[#171412]/40">Invoice #INV-0042</p>
            <p className="mt-2 text-2xl font-semibold" style={display}>$2,400</p>
            <span className="mt-2 inline-block rounded-full bg-[#3D7A5D]/10 px-2.5 py-1 text-[11px] font-medium text-[#3D7A5D]">
              Saved
            </span>
          </BentoCard>
        </div>
      </section>

      {/* ---- Feature card grid ---------------------------------------------------- */}
      <section className="border-t border-[#EDEAE3] bg-white py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <div className="max-w-xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl" style={display}>
              Everything the business side of freelancing needs.
            </h2>
            <p className="mt-3 text-[#171412]/60">Nine sections, one login, zero spreadsheets.</p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, name, copy }) => (
              <div key={name} className="rounded-2xl border border-[#EDEAE3] p-6 transition-colors hover:border-[#D2540A]/30 hover:bg-[#FAF9F6]">
                <div className="mb-4 inline-flex rounded-xl bg-[#D2540A]/10 p-2.5">
                  <Icon size={18} className="text-[#D2540A]" />
                </div>
                <p className="font-semibold" style={display}>{name}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-[#171412]/60">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- FAQ accordion ---------------------------------------------------- */}
      <section className="mx-auto max-w-3xl px-5 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-semibold tracking-tight" style={display}>
          Questions, answered.
        </h2>
        <div className="mt-10">
          {FAQS.map((f) => (
            <FaqItem key={f.q} {...f} />
          ))}
        </div>
      </section>

      {/* ---- Final CTA ---------------------------------------------------------- */}
      <section className="px-5 pb-20 sm:px-6">
        <div className="mx-auto max-w-4xl rounded-[28px] bg-[#171412] px-8 py-16 text-center text-white sm:px-16">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl" style={display}>
            Start your workspace today.
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm text-white/55">
            Free to start. You're in your own workspace in under a minute.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-full bg-[#D2540A] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_-8px_rgba(210,84,10,0.5)] transition-all hover:-translate-y-0.5 hover:bg-[#B3480C]"
            >
              Create your account <ArrowRight size={16} />
            </Link>
            <Link to="/login" className="rounded-full px-7 py-3.5 text-sm font-semibold text-white/75 transition-colors hover:bg-white/10 hover:text-white">
              Log in
            </Link>
          </div>
          <ul className="mx-auto mt-9 flex max-w-md flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/45">
            {['No credit card', 'Manual login or Google', 'Works on mobile'].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check size={12} className="text-[#D2540A]" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---- Footer -------------------------------------------------------------- */}
      <footer className="border-t border-[#EDEAE3] px-5 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-[#171412]/40 sm:flex-row">
          <span className="font-semibold" style={display}>Brew Minds</span>
          <span>&copy; {new Date().getFullYear()} -- built for freelancers and small studios.</span>
        </div>
      </footer>
    </div>
  );
}
