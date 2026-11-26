import { labCredit } from "./credit.js";

// Look-aheads for Sessional Assign. Labs are given out teacher by teacher in
// seniority order, so once a teacher is reached, only they and the teachers
// after them can still take labs. Two checks work this way, each among one
// kind of teacher only:
//
// - Full-time: every lab section needs at least one full-time teacher (one on
//   a half slot counts). Which labs still without one must this full-time
//   teacher take, so that the full-time teachers after them can cover the rest?
// - Part-time: part-time teachers fill the teaching slots the full-time ones
//   leave, each taking the same credit load (21 unless set otherwise). Which
//   labs must this part-time teacher take, so that the part-time teachers after
//   them can fill every slot still empty?
//
// Each teacher can take as many more labs as their credit load allows (3
// credits a lab), at most one in any time slot, and none in a slot where they
// already have a lab: labs already taken stay where they are.

const EPS = 1e-6;
export const DEFAULT_PART_TIME_CREDIT = 21;
// Starts the names of the made-up teachers counted when part-timers fall short
const NEW_TEACHER = "\u0000new";

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

const findTeacher = (teachers, initial) => {
  const teacher = teachers.find((row) => row.initial === initial);
  if (!teacher) throw new Error(`${initial} is not an active teacher`);
  return teacher;
};

/** Lab sections with their classes and teachers, and each teacher's labs and theory classes. */
function prepare({ teachers, labs, assignments, theory, times }) {
  const keyOf = (row) => `${row.course_id}|${row.batch}|${row.section}`;
  const periods = (time) => {
    const index = times.indexOf(Number(time));
    return index < 0 ? [] : times.slice(index, index + 3);
  };
  const sections = new Map();
  for (const row of labs) {
    const key = keyOf(row);
    if (!sections.has(key)) {
      sections.set(key, {
        key, course_id: row.course_id, batch: row.batch, section: row.section,
        capacity: row.teacher_count == null ? Infinity : Number(row.teacher_count),
        // A 3-credit lab meets twice a week and is two labs of a teacher's load
        cost: Math.max(1, Math.round(labCredit({ class_per_week: row.class_per_week }) / 3)),
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
  return {
    sections: [...sections.values()],
    fullTime,
    room: (lab) => lab.capacity - lab.filled,
    free: (who, lab) => !(busy.get(who) || []).some((taken) => lab.classes.some((meet) =>
      meet.day === taken.day && periods(meet.time).some((hour) => periods(taken.time).includes(hour)))),
    inTheory: (who, lab) => (theoryOf.get(who) || []).some((row) => lab.classes.some((meet) =>
      meet.day === row.day && periods(meet.time).includes(Number(row.time)))),
    // The time slots a lab takes up, one per class
    slotsOf: (lab) => [...new Set(lab.classes.map((meet) => `${meet.day}|${meet.time}`))],
  };
}

/**
 * How many of the teachers the labs still `need` can the teachers in
 * `capacity` (initial -> labs they can still take) give them, each taking
 * labs they `canTake`, at most one in any time slot; and which labs
 * `initial`, one of those teachers, must take for that many to stay possible.
 * Teachers that are `alike` are interchangeable until given a lab.
 */
function lookAhead({ ctx, need, capacity, canTake, initial = null, details = true, alike = () => false }) {
  const { slotsOf } = ctx;
  const open = ctx.sections.filter((lab) => need(lab) > 0);
  const takers = new Map(open.map((lab) => [lab.key,
    [...capacity.keys()].filter((who) => capacity.get(who) > 0 && canTake(who, lab))]));
  // A flow can give a lab only one slot of a teacher's time, so a lab that
  // meets more than once a week is tried with its possible teachers in turn
  // (up to two such labs; any more are placed by their first class alone)
  const twice = open.filter((lab) => slotsOf(lab).length > 1).slice(0, 2);
  const once = open.filter((lab) => !twice.includes(lab));

  // Teachers the `once` labs can get, with `caps` labs left per teacher and
  // without the teacher|slot pairs in `blocked`
  const flowOf = (caps, blocked, needOf) => {
    const ids = new Map();
    const id = (name) => {
      if (!ids.has(name)) ids.set(name, ids.size);
      return ids.get(name);
    };
    const source = id("source");
    const sink = id("sink");
    const edges = [];
    for (const lab of once) {
      const wanted = needOf(lab);
      if (wanted <= 0) continue;
      const slots = slotsOf(lab);
      for (const who of takers.get(lab.key)) {
        if (!((caps.get(who) || 0) > 0) || slots.some((slot) => blocked.has(`${who}|${slot}`))) continue;
        if (!ids.has(`t:${who}`)) edges.push([source, id(`t:${who}`), caps.get(who)]);
        const slot = `s:${who}|${slots[0]}`;
        if (!ids.has(slot)) edges.push([id(`t:${who}`), id(slot), 1]);
        edges.push([id(slot), id(`l:${lab.key}`), 1]);
      }
      if (ids.has(`l:${lab.key}`)) edges.push([id(`l:${lab.key}`), sink, wanted]);
    }
    return maxFlow(ids.size, edges, source, sink);
  };

  // Teachers the labs can get, with this teacher's labs left changed to
  // `mine`, some of this teacher's slots left out, or one lab (`fewer`)
  // needing one teacher less
  const cover = ({ mine, skipSlots = [], fewer = null } = {}) => {
    const caps = new Map(capacity);
    if (mine !== undefined) caps.set(initial, mine);
    const blocked = new Set(skipSlots.map((slot) => `${initial}|${slot}`));
    const inUse = new Set(); // teachers given a twice-a-week lab on this branch
    const needOf = (lab) => need(lab) - (lab.key === fewer ? 1 : 0);
    const branch = (index) => {
      if (index === twice.length) return flowOf(caps, blocked, needOf);
      const lab = twice[index];
      const without = branch(index + 1);
      const wanted = needOf(lab);
      if (wanted <= 0) return without;
      const slots = slotsOf(lab);
      const byLoad = [...takers.get(lab.key)].sort((a, b) => (caps.get(b) || 0) - (caps.get(a) || 0));
      let most = without;
      // Up to `wanted` of its teachers, each giving it every one of its slots
      const pick = (from, picked) => {
        let triedSpare = false;
        for (let i = from; i < byLoad.length && most < without + wanted; i++) {
          const who = byLoad[i];
          // Trying one unused teacher of a kind is trying them all
          const spare = alike(who) && !inUse.has(who);
          if (spare && triedSpare) continue;
          const theirs = slots.map((slot) => `${who}|${slot}`);
          if ((caps.get(who) || 0) < lab.cost || theirs.some((slot) => blocked.has(slot))) continue;
          if (spare) triedSpare = true;
          caps.set(who, caps.get(who) - lab.cost);
          theirs.forEach((slot) => blocked.add(slot));
          inUse.add(who);
          most = Math.max(most, picked + 1 + branch(index + 1));
          if (picked + 1 < wanted) pick(i + 1, picked + 1);
          inUse.delete(who);
          caps.set(who, caps.get(who) + lab.cost);
          theirs.forEach((slot) => blocked.delete(slot));
        }
      };
      pick(0, 0);
      return most;
    };
    return branch(0);
  };

  const total = open.reduce((sum, lab) => sum + need(lab), 0);
  const best = cover();
  const result = { total, best, needed: 0, groups: [], others: [], atRisk: [] };
  if (!details) return result;
  if (initial != null && capacity.get(initial) > 0) {
    // Labs this teacher must take for every lab that can get its teachers to
    result.needed = best - cover({ mine: 0 });
    if (result.needed > 0) {
      const mine = open.filter((lab) => takers.get(lab.key).includes(initial));
      // Taking this lab still lets the others give every lab what they could
      const good = mine.filter((lab) => capacity.get(initial) >= lab.cost && 1 + cover({
        mine: capacity.get(initial) - lab.cost, skipSlots: slotsOf(lab), fewer: lab.key,
      }) === best);
      // Slots this teacher cannot leave free without some lab going short
      const forced = [...new Set(mine.flatMap(slotsOf))].filter((slot) => cover({ skipSlots: [slot] }) < best);
      for (const slot of forced) {
        const labs = good.filter((lab) => slotsOf(lab).includes(slot));
        const keys = labs.map((lab) => lab.key).sort().join();
        // A twice-a-week lab can be the one choice in both of its slots
        if (labs.length && !result.groups.some((group) => group.keys === keys)) result.groups.push({ slot, keys, labs });
      }
      if (result.needed > result.groups.length) {
        result.others = good.filter((lab) => !slotsOf(lab).some((slot) => forced.includes(slot)));
      }
    }
  }
  // Labs that could be the ones left short
  if (best < total) result.atRisk = open.filter((lab) => cover({ fewer: lab.key }) === best);
  return result;
}

/** Labs and slots as sent to the page, in the routine's day and time order. */
function describer({ times, days, half }) {
  const text = (value) => String(value ?? "");
  const order = (a, b) => days.indexOf(a.day) - days.indexOf(b.day) || text(a.day).localeCompare(text(b.day)) ||
    times.indexOf(a.time) - times.indexOf(b.time) ||
    text(a.course_id).localeCompare(text(b.course_id)) || text(a.section).localeCompare(text(b.section));
  const slotOf = (slot) => {
    const [day, time] = slot.split("|");
    return { day, time: Number(time) };
  };
  const describe = (lab) => ({
    course_id: lab.course_id, batch: lab.batch, section: lab.section,
    day: lab.classes[0].day, time: lab.classes[0].time,
    ...(lab.classes.length > 1 ? { classes: lab.classes } : {}),
  });
  const mine = (lab) => ({ ...describe(lab), half: half(lab) });
  const show = (look) => ({
    slots: look.groups.map(({ slot, labs }) => ({ ...slotOf(slot), labs: labs.map(mine).sort(order) })).sort(order),
    others: look.others.map(mine).sort(order),
    atRisk: look.atRisk.map(describe).sort(order),
  });
  return { show, order, slotOf };
}

/**
 * @param {object} input
 * @param {string} input.initial teacher being assigned
 * @param {object[]} input.teachers active teachers: initial, seniority_rank,
 *   full_time_status, teacher_credits_offered, credit (load so far)
 * @param {object[]} input.labs one row per lab class: course_id, batch,
 *   section, day, time, teacher_count (teaching slots the section takes),
 *   class_per_week
 * @param {object[]} input.assignments lab teachers so far: initial, course_id,
 *   batch, section, share, full_time_status
 * @param {object[]} input.theory theory classes: initial, day, time
 * @param {number[]} input.times the day's periods; a lab runs three of them
 * @param {string[]} [input.days] the week's days, to order the result
 */
export function forecastFullTimeCover({ initial, teachers, labs, assignments, theory, times, days = [] }) {
  const me = findTeacher(teachers, initial);
  const ctx = prepare({ teachers, labs, assignments, theory, times });
  const left = teachers.filter((teacher) =>
    teacher.full_time_status && Number(teacher.seniority_rank) >= Number(me.seniority_rank));
  const capacity = new Map(left.map((teacher) =>
    [teacher.initial, labsLeft(teacher.teacher_credits_offered, teacher.credit)]));
  const look = lookAhead({
    ctx, capacity, initial,
    need: (lab) => (lab.covered ? 0 : 1),
    canTake: (who, lab) => ctx.room(lab) >= 0.5 - EPS && ctx.free(who, lab),
  });
  // This teacher has a theory class then, or only half a slot is left
  const { show } = describer({ times, days, half: (lab) => ctx.inTheory(initial, lab) || ctx.room(lab) < 1 - EPS });
  return {
    mode: "full-time",
    initial,
    fullTime: ctx.fullTime.has(initial),
    labsLeft: labsLeft(me.teacher_credits_offered, me.credit),
    uncovered: look.total,
    teachersLeft: left.length,
    shortfall: look.total - look.best,
    needed: look.needed,
    ...show(look),
  };
}

/**
 * Whether the part-time teachers can fill every teaching slot still empty,
 * each taking `partTimeCredit` credits of load. With `initial`, a part-time
 * teacher being assigned, only they and the part-time teachers after them
 * count, and the result says which labs they must take; without it, every
 * part-time teacher counts. Takes the same rows as forecastFullTimeCover.
 */
export function forecastPartTimeFill({
  initial = null, teachers, labs, assignments, theory, times, days = [],
  partTimeCredit = DEFAULT_PART_TIME_CREDIT,
}) {
  const me = initial == null ? null : findTeacher(teachers, initial);
  const ctx = prepare({ teachers, labs, assignments, theory, times });
  const left = teachers.filter((teacher) => !teacher.full_time_status &&
    (!me || Number(teacher.seniority_rank) >= Number(me.seniority_rank)));
  const capacity = new Map(left.map((teacher) => [teacher.initial, labsLeft(partTimeCredit, teacher.credit)]));
  // Every teaching slot a lab's sessional type gives it should be filled
  const need = (lab) => (Number.isFinite(lab.capacity) ? Math.max(0, Math.ceil(ctx.room(lab) - EPS)) : 0);
  // With a theory class then, a teacher can take only a half slot, which
  // fills a lab only when half a slot is all it lacks
  const canTake = (who, lab) => ctx.room(lab) >= 0.5 - EPS && ctx.free(who, lab) &&
    (!ctx.inTheory(who, lab) || ctx.room(lab) <= 0.5 + EPS);
  const look = lookAhead({ ctx, need, capacity, canTake, initial: me && !me.full_time_status ? initial : null });
  const shortfall = look.total - look.best;

  // Part-time teachers with nothing assigned yet who would have to join, at
  // the same load, for every slot to be filled
  const each = labsLeft(partTimeCredit, 0);
  let more = 0;
  if (shortfall > 0 && each > 0) {
    const fills = (count) => {
      const joined = new Map(capacity);
      for (let i = 1; i <= count; i++) joined.set(`${NEW_TEACHER}${i}`, each);
      const isNew = (who) => who.startsWith(NEW_TEACHER);
      return lookAhead({
        ctx, need, capacity: joined, details: false, alike: isNew,
        canTake: (who, lab) => (isNew(who) ? ctx.room(lab) >= 0.5 - EPS : canTake(who, lab)),
      }).best === look.total;
    };
    // `shortfall` new teachers, one per empty slot, always fill it
    let low = 1;
    let high = shortfall;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (fills(middle)) high = middle;
      else low = middle + 1;
    }
    more = low;
  }

  const { show, order, slotOf } = describer({ times, days, half: (lab) => ctx.room(lab) < 1 - EPS });
  // Time slots with the most teaching slots to fill at once
  const bySlot = new Map();
  for (const lab of ctx.sections) {
    const count = need(lab);
    if (count > 0) for (const slot of ctx.slotsOf(lab)) bySlot.set(slot, (bySlot.get(slot) || 0) + count);
  }
  const busiest = [...bySlot].map(([slot, empty]) => ({ ...slotOf(slot), empty }))
    .sort((a, b) => b.empty - a.empty || order(a, b)).slice(0, 3);
  return {
    mode: "part-time",
    initial,
    fullTime: me ? Boolean(me.full_time_status) : null,
    partTimeCredit,
    labsPerTeacher: each,
    labsLeft: me ? labsLeft(partTimeCredit, me.credit) : null,
    emptySlots: look.total,
    labsShort: ctx.sections.filter((lab) => need(lab) > 0).length,
    teachersLeft: left.length,
    teachersLabsLeft: [...capacity.values()].reduce((sum, count) => sum + count, 0),
    shortfall,
    more,
    needed: look.needed,
    busiest,
    ...show(look),
  };
}
