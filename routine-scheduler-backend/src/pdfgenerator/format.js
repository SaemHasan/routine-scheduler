/* Text shared by the routine PDFs. */

const MONTHS = {
  jan: "January", feb: "February", mar: "March", apr: "April", may: "May", jun: "June",
  jul: "July", aug: "August", sep: "September", oct: "October", nov: "November", dec: "December",
};

// "July-25" → "July 2025"
export function termTitle(session) {
  const m = /^([A-Za-z]+)[-\s]*(\d{2,4})$/.exec((session || "").trim());
  if (!m) return session || "";
  const month = MONTHS[m[1].slice(0, 3).toLowerCase()] || m[1];
  const year = m[2].length === 2 ? `20${m[2]}` : m[2];
  return `${month} ${year}`;
}

// Dates in file names are the department's, not the server's (UTC)
const TIME_ZONE = "Asia/Dhaka";

/**
 * What a downloaded file is called: its type, the term and the day it was
 * made, e.g. downloadName("Level_Term", "July-26") on 29 October 2026 is
 * "Level_Term_July_2026_29_October_2026.pdf".
 */
export function downloadName(type, session, extension = "pdf", date = new Date()) {
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE, day: "numeric", month: "long", year: "numeric",
  }).format(date);
  return `${[type, termTitle(session), day].join(" ").replace(/[\\/:*?"<>|\s]+/g, "_")}.${extension}`;
}

// A lab's teachers, most senior first (as given), two half-lab teachers
// sharing one slot where the senior of them stands: KRV, ADR, IAH/STP
export function teacherLine(teachers) {
  const slots = [];
  let openHalf = null;
  for (const t of teachers) {
    if (Number(t.share) !== 0.5) {
      slots.push([t.initial]);
    } else if (openHalf) {
      openHalf.push(t.initial);
      openHalf = null;
    } else {
      openHalf = [t.initial];
      slots.push(openHalf);
    }
  }
  return slots.map((s) => s.join("/")).join(", ");
}

// Room order for lists and the room routine: theory rooms (103, 104, …),
// then rooms for theory and labs, then labs; the department's own rooms
// before other departments' (written "(EEE) PEL"); names in natural order.
const TYPE_RANK = { 0: 0, 2: 1, 1: 2 };
export function compareRooms(a, b) {
  const rank = (r) => TYPE_RANK[r.type] ?? 3;
  const external = (r) => (/^\(/.test(r.room) ? 1 : 0);
  return (
    rank(a) - rank(b) ||
    external(a) - external(b) ||
    a.room.localeCompare(b.room, undefined, { numeric: true, sensitivity: "base" })
  );
}
