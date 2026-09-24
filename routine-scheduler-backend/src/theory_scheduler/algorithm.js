// A theory meeting occupies one configured period. Existing classes (including
// three-period labs) are immutable; only the missing theory meetings are solved.
const TIME_COST = { 8: 40, 2: 220, 3: 260, 4: 300 };
const CT_PREFERRED_DAYS = new Set(["Saturday", "Monday", "Wednesday"]);
const CT_FALLBACK_DAYS = new Set(["Sunday", "Tuesday"]);
const PARALLEL_DAY_GAP_COST = 75;

function ctDayWeight(problem, day) {
  if (theoryCTSlotRequirement(problem.levelTerm) === 2) {
    if (day === "Saturday" || day === "Wednesday") return 110;
    return day === "Monday" ? 65 : 55;
  }
  return CT_PREFERRED_DAYS.has(day) ? 85 : 55;
}

function preferredCTDays(problem) {
  return theoryCTSlotRequirement(problem.levelTerm) === 2
    ? new Set(["Saturday", "Wednesday"])
    : CT_PREFERRED_DAYS;
}

function randomFrom(items, random) {
  return items[Math.floor(random() * items.length)];
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const intersects = (a, b) => a.some((item) => b.includes(item));
const sameOption = (a, b) =>
  a.optional && b.optional &&
  a.option_group != null && a.option_group === b.option_group &&
  a.course_id !== b.course_id;

function clashes(a, b) {
  if (a.day !== b.day) return false;
  if (a.course_id === b.course_id && intersects(a.sections, b.sections)) return true;
  if (!intersects(a.hours, b.hours)) return false;
  if (intersects(a.teachers, b.teachers)) return true;
  return intersects(a.sections, b.sections) && !sameOption(a, b);
}

function courseCode(courseId) {
  const match = /^([A-Z]+)\s*(\d+)$/.exec(String(courseId).trim().toUpperCase());
  return match ? `${match[1]}${Number(match[2])}` : null;
}

function pairedLabs(problem) {
  const labsByCode = new Map();
  for (const event of problem.fixed) {
    if (event.type !== 1 || !intersects(event.sections, problem.sections)) continue;
    const code = courseCode(event.course_id);
    if (!code) continue;
    if (!labsByCode.has(code)) labsByCode.set(code, []);
    labsByCode.get(code).push(event);
  }
  const pairs = new Map();
  for (const theoryCourse of problem.courseIds) {
    const match = /^([A-Z]+)(\d+)$/.exec(courseCode(theoryCourse) || "");
    if (!match) continue;
    const labCode = `${match[1]}${Number(match[2]) + 1}`;
    if (labsByCode.has(labCode)) pairs.set(theoryCourse, labsByCode.get(labCode));
  }
  return pairs;
}

function pairedLabConflicts(event, labs) {
  const sameDaySections = new Set();
  let parallelOverlap = false;
  for (const lab of labs || []) {
    if (event.day !== lab.day) continue;
    for (const section of event.sections) {
      if (lab.sections.includes(section)) sameDaySections.add(section);
    }
    // A different section's lab at the same hour is legal, but keeping the
    // theory/lab pair apart across the level-term is preferable when possible.
    if (lab.hours.includes(event.time) && !intersects(event.sections, lab.sections)) {
      parallelOverlap = true;
    }
  }
  return { sameDaySections: sameDaySections.size, parallelOverlap };
}

function ctSlotsFromEvents(problem, events) {
  if (!problem.times.includes(8)) return [];
  const preferred = preferredCTDays(problem);
  return problem.days.filter((day) =>
    CT_PREFERRED_DAYS.has(day) || CT_FALLBACK_DAYS.has(day)).map((day) => {
    const atEight = events.filter((event) => event.day === day &&
      event.hours.includes(8) && intersects(event.sections, problem.sections));
    return {
      day,
      priority: preferred.has(day) ? "preferred" : "fallback",
      available: !atEight.some((event) => event.course_id !== "CT"),
      ctScheduled: atEight.some((event) => event.course_id === "CT"),
    };
  });
}

export function theoryCTSlots(problem, assignments) {
  const byKey = new Map(problem.units.map((unit) => [unit.key, unit]));
  const events = [...problem.fixed, ...assignments.map((a) => ({
    ...byKey.get(a.key), day: a.day, time: a.time, hours: [a.time],
  }))];
  return ctSlotsFromEvents(problem, events);
}

export function theoryCTSlotRequirement(levelTerm) {
  const match = /^L-(\d+)\s*T-(\d+)$/i.exec(String(levelTerm || "").trim());
  if (!match) return 0;
  const level = Number(match[1]);
  const term = Number(match[2]);
  if (level === 1 || (level === 4 && term === 2)) return 2;
  if (level === 2 || level === 3 || (level === 4 && term === 1)) return 3;
  return 0;
}

function ctReservationSets(problem, required) {
  if (!required) return [new Set()];
  const freeDays = ctSlotsFromEvents(problem, problem.fixed)
    .filter((slot) => slot.available)
    .sort((a, b) => ctDayWeight(problem, b.day) - ctDayWeight(problem, a.day));
  if (freeDays.length < required) return [];
  const sets = [];
  const choose = (start, days) => {
    if (days.length === required) {
      sets.push(new Set(days));
      return;
    }
    for (let i = start; i <= freeDays.length - (required - days.length); i++) {
      choose(i + 1, [...days, freeDays[i].day]);
    }
  };
  choose(0, []);
  return sets.sort((a, b) =>
    [...b].reduce((total, day) => total + ctDayWeight(problem, day), 0) -
    [...a].reduce((total, day) => total + ctDayWeight(problem, day), 0));
}

export function validateTheoryAssignments(problem, assignments) {
  const issues = [];
  if (assignments.length !== problem.units.length) {
    issues.push(`Expected ${problem.units.length} theory meetings; received ${assignments.length}`);
  }
  const slotSet = new Set(problem.slots.map((s) => `${s.day}|${s.time}`));
  const unitMap = new Map(problem.units.map((u) => [u.key, u]));
  const seen = new Set();
  const placed = [];
  for (const a of assignments) {
    if (!a || typeof a !== "object") {
      issues.push("Invalid meeting assignment");
      continue;
    }
    const unit = unitMap.get(a.key);
    if (!unit || seen.has(a.key)) {
      issues.push(`Unknown or repeated meeting ${a.key}`);
      continue;
    }
    seen.add(a.key);
    if (!slotSet.has(`${a.day}|${a.time}`) || Number(a.time) === 1) {
      issues.push(`${unit.course_id}: ${a.day} ${a.time} is not an available theory period`);
      continue;
    }
    const event = { ...unit, day: a.day, time: Number(a.time), hours: [Number(a.time)] };
    for (const other of [...problem.fixed, ...placed]) {
      if (clashes(event, other)) {
        issues.push(`${unit.course_id} (${unit.sections.join("/")}) conflicts with ${other.course_id} on ${a.day} at ${a.time}:00`);
        break;
      }
    }
    placed.push(event);
  }
  const requiredCTSlots = theoryCTSlotRequirement(problem.levelTerm);
  if (requiredCTSlots) {
    const available = ctSlotsFromEvents(problem, [...problem.fixed, ...placed])
      .filter((slot) => slot.available).length;
    if (available < requiredCTSlots) {
      issues.push(`${problem.levelTerm} needs ${requiredCTSlots} common 8 AM CT slots; only ${available} remain free across all sections`);
    }
  }
  return issues;
}

function score(problem, assignments) {
  const byKey = new Map(problem.units.map((u) => [u.key, u]));
  const events = [
    ...problem.fixed,
    ...assignments.map((a) => ({ ...byKey.get(a.key), day: a.day, time: a.time, hours: [a.time] })),
  ];
  const dayNumber = new Map(problem.days.map((day, i) => [day, i]));
  let cost = 0;
  for (const a of assignments) cost += TIME_COST[a.time] || 0;

  // An 8 AM CT slot needs to be clear in every section at once. Penalize a
  // spoiled common slot once per day, encouraging unavoidable 8 AM theory to
  // concentrate on an already-blocked day rather than consume several CT days.
  for (const slot of ctSlotsFromEvents(problem, events)) {
    if (!slot.available) cost += ctDayWeight(problem, slot.day);
  }

  // CSE101 theory pairs with CSE102 sessional, CSE219 with CSE220, etc.
  // Avoid the paired lab's day for the same students and its occupied hours
  // across parallel sections, without turning a preference into infeasibility.
  const labsByTheory = pairedLabs(problem);
  for (const event of events) {
    const labs = labsByTheory.get(event.course_id);
    if (!labs) continue;
    const conflict = pairedLabConflicts(event, labs);
    cost += conflict.sameDaySections * 30 + (conflict.parallelOverlap ? 70 : 0);
  }

  // One course's meetings in one section should have a day between them;
  // three consecutive teaching days receive a particularly large penalty.
  for (const course of problem.courseIds) {
    for (const section of problem.sections) {
      const days = [...new Set(events
        .filter((e) => e.course_id === course && e.sections.includes(section))
        .map((e) => dayNumber.get(e.day)))].sort((a, b) => a - b);
      for (let i = 1; i < days.length; i++) {
        if (days[i] - days[i - 1] === 1) cost += 32;
      }
      for (let i = 2; i < days.length; i++) {
        if (days[i] - days[i - 2] === 2) cost += 220;
      }
    }
  }

  // Alternative courses in the same option group should occupy the same
  // periods. Different option groups must still remain separate.
  const options = new Map();
  for (const unit of [...problem.units, ...problem.fixed]) {
    if (!unit.optional || unit.option_group == null) continue;
    if (!problem.courseIds.includes(unit.course_id)) continue;
    if (!options.has(unit.option_group)) options.set(unit.option_group, new Set());
    options.get(unit.option_group).add(unit.course_id);
  }
  for (const courses of options.values()) {
    const [leader, ...rest] = [...courses];
    const leaderSlots = new Set(events.filter((e) => e.course_id === leader)
      .map((e) => `${e.day}|${e.time}`));
    for (const course of rest) {
      const slots = new Set(events.filter((e) => e.course_id === course)
        .map((e) => `${e.day}|${e.time}`));
      for (const slot of leaderSlots) if (!slots.has(slot)) cost += 70;
      for (const slot of slots) if (!leaderSlots.has(slot)) cost += 70;
    }
  }

  // Parallel sections normally get the same course on the same days, at
  // staggered one-hour periods (e.g. 9, 10 and 12).
  for (const course of problem.courseIds) {
    const courseEvents = events.filter((e) => e.course_id === course);
    for (const day of problem.days) {
      const onDay = courseEvents.filter((e) => e.day === day);
      const covered = new Set(onDay.flatMap((e) => e.sections));
      if (covered.size && covered.size < problem.sectionsForCourse[course].length) {
        cost += PARALLEL_DAY_GAP_COST * (problem.sectionsForCourse[course].length - covered.size);
      }
      for (let i = 0; i < onDay.length; i++) {
        for (let j = i + 1; j < onDay.length; j++) {
          if (intersects(onDay[i].sections, onDay[j].sections)) continue;
          const ti = problem.times.indexOf(onDay[i].time);
          const tj = problem.times.indexOf(onDay[j].time);
          if (ti === tj) cost += 75;
          else if (Math.abs(ti - tj) > 3) cost += 12 * (Math.abs(ti - tj) - 3);
        }
      }
    }
  }

  // Keep each section's day reasonably compact without overruling the
  // stronger spacing and morning preferences above.
  for (const section of problem.sections) {
    for (const day of problem.days) {
      const hours = events
        .filter((e) => e.sections.includes(section) && e.day === day && e.hours.length === 1)
        .map((e) => problem.times.indexOf(e.time))
        .filter((i) => i >= 0);
      if (hours.length > 1) cost += Math.max(0, Math.max(...hours) - Math.min(...hours) + 1 - hours.length) * 2;
    }
  }
  return cost;
}

export function theoryPreferenceWarnings(problem, assignments) {
  const warnings = [];
  const unitOf = new Map(problem.units.map((u) => [u.key, u]));
  const events = [...problem.fixed, ...assignments.map((a) => ({
    ...unitOf.get(a.key), day: a.day, time: a.time, hours: [a.time],
  }))];
  const labsByTheory = pairedLabs(problem);
  let sameDayPairs = 0;
  let parallelOverlaps = 0;
  for (const event of events) {
    const labs = labsByTheory.get(event.course_id);
    if (!labs) continue;
    const conflict = pairedLabConflicts(event, labs);
    sameDayPairs += conflict.sameDaySections;
    if (conflict.parallelOverlap) parallelOverlaps++;
  }
  if (sameDayPairs) warnings.push(
    `${sameDayPairs} theory/paired-sessional meeting(s) remain on the same day for a section.`
  );
  if (parallelOverlaps) warnings.push(
    `${parallelOverlaps} theory meeting(s) overlap their paired sessional in another section.`
  );
  const afternoon = assignments.filter((a) => [2, 3, 4].includes(a.time));
  const early = assignments.filter((a) => a.time === 8);
  if (early.length) {
    warnings.push(`${early.length} suggested theory meeting(s) use the discouraged 8 AM period.`);
  }
  if (afternoon.length) {
    warnings.push(`${afternoon.length} suggested theory meeting(s) use the strongly discouraged 2–4 PM period.`);
  }
  const differentSectionDays = [];
  for (const course of problem.courseIds) {
    const sections = problem.sectionsForCourse[course] || [];
    if (sections.length > 1) {
      const daysBySection = sections.map((section) => problem.days.filter((day) =>
        events.some((event) => event.course_id === course &&
          event.day === day && event.sections.includes(section))));
      if (daysBySection.some((days) =>
        days.join("|") !== daysBySection[0].join("|"))) {
        differentSectionDays.push(course);
      }
    }
    for (const section of sections) {
      const dayIndexes = [...new Set(events.filter((e) =>
        e.course_id === course && e.sections.includes(section))
        .map((e) => problem.days.indexOf(e.day)))].sort((a, b) => a - b);
      if (dayIndexes.some((d, i) => i >= 2 && d - dayIndexes[i - 2] === 2)) {
        warnings.push(`${course} (${section.split("|").at(-1)}) meets on three consecutive teaching days.`);
      }
    }
  }
  if (differentSectionDays.length) warnings.push(
    `Theory days still differ across sections for: ${differentSectionDays.join(", ")}.`
  );
  return warnings;
}

export function solveTheory(problem, options = {}) {
  const seed = Number.isInteger(options.seed) ? options.seed : Math.floor(Math.random() * 2 ** 31);
  const random = seededRandom(seed);
  const deadline = Date.now() + Math.min(20000, Math.max(1000, options.timeLimitMs || 12000));
  const requiredCTSlots = theoryCTSlotRequirement(problem.levelTerm);
  if (requiredCTSlots && !problem.times.includes(8)) {
    return { seed, assignments: [], score: null, attempts: 0,
      issues: ["8 AM is not configured, so common CT slots cannot be reserved."] };
  }
  const reservations = ctReservationSets(problem, requiredCTSlots);
  if (!reservations.length) {
    const fixedFree = ctSlotsFromEvents(problem, problem.fixed)
      .filter((slot) => slot.available).length;
    return { seed, assignments: [], score: null, attempts: 0,
      issues: [`${problem.levelTerm} needs ${requiredCTSlots} common 8 AM CT slots, but fixed classes leave only ${fixedFree}. Move a fixed 8 AM class or lab first.`] };
  }
  if (!problem.units.length) return { seed, assignments: [], score: 0, issues: [] };
  const unitOf = new Map(problem.units.map((u) => [u.key, u]));
  const eventFor = (unit, slot) =>
    ({ ...unit, day: slot.day, time: slot.time, hours: [slot.time] });
  const baseAllowed = new Map(problem.units.map((unit) => [unit.key,
    problem.slots.filter((slot) =>
      !problem.fixed.some((other) => clashes(eventFor(unit, slot), other)))]));

  let best = null;
  let bestScore = Infinity;
  let attempts = 0;
  while (Date.now() < deadline && attempts < Math.max(30, reservations.length * 3)) {
    attempts++;
    const reservedDays = reservations[(attempts - 1) % reservations.length];
    const candidateSlots = problem.slots.filter((slot) =>
      slot.time !== 8 || !reservedDays.has(slot.day));
    const assignments = [];
    const placed = [];
    const remaining = [...problem.units];
    let failed = false;
    while (remaining.length) {
      const choices = remaining.map((u) => ({
        unit: u,
        slots: baseAllowed.get(u.key).filter((slot) =>
          (slot.time !== 8 || !reservedDays.has(slot.day)) &&
          !placed.some((other) => clashes(eventFor(u, slot), other))),
      })).sort((a, b) => a.slots.length - b.slots.length || random() - 0.5);
      const choice = choices[0];
      if (!choice.slots.length) { failed = true; break; }
      const ranked = choice.slots.map((slot) => {
        const a = { key: choice.unit.key, day: slot.day, time: slot.time };
        return { a, value: score(problem, [...assignments, a]) + random() * 30 };
      }).sort((a, b) => a.value - b.value);
      const picked = ranked[Math.floor(random() * Math.min(3, ranked.length))].a;
      assignments.push(picked);
      placed.push(eventFor(choice.unit, picked));
      remaining.splice(remaining.findIndex((u) => u.key === choice.unit.key), 1);
    }
    if (failed) continue;

    let current = assignments;
    let currentScore = score(problem, current);
    if (currentScore < bestScore) { best = current.map((a) => ({ ...a })); bestScore = currentScore; }
    for (let iteration = 0; iteration < 3500 && Date.now() < deadline; iteration++) {
      const index = Math.floor(random() * current.length);
      const target = randomFrom(candidateSlots, random);
      const moved = eventFor(unitOf.get(current[index].key), target);
      if (problem.fixed.some((other) => clashes(moved, other))) continue;
      if (current.some((a, j) => j !== index &&
        clashes(moved, eventFor(unitOf.get(a.key), a)))) continue;
      const next = current.slice();
      next[index] = { ...next[index], day: target.day, time: target.time };
      const nextScore = score(problem, next);
      const temperature = 60 * (1 - iteration / 3500) + 1;
      if (nextScore < currentScore || random() < Math.exp((currentScore - nextScore) / temperature)) {
        current = next;
        currentScore = nextScore;
        if (currentScore < bestScore) { best = current.map((a) => ({ ...a })); bestScore = currentScore; }
      }
    }
  }
  return best
    ? { seed, assignments: best, score: bestScore, attempts, issues: [] }
    : { seed, assignments: [], score: null, attempts,
        issues: [`No clash-free schedule was found while keeping ${requiredCTSlots} shared 8 AM CT slots. Review fixed classes or try again.`] };
}
