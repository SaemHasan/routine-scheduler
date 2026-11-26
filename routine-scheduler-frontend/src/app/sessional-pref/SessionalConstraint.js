import { useState } from 'react';

// Longer lists show this many labs and a button for the rest
const SHOWN = 8;

const labName = (lab) => `${lab.course_id} (${lab.section})`;
const timeName = (meet) => `${meet.day} ${meet.time}:00`;
const plural = (count, one, many) => (count === 1 ? one : many);

function LabList({ labs, withTime = false }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? labs : labs.slice(0, SHOWN);
  return (
    <>
      {shown.map((lab, index) => (
        <span key={`${lab.course_id}-${lab.batch}-${lab.section}`}>
          {index > 0 && ', '}
          <strong>{labName(lab)}</strong>
          {lab.classes
            ? ` (${lab.classes.map(timeName).join(' and ')})`
            : withTime && ` ${timeName(lab)}`}
          {lab.half && <em title="A theory class at this time, or only half a slot left"> (half slot)</em>}
        </span>
      ))}
      {labs.length > shown.length && (
        <button type="button" className="btn btn-link btn-sm p-0 ml-1 align-baseline" onClick={() => setShowAll(true)}>
          +{labs.length - shown.length} more
        </button>
      )}
    </>
  );
}

const tones = {
  quiet: { color: '#6c757d', border: '#dee2e6', background: '#f8f9fa', icon: 'mdi-progress-clock' },
  clear: { color: '#1e7e34', border: '#b7e4c7', background: '#f0faf3', icon: 'mdi-check-circle-outline' },
  needed: { color: '#b35900', border: '#ffc078', background: '#fff8ef', icon: 'mdi-alert-circle-outline' },
  short: { color: '#b02a37', border: '#f1aeb5', background: '#fdf1f2', icon: 'mdi-alert-octagon-outline' },
};

/** The labs a teacher must take: one of a few in a given slot, or any of a list. */
function MustTake({ forecast, which, reason }) {
  const { initial, needed, slots, others } = forecast;
  const extra = needed - slots.length;
  return (
    <>
      <p className="mb-2">
        <strong>{initial} must take {plural(needed, 'one lab', `${needed} labs`)} {which}:</strong>
      </p>
      <ul className="mb-2 pl-4">
        {slots.map((slot) => (
          <li key={`${slot.day}-${slot.time}`}>
            {timeName(slot)}: {slot.labs.length > 1 && 'one of '}<LabList labs={slot.labs} />
          </li>
        ))}
        {extra > 0 && (
          <li>
            {others.length > 1 && `${plural(extra, 'One', extra)}${slots.length > 0 ? ' more' : ''} of: `}
            <LabList labs={others} withTime />
          </li>
        )}
      </ul>
      <p className="small mb-0" style={{ color: '#6c757d' }}>
        {reason} These labs are outlined in orange in the Sessional Choice Table.
      </p>
    </>
  );
}

/** Labs that may go short, and how many. */
function Shortfall({ children, atRisk, count }) {
  return (
    <div className="mt-3 p-2" style={{ background: tones.short.background, border: `1px solid ${tones.short.border}`, borderRadius: 8, color: tones.short.color }}>
      <i className="mdi mdi-alert-octagon-outline mr-1"></i>
      {children}{' '}
      {atRisk.length > count
        ? `Any ${count} of these could be ${plural(count, 'the one', 'the ones')} left out: `
        : `${plural(atRisk.length, 'It is', 'They are')}: `}
      <LabList labs={atRisk} withTime />
    </div>
  );
}

function FullTimeCheck({ initial, forecast }) {
  const { needed, shortfall, atRisk, uncovered } = forecast;
  let reason = '';
  if (forecast.labsLeft === 0) reason = `${initial}'s credit load is full.`;
  else if (uncovered === 0) reason = 'Every lab has a full-time teacher.';
  else if (shortfall === 0) {
    reason = `${uncovered} ${plural(uncovered, 'lab still has', 'labs still have')} no full-time teacher, ` +
      `and the full-time teachers after ${initial} can cover ${plural(uncovered, 'it', 'them')}.`;
  }
  return (
    <>
      {needed > 0 ? (
        <MustTake forecast={forecast} which={`that ${plural(needed, 'has', 'have')} no full-time teacher yet`}
          reason={`Otherwise the full-time teachers after ${initial} in seniority cannot cover every lab, given their theory classes, the labs they already have and the credit load they have left.`} />
      ) : (
        <p className="mb-0"><strong>No constraint.</strong> {reason}</p>
      )}
      {shortfall > 0 && (
        <Shortfall atRisk={atRisk} count={shortfall}>
          <strong>{shortfall} {plural(shortfall, 'lab', 'labs')} will be left without a full-time teacher</strong>{' '}
          even if {initial} and the full-time teachers after take the right labs.
        </Shortfall>
      )}
    </>
  );
}

function PartTimeCheck({ initial, forecast }) {
  const { needed, shortfall, atRisk, emptySlots, partTimeCredit, labsPerTeacher, more } = forecast;
  const load = `${partTimeCredit} credits (${labsPerTeacher} ${plural(labsPerTeacher, 'lab', 'labs')})`;
  let reason = '';
  if (emptySlots === 0) reason = 'Every lab has all its teachers.';
  else if (forecast.labsLeft === 0) reason = `${initial}'s part-time load of ${partTimeCredit} credits is full.`;
  else if (shortfall === 0) {
    reason = `${emptySlots} teaching ${plural(emptySlots, 'slot is', 'slots are')} still empty, ` +
      `and the part-time teachers after ${initial} can fill ${plural(emptySlots, 'it', 'them')}.`;
  }
  return (
    <>
      {needed > 0 ? (
        <MustTake forecast={forecast} which={`with ${plural(needed, 'an empty teaching slot', 'empty teaching slots')}`}
          reason={`Otherwise the part-time teachers after ${initial} in seniority, at ${load} each, cannot fill every empty teaching slot, given their theory classes and the labs they already have.`} />
      ) : (
        <p className="mb-0"><strong>No constraint.</strong> {reason}</p>
      )}
      {shortfall > 0 && (
        <Shortfall atRisk={atRisk} count={shortfall}>
          <strong>
            {shortfall} teaching {plural(shortfall, 'slot', 'slots')} will stay empty
          </strong>{' '}
          even if {initial} and the part-time teachers after take the right labs
          {more > 0 ? `; ${more} more part-time ${plural(more, 'teacher', 'teachers')} at ${load} would fill ${plural(shortfall, 'it', 'them')}.` : '.'}
        </Shortfall>
      )}
    </>
  );
}

/**
 * Before anything is picked, says which labs this teacher must take so the
 * teachers of their kind after them in seniority can still do their part:
 * the full-time teachers give every lab at least one full-time teacher, and
 * the part-time teachers fill every teaching slot left.
 */
export default function SessionalConstraint({ initial, forecast, status }) {
  let tone = tones.quiet;
  let body;
  if (status === 'loading') {
    body = <p className="mb-0">Checking which labs this teacher must take...</p>;
  } else if (status === 'failed') {
    body = <p className="mb-0">Could not check which labs this teacher must take.</p>;
  } else {
    const partTime = forecast.mode === 'part-time';
    tone = forecast.needed > 0 ? tones.needed : forecast.shortfall > 0 ? tones.short : tones.clear;
    body = partTime
      ? <PartTimeCheck initial={initial} forecast={forecast} />
      : <FullTimeCheck initial={initial} forecast={forecast} />;
  }
  const title = status === 'ready' && forecast.mode === 'part-time' ? 'Constraint (part-time)' : 'Constraint';
  return (
    <div className="card mb-4" style={{
      borderRadius: '16px', border: `2px solid ${tone.border}`, background: tone.background,
      boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
    }}>
      <div className="card-body" style={{ padding: '1.25rem 1.5rem', color: '#344767' }}>
        <h5 style={{ color: tone.color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <i className={`mdi ${tone.icon}`}></i>{title}
        </h5>
        {body}
      </div>
    </div>
  );
}
