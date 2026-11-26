import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getPartTimePlan } from '../api/theory-assign';
import { setConfiguration } from '../api/config';

const plural = (count, one, many) => (count === 1 ? one : many);
const slotName = (slot) => `${slot.day} ${slot.time}:00`;

const tones = {
  quiet: { color: '#6c757d', border: '#dee2e6', background: '#f8f9fa' },
  clear: { color: '#1e7e34', border: '#b7e4c7', background: '#f0faf3' },
  plan: { color: 'rgb(154, 77, 226)', border: 'rgba(174, 117, 228, 0.35)', background: 'rgba(194, 137, 248, 0.06)' },
  short: { color: '#b02a37', border: '#f1aeb5', background: '#fdf1f2' },
};

/**
 * Whether the part-time teachers can fill every teaching slot the full-time
 * teachers leave, each taking the credit load set here, and how many more
 * part-time teachers it takes if they cannot.
 */
export default function PartTimePlan({ refreshKey }) {
  const [plan, setPlan] = useState(null);
  const [failed, setFailed] = useState(false);
  const [credit, setCredit] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPartTimePlan()
      .then((data) => {
        if (cancelled) return;
        setPlan(data);
        setCredit(String(data.partTimeCredit));
        setFailed(false);
      })
      .catch((error) => {
        console.error('Error checking the part-time teachers:', error);
        if (!cancelled) setFailed(true);
      });
    return () => { cancelled = true; };
  }, [refreshKey, saved]);

  const save = async (event) => {
    event.preventDefault();
    const value = Number(credit);
    if (!(value >= 3 && value <= 60)) {
      toast.error('Enter a credit load from 3 to 60');
      return;
    }
    setSaving(true);
    try {
      await setConfiguration('PART_TIME_CREDIT', value);
      toast.success(`Part-time teachers now take ${value} credits each`);
      setSaved((count) => count + 1);
    } catch (error) {
      console.error('Error saving the part-time credit load:', error);
      toast.error('Could not save the part-time credit load');
    } finally {
      setSaving(false);
    }
  };

  let tone = tones.quiet;
  let body = <p className="mb-0">Checking whether the part-time teachers can fill every lab...</p>;
  if (failed) {
    body = <p className="mb-0">Could not check whether the part-time teachers can fill every lab.</p>;
  } else if (plan && plan.emptySlots === 0) {
    tone = tones.clear;
    body = <p className="mb-0"><strong>Every lab has all its teachers.</strong></p>;
  } else if (plan) {
    const { emptySlots, labsShort, busiest, teachersLeft, shortfall, more, partTimeCredit } = plan;
    const add = more > 0
      ? `${more}${teachersLeft > 0 ? ' more' : ''} part-time ${plural(more, 'teacher', 'teachers')} at ${partTimeCredit} credits each would fill every slot.`
      : '';
    let verdict;
    if (teachersLeft === 0) {
      tone = tones.plan;
      verdict = <>No part-time teachers yet. {add}</>;
    } else if (shortfall === 0) {
      tone = tones.clear;
      verdict = <>The {teachersLeft} part-time {plural(teachersLeft, 'teacher', 'teachers')} in the list can fill every empty slot.</>;
    } else {
      tone = tones.short;
      verdict = (
        <>
          The {teachersLeft} part-time {plural(teachersLeft, 'teacher', 'teachers')} in the list can fill{' '}
          {emptySlots - shortfall} of them; {shortfall} would stay empty. {add}
        </>
      );
    }
    body = (
      <>
        <p className="mb-2">
          {emptySlots} teaching {plural(emptySlots, 'slot is', 'slots are')} still empty in {labsShort}{' '}
          {plural(labsShort, 'lab', 'labs')}, with the labs assigned so far.
          {busiest.length > 0 && ` Most at once: ${busiest.map((slot) => `${slotName(slot)} (${slot.empty})`).join(', ')}.`}
        </p>
        <p className="mb-2"><strong>{verdict}</strong></p>
        <p className="small mb-0" style={{ color: '#6c757d' }}>
          A teacher can be in only one lab at a time, so a busy slot can need more part-time teachers
          than the total load alone. Each part-time teacher's window shows which labs they must take.
        </p>
      </>
    );
  }

  return (
    <div className="card mb-4" style={{
      borderRadius: '16px', border: `2px solid ${tone.border}`, background: tone.background,
      boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
    }}>
      <div className="card-body" style={{ padding: '1.25rem 1.5rem', color: '#344767' }}>
        <h5 style={{ color: tone.color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <i className="mdi mdi-account-clock"></i>Part-time teachers
        </h5>
        <form className="d-flex align-items-center flex-wrap mb-3" style={{ gap: '8px' }} onSubmit={save}>
          <label htmlFor="part-time-credit" className="mb-0">Each part-time teacher takes</label>
          <input id="part-time-credit" type="number" min="3" max="60" step="0.5"
            className="form-control form-control-sm" style={{ width: '80px' }}
            value={credit} disabled={!plan || saving} onChange={(event) => setCredit(event.target.value)} />
          <span>credits{plan ? ` (${plan.labsPerTeacher} ${plural(plan.labsPerTeacher, 'lab', 'labs')})` : ''}.</span>
          {plan && Number(credit) !== plan.partTimeCredit && (
            <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
        </form>
        {body}
      </div>
    </div>
  );
}
