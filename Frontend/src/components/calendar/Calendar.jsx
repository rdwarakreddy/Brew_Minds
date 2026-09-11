/**
 * Calendar.jsx
 * ---------------------------------------------------------------------
 * A self-built calendar (no external calendar library) so it matches
 * the app's exact visual language. Supports Month / Week / Day views,
 * navigation, and rendering a list of meetings on their date.
 *
 * We deliberately built this ourselves instead of pulling in
 * react-big-calendar: this app's calendar only needs to DISPLAY
 * meetings (no complex recurring-event or resource-scheduling logic),
 * so a focused ~150 line component gives us full styling control for
 * less complexity than adapting a general-purpose library's CSS.
 */

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Video } from 'lucide-react';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export default function Calendar({ meetings, onDayClick, onMeetingClick }) {
  const [view, setView] = useState('month'); // 'month' | 'week' | 'day'
  const [cursor, setCursor] = useState(new Date());

  // Group meetings by date (YYYY-MM-DD) for O(1) lookup while rendering cells.
  const meetingsByDate = useMemo(() => {
    const map = {};
    meetings.forEach((m) => {
      const key = m.meetingDate;
      if (!map[key]) map[key] = [];
      map[key].push(m);
    });
    return map;
  }, [meetings]);

  function navigate(delta) {
    const next = new Date(cursor);
    if (view === 'month') next.setMonth(next.getMonth() + delta);
    if (view === 'week') next.setDate(next.getDate() + delta * 7);
    if (view === 'day') next.setDate(next.getDate() + delta);
    setCursor(next);
  }

  const headerLabel = useMemo(() => {
    if (view === 'day') return cursor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (view === 'week') {
      const start = startOfWeek(cursor);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} \u2013 ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [cursor, view]);

  function renderMonth() {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const gridStart = startOfWeek(firstOfMonth);
    const cells = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(d.getDate() + i);
      return d;
    });

    return (
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line dark:border-line-dark dark:bg-line-dark">
        {WEEKDAYS.map((day) => (
          <div key={day} className="bg-canvas-muted py-2 text-center text-xs font-medium text-ink-soft dark:bg-canvas-dark-muted dark:text-ink-invert/50">
            {day}
          </div>
        ))}
        {cells.map((date) => {
          const key = toDateKey(date);
          const dayMeetings = meetingsByDate[key] || [];
          const isCurrentMonth = date.getMonth() === month;
          const isToday = key === toDateKey(new Date());
          return (
            <button
              key={key}
              onClick={() => onDayClick?.(key)}
              className={`min-h-[92px] bg-canvas p-2 text-left align-top dark:bg-canvas-dark ${
                isCurrentMonth ? '' : 'opacity-40'
              }`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  isToday ? 'bg-brass text-panel font-semibold' : 'text-ink dark:text-ink-invert'
                }`}
              >
                {date.getDate()}
              </span>
              <div className="mt-1 space-y-1">
                {dayMeetings.slice(0, 3).map((m) => (
                  <div
                    key={m.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMeetingClick?.(m);
                    }}
                    className="truncate rounded bg-brass/10 px-1.5 py-0.5 text-[11px] font-medium text-brass-dark dark:text-brass-light"
                  >
                    {String(m.meetingTime).slice(0, 5)} {m.title}
                  </div>
                ))}
                {dayMeetings.length > 3 && (
                  <p className="text-[11px] text-ink-soft dark:text-ink-invert/50">+{dayMeetings.length - 3} more</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  function renderAgendaList(days) {
    return (
      <div className="space-y-4">
        {days.map((date) => {
          const key = toDateKey(date);
          const dayMeetings = (meetingsByDate[key] || []).sort((a, b) => a.meetingTime.localeCompare(b.meetingTime));
          return (
            <div key={key} className="rounded-xl border border-line dark:border-line-dark">
              <div className="border-b border-line bg-canvas-muted px-4 py-2 text-sm font-medium text-ink dark:border-line-dark dark:bg-canvas-dark-muted dark:text-ink-invert">
                {date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
              <div className="divide-y divide-line dark:divide-line-dark">
                {dayMeetings.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-ink-soft dark:text-ink-invert/50">No meetings scheduled.</p>
                ) : (
                  dayMeetings.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => onMeetingClick?.(m)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-canvas-muted/50 dark:hover:bg-canvas-dark-muted/50"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink dark:text-ink-invert">{m.title}</p>
                        <p className="text-xs text-ink-soft dark:text-ink-invert/50">
                          {String(m.meetingTime).slice(0, 5)} {m.clientName ? `\u00b7 ${m.clientName}` : ''}
                        </p>
                      </div>
                      {m.googleMeetLink && <Video size={15} className="text-brass" />}
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = startOfWeek(cursor);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="rounded-full p-1.5 hover:bg-canvas-muted dark:hover:bg-canvas-dark-muted">
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-[180px] font-display text-base font-medium text-ink dark:text-ink-invert">
            {headerLabel}
          </span>
          <button onClick={() => navigate(1)} className="rounded-full p-1.5 hover:bg-canvas-muted dark:hover:bg-canvas-dark-muted">
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="ml-2 rounded-full border border-line px-3 py-1 text-xs font-medium text-ink-soft hover:text-ink dark:border-line-dark dark:text-ink-invert/60"
          >
            Today
          </button>
        </div>
        <div className="flex overflow-hidden rounded-full border border-line dark:border-line-dark">
          {['day', 'week', 'month'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                view === v
                  ? 'bg-ink text-canvas dark:bg-ink-invert dark:text-canvas-dark'
                  : 'text-ink-soft hover:bg-canvas-muted dark:text-ink-invert/60 dark:hover:bg-canvas-dark-muted'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' && renderMonth()}
      {view === 'week' && renderAgendaList(weekDays)}
      {view === 'day' && renderAgendaList([cursor])}
    </div>
  );
}
