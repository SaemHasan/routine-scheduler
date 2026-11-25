// Every lab section needs at least one full-time teacher; one on a half slot
// counts. Labs are given out teacher by teacher in seniority order, so once a
// teacher is reached, only they and the full-time teachers after them can
// still cover a lab that has none. This works out, before the teacher picks
// anything, whether those teachers can still cover every such lab and which
// of those labs this teacher must take for that to stay possible.
//
// Each remaining teacher can take as many more labs as their credit load
// allows, at most one in any time slot, and none in a slot where they already
// have a lab (labs already taken stay where they are). A theory class does not
// rule a teacher out, since a half slot may overlap theory.

const EPS = 1e-6;

/** Labs a teacher can still take: each is 3 credits of their load. */
export const labsLeft = (offered, credit) =>
  Math.max(0, Math.floor(((Number(offered) || 0) - (Number(credit) || 0)) / 3 + EPS));

/** Largest flow from `source` to `sink` over [from, to, capacity] edges (Dinic). */
function maxFlow(nodeCount, edges, source, sink) {
  const graph = Array.from({ length: nodeCount }, () => []);
  for (const [from, to, cap] of edges) {
    graph[from].push({ to, cap, rev: graph[to].length });
    graph[to].push({ to: from, cap: 0, rev: graph[from].length - 1 });
  }
  let flow = 0;
  for (;;) {
    const level = new Array(nodeCount).fill(-1);
    level[source] = 0;
    const queue = [source];
    for (let i = 0; i < queue.length; i++) {
      for (const edge of graph[queue[i]]) {
        if (edge.cap > 0 && level[edge.to] < 0) {
          level[edge.to] = level[queue[i]] + 1;
          queue.push(edge.to);
        }
      }
    }
    if (level[sink] < 0) return flow;
    const next = new Array(nodeCount).fill(0);
    const push = (node, limit) => {
      if (node === sink) return limit;
      for (; next[node] < graph[node].length; next[node]++) {
        const edge = graph[node][next[node]];
        if (edge.cap > 0 && level[edge.to] === level[node] + 1) {
          const sent = push(edge.to, Math.min(limit, edge.cap));
          if (sent > 0) {
            edge.cap -= sent;
            graph[edge.to][edge.rev].cap += sent;
            return sent;
          }
        }
      }
      return 0;
    };
    for (let sent = push(source, Infinity); sent > 0; sent = push(source, Infinity)) flow += sent;
  }
}

/**
 * @param {object} input
 * @param {string} input.initial teacher being assigned
 * @param {object[]} input.teachers active teachers: initial, seniority_rank,
 *   full_time_status, teacher_credits_offered, credit (load so far)
 * @param {object[]} input.labs one row per lab class: course_id, batch,
 *   section, day, time, teacher_count (teacher slots the section takes)
 * @param {object[]} input.assignments lab teachers so far: initial, course_id,
 *   batch, section, share, full_time_status
 * @param {object[]} input.theory theory classes: initial, day, time
 * @param {number[]} input.times the day's periods; a lab runs three of them
 * @param {string[]} [input.days] the week's days, to order the result
 */
export function forecastFullTimeCover({ initial, teachers, labs, assignments, theory, times, days = [] }) {
  const me = teachers.find((teacher) => teacher.initial === initial);
  if (!me) throw new Error(`${initial} is not an active teacher`);
  const keyOf = (row) => `${row.course_id}|${row.batch}|${row.section}`;
  const periods = (time) => {
    const index = times.indexOf(Number(time));
    return index < 0 ? [] : times.slice(index, index + 3);
  };

  // Lab sections, with the teacher slots already filled and whether a
  // full-time teacher is among those teachers
  const sections = new Map();
  for (const row of labs) {
    const key = keyOf(row);
    if (!sections.has(key)) {
      sections.set(key, {
        key, course_id: row.course_id, batch: row.batch, section: row.section,
        capacity: row.teacher_count == null ? Infinity : Number(row.teacher_count),
        classes: [], filled: 0, covered: false,
      });
    }
    sections.get(key).classes.push({ day: row.day, time: Number(row.time) });
  }
  const fullTime = new Set(teachers.filter((teacher) => teacher.full_time_status).map((teacher) => teacher.initial));
  const busy = new Map(); // teacher -> classes of the labs they already have
  for (const row of assignments) {
    const lab = sections.get(keyOf(row));
    if (!lab) continue;
    lab.filled += Number(row.share ?? 1);
    if (row.full_time_status ?? fullTime.has(row.initial)) lab.covered = true;
    busy.set(row.initial, [...(busy.get(row.initial) || []), ...lab.classes]);
  }
  const theoryOf = new Map();
  for (const row of theory) theoryOf.set(row.initial, [...(theoryOf.get(row.initial) || []), row]);

  const room = (lab) => lab.capacity - lab.filled;
  const free = (who, lab) => !(busy.get(who) || []).some((taken) => lab.classes.some((meet) =>
    meet.day === taken.day && periods(meet.time).some((hour) => periods(taken.time).includes(hour))));
  const inTheory = (who, lab) => (theoryOf.get(who) || []).some((row) => lab.classes.some((meet) =>
    meet.day === row.day && periods(meet.time).includes(Number(row.time))));
  // The time slots a lab takes up, one per class
  const slotsOf = (lab) => [...new Set(lab.classes.map((meet) => `${meet.day}|${meet.time}`))];

  const rank = Number(me.seniority_rank);
  const left = teachers.filter((teacher) => teacher.full_time_status && Number(teacher.seniority_rank) >= rank);
  const capacity = new Map(left.map((teacher) =>
    [teacher.initial, labsLeft(teacher.teacher_credits_offered, teacher.credit)]));
  const open = [...sections.values()].filter((lab) => !lab.covered);
  // Who could still be the full-time teacher of each open lab
  const takers = new Map(open.map((lab) => [lab.key, room(lab) < 0.5 - EPS ? [] : left
    .filter((teacher) => capacity.get(teacher.initial) > 0 && free(teacher.initial, lab))
    .map((teacher) => teacher.initial)]));
  // A flow can give a lab only one slot of its teacher's time, so a lab that
  // meets more than once a week is tried with each of its possible teachers in
  // turn (up to two such labs; any more are placed by their first class alone)
  const twice = open.filter((lab) => slotsOf(lab).length > 1).slice(0, 2);
  const once = open.filter((lab) => !twice.includes(lab));

  // Most of the `once` labs the teachers can cover with `caps` labs left each,
  // without the teacher|slot pairs in `blocked` or the labs in `skip`
  const flowOf = (caps, blocked, skip) => {
    const ids = new Map();
    const id = (name) => {
      if (!ids.has(name)) ids.set(name, ids.size);
      return ids.get(name);
    };
    const source = id("source");
    const sink = id("sink");
    const edges = [];
    for (const lab of once) {
      if (skip.has(lab.key)) continue;
      const slots = slotsOf(lab);
      for (const who of takers.get(lab.key)) {
        if (!(caps.get(who) > 0) || slots.some((slot) => blocked.has(`${who}|${slot}`))) continue;
        if (!ids.has(`t:${who}`)) edges.push([source, id(`t:${who}`), caps.get(who)]);
        const slot = `s:${who}|${slots[0]}`;
        if (!ids.has(slot)) edges.push([id(`t:${who}`), id(slot), 1]);
        edges.push([id(slot), id(`l:${lab.key}`), 1]);
      }
      if (ids.has(`l:${lab.key}`)) edges.push([id(`l:${lab.key}`), sink, 1]);
    }
    return maxFlow(ids.size, edges, source, sink);
  };

  // Most open labs the remaining teachers can cover, with this teacher's labs
  // left changed to `mine`, or some of this teacher's slots or one lab left out
  const cover = ({ mine, skipSlots = [], skipLab = null } = {}) => {
    const caps = new Map(capacity);
    if (mine !== undefined) caps.set(initial, mine);
    const blocked = new Set(skipSlots.map((slot) => `${initial}|${slot}`));
    const skip = new Set(skipLab ? [skipLab] : []);
    const branch = (index) => {
      if (index === twice.length) return flowOf(caps, blocked, skip);
      const lab = twice[index];
      if (skip.has(lab.key)) return branch(index + 1);
      skip.add(lab.key);
      const without = branch(index + 1); // left without a full-time teacher
      let most = without;
      const byLoad = [...takers.get(lab.key)].sort((a, b) => (caps.get(b) || 0) - (caps.get(a) || 0));
      for (const who of byLoad) {
        if (most > without) break; // covering it as well is the best there is
        const slots = slotsOf(lab).map((slot) => `${who}|${slot}`);
        if (!(caps.get(who) > 0) || slots.some((slot) => blocked.has(slot))) continue;
        caps.set(who, caps.get(who) - 1);
        slots.forEach((slot) => blocked.add(slot));
        most = Math.max(most, 1 + branch(index + 1));
        caps.set(who, caps.get(who) + 1);
        slots.forEach((slot) => blocked.delete(slot));
      }
      skip.delete(lab.key);
      return most;
    };
    return branch(0);
  };

  const text = (value) => String(value ?? "");
  const order = (a, b) => days.indexOf(a.day) - days.indexOf(b.day) || text(a.day).localeCompare(text(b.day)) ||
    times.indexOf(a.time) - times.indexOf(b.time) ||
    text(a.course_id).localeCompare(text(b.course_id)) || text(a.section).localeCompare(text(b.section));
  const describe = (lab) => ({
    course_id: lab.course_id, batch: lab.batch, section: lab.section,
    day: lab.classes[0].day, time: lab.classes[0].time,
    ...(lab.classes.length > 1 ? { classes: lab.classes } : {}),
  });
  // This teacher has a theory class then, or only half a slot is left
  const describeMine = (lab) => ({ ...describe(lab), half: inTheory(initial, lab) || room(lab) < 1 - EPS });

  const best = cover();
  const result = {
    initial,
    fullTime: fullTime.has(initial),
    labsLeft: labsLeft(me.teacher_credits_offered, me.credit),
    uncovered: open.length,
    teachersLeft: left.length,
    shortfall: open.length - best,
    needed: 0,
    slots: [],
    others: [],
    atRisk: [],
  };
  if (capacity.get(initial) > 0) {
    // Labs this teacher must cover for every lab that can be covered to be
    result.needed = best - cover({ mine: 0 });
    if (result.needed > 0) {
      const mine = open.filter((lab) => takers.get(lab.key).includes(initial));
      // Taking this lab still lets the others cover every lab they could
      const good = mine.filter((lab) => 1 + cover({
        mine: capacity.get(initial) - 1, skipSlots: slotsOf(lab), skipLab: lab.key,
      }) === best);
      // Slots this teacher cannot leave free without some lab going uncovered
      const forced = [...new Set(mine.flatMap(slotsOf))].filter((slot) => cover({ skipSlots: [slot] }) < best);
      const groups = [];
      for (const slot of forced) {
        const labs = good.filter((lab) => slotsOf(lab).includes(slot));
        const keys = labs.map((lab) => lab.key).sort().join();
        // A twice-a-week lab can be the one choice in both of its slots
        if (labs.length && !groups.some((group) => group.keys === keys)) groups.push({ slot, keys, labs });
      }
      result.slots = groups.map(({ slot, labs }) => {
        const [day, time] = slot.split("|");
        return { day, time: Number(time), labs: labs.map(describeMine).sort(order) };
      }).sort(order);
      if (result.needed > result.slots.length) {
        result.others = good.filter((lab) => !slotsOf(lab).some((slot) => forced.includes(slot)))
          .map(describeMine).sort(order);
      }
    }
  }
  if (result.shortfall > 0) {
    // Labs that could be the ones left without a full-time teacher
    result.atRisk = open.filter((lab) => cover({ skipLab: lab.key }) === best).map(describe).sort(order);
  }
  return result;
}
