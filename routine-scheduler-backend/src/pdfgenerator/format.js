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

// Teachers in the order they were assigned (the lead first), pairing
// half-lab teachers: KRV, ADR, IAH/STP
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
