import { isHalf, labPeriods, sessionalLoad } from '../shared/sessionalTeachers';

export default function TeacherCommitmentTable({ days, times, theory, labs, theses, onEdit }) {
  const events = [
    ...theory.map((row) => ({ ...row, kind: 'theory', hours: [Number(row.time)] })),
    ...labs.map((row) => ({ ...row, kind: 'lab', hours: labPeriods(times, row.time) })),
    ...theses.map((row) => ({ ...row, kind: 'thesis' })),
  ];
  const colors = { theory: '#e3f2fd', lab: '#f3e5f5', thesis: '#fff3cd' };
  return <div className="table-responsive">
    <table className="table table-bordered assignment-schedule-table">
      <thead><tr><th>Day / Time</th>{times.map((time) =>
        <th key={time}>{time}:00 {time >= 8 && time < 12 ? 'AM' : 'PM'}</th>
      )}</tr></thead>
      <tbody>{days.map((day) => {
        const cells = times.map((time) => events.filter((event) =>
          event.day === day && event.hours.includes(Number(time))));
        const signature = (cell) => JSON.stringify(cell);
        return <tr key={day}><th>{day}</th>{cells.map((cell, index) => {
          if (cell.length && index && signature(cell) === signature(cells[index - 1])) return null;
          let span = 1;
          while (cell.length && index + span < cells.length &&
            signature(cell) === signature(cells[index + span])) span++;
          return <td key={times[index]} colSpan={span} style={{ minWidth: 105, verticalAlign: 'top' }}>
            {cell.map((event, eventIndex) => <div key={eventIndex} style={{
              background: colors[event.kind], padding: 8, borderRadius: 6, marginBottom: 4,
            }}>
              <strong>{event.course_id}</strong>
              {event.kind === 'thesis' ? <>
                <div>Thesis {event.thesis} · {event.hours.length} hours</div>
                <small>Sessional overlap allowed</small>
              </> : <>
                <div>Section {event.section}</div>
                <small>{event.kind === 'lab'
                  ? `${isHalf(event) ? 'Half' : 'Full'} slot · ${sessionalLoad(event)} load`
                  : 'Theory'}</small>
                {event.kind === 'lab' && <div><button className="btn btn-sm btn-outline-secondary mt-1"
                  onClick={() => onEdit(event)}>Edit assignment</button></div>}
              </>}
            </div>)}
          </td>;
        })}</tr>;
      })}</tbody>
    </table>
  </div>;
}
