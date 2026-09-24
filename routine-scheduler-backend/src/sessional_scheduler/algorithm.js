/**
 * Sessional scheduler: places every sessional class (one per section or
 * subsection) in a lab slot and a lab room.
 *
 * It runs simulated annealing from several randomised starting routines and
 * keeps the best. Runs are not deterministic, so running again gives another
 * suggestion.
 *
 * Hard rules (never broken if avoidable): one class per room per slot, a
 * section never has two classes at once, no class in a slot the section is
 * busy or blocked, a course only in its allowed rooms, a teacher in one place
 * at a time, and at most `courseSlotLimit` subsections of one course in a
 * slot.
 *
 * Preferences: grouped classes share a slot (or, for an "apart" group, sit in
 * different slots), classes marked to share a room use one room together, labs
 * match the course's lab type, each kind of class is split between the lab
 * times in the proportion past routines used, the morning slot is avoided, a
 * slot keeps at least one lab free, the sections of a course fall on nearby
 * days and use as few rooms as possible, a section's labs are spread over
 * different days, classes are spread evenly over slots, and the week's
 * classes are shared evenly among the lab rooms.
 *
 * The module has no database code: `problem` is plain data.
 *
 * problem = {
 *   slots: [{ day, time, dayIndex, isMorning, isMidday }],  // never placed in a morning slot
 *   middayLimit,         // most midday (11 AM) labs a section should have
 *   apartPairs,          // [[courseKey, courseKey]] that should not share a slot
 *   rooms: [{ room, lab_type, restricted }],
 *   units: [{
 *     key, label, course_id, batch, section, department, level_term,
 *     groupKey,          // classes placed together (or apart)
 *     groupMode,         // 'together': one slot; 'apart': different slots;
 *                        // 'same': must share one slot (an elective option)
 *     roomShareKey,      // classes that share one room at once, or null
 *     spreadKey,         // sections of one course, kept on nearby days
 *     roomsKey,          // classes of one course, kept in as few rooms as possible
 *     levelKey,          // sections of one level-term, given similar time splits
 *     coverKeys: [],     // section keys the class occupies
 *     teachers: [],
 *     lab_type,          // 'SW' | 'HW' | null
 *     allowedRooms,      // [room] | null
 *     mixKey,            // kind of class for the time split, e.g. 'L1'
 *     slotShare,         // { [time]: share of past classes of this kind }
 *     mixWeight,         // how firmly the split is held (default 1)
 *     courseKey,         // classes of one course
 *     courseSlotLimit,   // most subsections of the course in one slot, or null
 *     preferred,         // { [slotIndex]: true } slots the course should use, or null
 *     blocked: { [slotIndex]: reason },
 *     clashSlots: { [slotIndex]: true }, // blocked because the section is busy
 *     fixed,             // { slot, room } for classes that must not move;
 *                        // with room -1 the scheduler still picks a room
 *   }],
 * }
 */

export const WEIGHTS = {
  hard: 1000,
  // Paired subsections were the strongest habit in past routines (92%)
  pairSplit: 80,
  shareRoom: 30,
  labType: 80,
  // Past routines never used the morning slot but did fill a slot now and
  // then, so a full slot is the lesser evil.
  timeMix: 15,
  crowded: 25,
  sameDay: 6,
  daySpread: 12,
  extraRoom: 20,
  middayOver: 50,
  levelBalance: 10,
  oneTime: 60,
  notPreferred: 40,
  apart: 60,
  balance: 0.5,
  // Past routines gave each software lab 6–10 classes a week
  roomBalance: 1.5,
};

const EFFORT = {
  quick: { iterations: 40000, restarts: 3 },
  normal: { iterations: 250000, restarts: 4 },
  thorough: { iterations: 400000, restarts: 6 },
};

// Small seeded generator so a run can be reproduced from its seed.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function solve(problem, options = {}) {
  const { effort = "normal", timeLimitMs = 15000 } = options;
  const seed =
    Number.isInteger(options.seed) ? options.seed : Math.floor(Math.random() * 2 ** 31);
  const rand = mulberry32(seed);
  const { iterations, restarts } = EFFORT[effort] || EFFORT.normal;
  const W = WEIGHTS;

  const { slots, rooms, units } = problem;
  const S = slots.length;
  const R = rooms.length;
  const U = units.length;
  const D = Math.max(1, ...slots.map((s) => s.dayIndex + 1));

  // ---- index cover keys, teachers and room occupants ----------------------
  const indexer = () => {
    const map = new Map();
    return [map, (k) => {
      if (!map.has(k)) map.set(k, map.size);
      return map.get(k);
    }];
  };
  const [coverIndex, coverId] = indexer();
  const [teacherIndex, teacherId] = indexer();
  const [occupantIndex, occupantId] = indexer();
  const cover = units.map((u) => u.coverKeys.map(coverId));
  const teach = units.map((u) => (u.teachers || []).map(teacherId));
  // Classes sharing a room count as one occupant of it
  const occupant = units.map((u, i) => occupantId(u.roomShareKey || `unit:${i}`));
  const K = Math.max(1, coverIndex.size);
  const T = Math.max(1, teacherIndex.size);
  const O = Math.max(1, occupantIndex.size);
  // A slot should leave at least one lab free
  const roomTarget = Math.max(1, rooms.filter((r) => !r.restricted).length - 1);
  const crowd = (used) => W.crowded * Math.max(0, used - roomTarget);
  // Subsections of one course in one slot are capped (e.g. at two)
  const [courseIndex, courseId] = indexer();
  const course = units.map((u, i) => courseId(u.courseKey || `unit:${i}`));
  const C = Math.max(1, courseIndex.size);
  const subsectionsOf = units.map((u) => Math.max(1, u.coverKeys.length));
  const courseLimit = new Float64Array(C).fill(Infinity);
  units.forEach((u, i) => {
    const c = course[i];
    if (u.courseSlotLimit) {
      courseLimit[c] =
        courseLimit[c] === Infinity ? u.courseSlotLimit : Math.max(courseLimit[c], u.courseSlotLimit);
    }
  });
  const overLimit = (c, n) => Math.max(0, n - courseLimit[c]);
  // Courses that should not share a slot with each course
  const apartOf = Array.from({ length: C }, () => []);
  const apartList = [];
  for (const [a, b] of problem.apartPairs || []) {
    const ca = courseIndex.get(a);
    const cb = courseIndex.get(b);
    if (ca === undefined || cb === undefined || ca === cb) continue;
    apartOf[ca].push(cb);
    apartOf[cb].push(ca);
    apartList.push([ca, cb]);
  }
  const slotDay = slots.map((s) => s.dayIndex);

  // ---- costs that depend only on the unit and its slot / room ------------
  // The scheduler only uses the 11 AM and 2 PM slots; a class in the morning
  // slot (8 AM) is one someone placed by hand and locked.
  const openSlots = slots.map((_, i) => i).filter((i) => !slots[i].isMorning);
  if (openSlots.length === 0) slots.forEach((_, i) => openSlots.push(i));
  const randomSlot = () => openSlots[Math.floor(rand() * openSlots.length)];
  const slotStatic = units.map((u) =>
    slots.map(
      (s, i) =>
        (u.blocked && u.blocked[i] ? W.hard : 0) +
        (u.preferred && !u.preferred[i] ? W.notPreferred : 0)
    )
  );

  // Past routines: each kind of class (e.g. Level 1, other departments) was
  // split between 11 AM and 2 PM in a typical proportion. A kind pays for how
  // far its current split is from that proportion.
  const labTimes = [...new Set(slots.map((s) => s.time))];
  const timeOfSlot = slots.map((s) => labTimes.indexOf(s.time));
  const TT = labTimes.length;
  const [mixIndex, mixId] = indexer();
  const mix = units.map((u) => (u.slotShare ? mixId(u.mixKey || JSON.stringify(u.slotShare)) : -1));
  const M = Math.max(1, mixIndex.size);
  const mixShare = Array.from({ length: M }, () => new Float64Array(TT));
  const mixWeight = new Float64Array(M).fill(1);
  units.forEach((u, i) => {
    if (mix[i] < 0) return;
    labTimes.forEach((t, ti) => {
      mixShare[mix[i]][ti] = u.slotShare[t] || 0;
    });
    if (u.mixWeight) mixWeight[mix[i]] = u.mixWeight;
  });
  const roomStatic = units.map((u) => {
    const allowed = u.allowedRooms && u.allowedRooms.length ? new Set(u.allowedRooms) : null;
    return rooms.map((r) => {
      if (allowed) return allowed.has(r.room) ? 0 : W.hard;
      if (r.restricted) return W.hard;
      if (u.lab_type && r.lab_type && u.lab_type !== r.lab_type) return W.labType;
      return 0;
    });
  });

  // ---- grouping rules ----------------------------------------------------
  // kind 'together' | 'apart' (by slot) or 'room' (share one room)
  const groups = [];
  const unitGroups = units.map(() => []);
  const slotGroupOf = new Int32Array(U);
  const addGroups = (keyOf, kindOf) => {
    const ids = new Map();
    units.forEach((u, i) => {
      const key = keyOf(u, i);
      if (key === null || key === undefined) return;
      if (!ids.has(key)) {
        ids.set(key, groups.length);
        groups.push({ kind: kindOf(u), members: [] });
      }
      groups[ids.get(key)].members.push(i);
    });
    return ids;
  };
  const slotKey = (u, i) => `slot:${u.groupKey ?? `unit:${i}`}`;
  const slotIds = addGroups(slotKey, (u) =>
    u.groupMode === "apart" ? "apart" : u.groupMode === "same" ? "same" : "together"
  );
  addGroups((u) => (u.roomShareKey ? `room:${u.roomShareKey}` : null), () => "room");
  addGroups((u) => (u.spreadKey ? `days:${u.spreadKey}` : null), () => "days");
  const roomsIds = addGroups((u) => (u.roomsKey ? `rooms:${u.roomsKey}` : null), () => "rooms");
  // Which rooms each course already uses, to steer room choices to them
  const roomsGroupOf = units.map((u) => (u.roomsKey ? roomsIds.get(`rooms:${u.roomsKey}`) : -1));
  const roomsGroupIndex = new Map([...roomsIds.values()].map((g, i) => [g, i]));
  const RG = Math.max(1, roomsGroupIndex.size);
  groups.forEach((g, id) => g.members.forEach((m) => unitGroups[m].push(id)));
  units.forEach((u, i) => {
    slotGroupOf[i] = slotIds.get(slotKey(u, i));
  });
  const roomSiblings = units.map((u, i) =>
    u.roomShareKey
      ? units.map((v, j) => (j !== i && v.roomShareKey === u.roomShareKey ? j : -1)).filter((j) => j >= 0)
      : []
  );

  const fixedSlot = new Int32Array(U).fill(-1);
  const fixedRoom = new Int32Array(U).fill(-1);
  units.forEach((u, i) => {
    if (u.fixed && u.fixed.slot >= 0) {
      fixedSlot[i] = u.fixed.slot;
      fixedRoom[i] = u.fixed.room;
    }
  });
  const movable = [];
  for (let i = 0; i < U; i++) if (fixedSlot[i] < 0) movable.push(i);
  // A locked class without a room keeps its slot but still gets a room
  const roomOpen = units.map((_, i) => fixedSlot[i] >= 0 && fixedRoom[i] < 0 && R > 0);
  const adjustable = [...movable];
  for (let i = 0; i < U; i++) if (roomOpen[i]) adjustable.push(i);

  // ---- mutable state -----------------------------------------------------
  const RR = Math.max(1, R);
  const roomOcc = new Int16Array(S * RR); // distinct occupants per room and slot
  const roomsUsed = new Int16Array(S); // rooms with anyone in them, per slot
  const roomWeek = new Int16Array(RR); // classes in each room over the week
  const balanced = rooms.map((r) => !r.restricted);
  const occupantCount = new Int16Array(S * RR * O);
  const coverOcc = new Int16Array(S * K);
  const dayCover = new Int16Array(D * K);
  const teacherOcc = new Int16Array(S * T);
  const courseOcc = new Int16Array(S * C); // subsections of each course per slot

  // Midday (11 AM) labs per section, and the 11 AM / 2 PM split of the
  // sections of each level-term. The theory routine needs the mornings, so a
  // section should have at most `middayLimit` midday labs, and no section of
  // a level-term should have all its labs at one time while others differ.
  const middayLimit = problem.middayLimit ?? 2;
  const isMidday = slots.map((sl) => Boolean(sl.isMidday));
  const coverTotal = new Int16Array(K);
  const coverMidday = new Int16Array(K);
  const [levelIndex, levelId] = indexer();
  const levelOfUnit = units.map((u) => (u.levelKey ? levelId(u.levelKey) : -1));
  const levelCovers = Array.from({ length: Math.max(1, levelIndex.size) }, () => new Set());
  units.forEach((u, i) => {
    if (levelOfUnit[i] >= 0) cover[i].forEach((k) => levelCovers[levelOfUnit[i]].add(k));
  });
  const levelCoverList = levelCovers.map((set) => [...set]);
  // Too many midday labs, or every lab at one time (all 11 AM or all 2 PM)
  const middayOver = (k) =>
    W.middayOver * Math.max(0, coverMidday[k] - middayLimit) +
    (coverTotal[k] >= 2 && (coverMidday[k] === 0 || coverMidday[k] === coverTotal[k]) ? W.oneTime : 0);
  // Each section pays for how far its midday count is from its level-term's
  // overall share
  function levelCost(g) {
    let total = 0;
    let midday = 0;
    for (const k of levelCoverList[g]) {
      total += coverTotal[k];
      midday += coverMidday[k];
    }
    if (total === 0) return 0;
    const share = midday / total;
    let dev = 0;
    for (const k of levelCoverList[g]) dev += Math.abs(coverMidday[k] - coverTotal[k] * share);
    return W.levelBalance * dev;
  }
  // Change in the two section costs when unit u enters (+1) or leaves (-1) slot s
  function sectionTimeDelta(u, s, sign) {
    const g = levelOfUnit[u];
    let before = g >= 0 ? levelCost(g) : 0;
    for (const k of cover[u]) before += middayOver(k);
    for (const k of cover[u]) {
      coverTotal[k] += sign;
      if (isMidday[s]) coverMidday[k] += sign;
    }
    let after = g >= 0 ? levelCost(g) : 0;
    for (const k of cover[u]) after += middayOver(k);
    return after - before;
  }
  const courseRoomCount = new Int16Array(RG * RR); // classes of a course per room
  const roomSeen = new Int32Array(RR);
  const slotSeen = new Int32Array(S);
  const slotOccupants = new Int16Array(S);
  let stamp = 0;
  const courseRoomBase = units.map((_, u) =>
    roomsGroupOf[u] >= 0 ? roomsGroupIndex.get(roomsGroupOf[u]) * RR : -1
  );
  const mixCount = new Int16Array(M * TT); // classes of each kind per lab time
  const mixTotal = new Int16Array(M);
  const mixCost = (m) => {
    let dev = 0;
    for (let t = 0; t < TT; t++) dev += Math.abs(mixCount[m * TT + t] - mixShare[m][t] * mixTotal[m]);
    return W.timeMix * mixWeight[m] * dev;
  };
  const slotCount = new Int32Array(S);
  const slotOf = new Int32Array(U).fill(-1);
  const roomOf = new Int32Array(U).fill(-1);

  function place(u, s, r) {
    let d = 0;
    if (r >= 0) {
      const cell = s * R + r;
      const oc = cell * O + occupant[u];
      if (occupantCount[oc] === 0) {
        d += W.hard * roomOcc[cell];
        if (roomOcc[cell] === 0) {
          d += crowd(roomsUsed[s] + 1) - crowd(roomsUsed[s]);
          roomsUsed[s]++;
        }
        roomOcc[cell]++;
        if (balanced[r]) {
          d += W.roomBalance * (2 * roomWeek[r] + 1);
          roomWeek[r]++;
        }
      }
      occupantCount[oc]++;
      d += roomStatic[u][r];
      if (courseRoomBase[u] >= 0) courseRoomCount[courseRoomBase[u] + r]++;
    }
    const day = slotDay[s];
    for (const k of cover[u]) {
      d += W.hard * coverOcc[s * K + k];
      coverOcc[s * K + k]++;
      d += W.sameDay * dayCover[day * K + k];
      dayCover[day * K + k]++;
    }
    for (const t of teach[u]) {
      d += W.hard * teacherOcc[s * T + t];
      teacherOcc[s * T + t]++;
    }
    const cs = s * C + course[u];
    d += W.hard * (overLimit(course[u], courseOcc[cs] + subsectionsOf[u]) - overLimit(course[u], courseOcc[cs]));
    if (courseOcc[cs] === 0) {
      for (const p of apartOf[course[u]]) if (courseOcc[s * C + p] > 0) d += W.apart;
    }
    courseOcc[cs] += subsectionsOf[u];
    if (mix[u] >= 0) {
      const before = mixCost(mix[u]);
      mixCount[mix[u] * TT + timeOfSlot[s]]++;
      mixTotal[mix[u]]++;
      d += mixCost(mix[u]) - before;
    }
    d += sectionTimeDelta(u, s, 1);
    d += W.balance * (2 * slotCount[s] + 1);
    slotCount[s]++;
    d += slotStatic[u][s];
    slotOf[u] = s;
    roomOf[u] = r;
    return d;
  }

  function unplace(u) {
    const s = slotOf[u];
    const r = roomOf[u];
    let d = 0;
    if (r >= 0) {
      const cell = s * R + r;
      const oc = cell * O + occupant[u];
      occupantCount[oc]--;
      if (occupantCount[oc] === 0) {
        roomOcc[cell]--;
        d -= W.hard * roomOcc[cell];
        if (balanced[r]) {
          roomWeek[r]--;
          d -= W.roomBalance * (2 * roomWeek[r] + 1);
        }
        if (roomOcc[cell] === 0) {
          roomsUsed[s]--;
          d -= crowd(roomsUsed[s] + 1) - crowd(roomsUsed[s]);
        }
      }
      d -= roomStatic[u][r];
      if (courseRoomBase[u] >= 0) courseRoomCount[courseRoomBase[u] + r]--;
    }
    const day = slotDay[s];
    for (const k of cover[u]) {
      coverOcc[s * K + k]--;
      d -= W.hard * coverOcc[s * K + k];
      dayCover[day * K + k]--;
      d -= W.sameDay * dayCover[day * K + k];
    }
    for (const t of teach[u]) {
      teacherOcc[s * T + t]--;
      d -= W.hard * teacherOcc[s * T + t];
    }
    const cs = s * C + course[u];
    courseOcc[cs] -= subsectionsOf[u];
    if (courseOcc[cs] === 0) {
      for (const p of apartOf[course[u]]) if (courseOcc[s * C + p] > 0) d -= W.apart;
    }
    d -= W.hard * (overLimit(course[u], courseOcc[cs] + subsectionsOf[u]) - overLimit(course[u], courseOcc[cs]));
    if (mix[u] >= 0) {
      const before = mixCost(mix[u]);
      mixCount[mix[u] * TT + timeOfSlot[s]]--;
      mixTotal[mix[u]]--;
      d += mixCost(mix[u]) - before;
    }
    d += sectionTimeDelta(u, s, -1);
    slotCount[s]--;
    d -= W.balance * (2 * slotCount[s] + 1);
    d -= slotStatic[u][s];
    slotOf[u] = -1;
    roomOf[u] = -1;
    return d;
  }

  // Cost of one grouping rule. 'together' pays for every member outside its
  // most common slot, 'apart' for every member sharing a slot with another,
  // 'room' for every member outside its most common slot-and-room, 'days'
  // for every day its members span beyond one. Only placed members count,
  // so a rule costs nothing before it is placed.
  function groupCost(g) {
    const { kind, members } = groups[g];
    if (members.length < 2) return 0;
    if (kind === "rooms") {
      // Rooms used beyond the fewest possible: as many as the course ever
      // needs at once (paired subsections need two). Scratch arrays with a
      // stamp avoid allocating on every call.
      stamp++;
      let used = 0;
      let needed = 0;
      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        const s = slotOf[m];
        const r = roomOf[m];
        if (s < 0 || r < 0) continue;
        if (roomSeen[r] !== stamp) {
          roomSeen[r] = stamp;
          used++;
        }
        // A new occupant in this slot unless an earlier member shares it
        let fresh = true;
        for (let j = 0; j < i; j++) {
          const o = members[j];
          if (slotOf[o] === s && roomOf[o] >= 0 && occupant[o] === occupant[m]) {
            fresh = false;
            break;
          }
        }
        if (fresh) {
          if (slotSeen[s] !== stamp) {
            slotSeen[s] = stamp;
            slotOccupants[s] = 0;
          }
          slotOccupants[s]++;
          if (slotOccupants[s] > needed) needed = slotOccupants[s];
        }
      }
      return W.extraRoom * Math.max(0, used - needed);
    }
    if (kind === "days") {
      let lo = Infinity;
      let hi = -Infinity;
      for (const m of members) {
        if (slotOf[m] < 0) continue;
        const d = slotDay[slotOf[m]];
        if (d < lo) lo = d;
        if (d > hi) hi = d;
      }
      return hi > lo ? W.daySpread * Math.max(0, hi - lo - 1) : 0;
    }
    const counts = new Map();
    let placed = 0;
    let best = 0;
    for (const m of members) {
      if (slotOf[m] < 0) continue;
      placed++;
      const key = kind === "room" ? slotOf[m] * RR + roomOf[m] : slotOf[m];
      const c = (counts.get(key) || 0) + 1;
      counts.set(key, c);
      if (c > best) best = c;
    }
    if (kind === "apart") return W.pairSplit * (placed - counts.size);
    if (kind === "room") return W.shareRoom * (placed - best);
    // The classes of an elective option must run at once
    if (kind === "same") return W.hard * (placed - best);
    return W.pairSplit * (placed - best);
  }

  const groupsCost = (set) => {
    let c = 0;
    for (const g of set) c += groupCost(g);
    return c;
  };

  // Cheapest room for an unplaced unit at slot s (ties broken at random).
  // Joining a room-sharing sibling costs nothing and is preferred.
  function bestRoom(u, s) {
    if (R === 0) return -1;
    let best = -1;
    let bestCost = Infinity;
    for (let r = 0; r < R; r++) {
      const cell = s * R + r;
      const joins = occupantCount[cell * O + occupant[u]] > 0;
      const courseUses = courseRoomBase[u] >= 0 && courseRoomCount[courseRoomBase[u] + r] > 0;
      const c =
        (joins ? -W.shareRoom : W.hard * roomOcc[cell]) +
        roomStatic[u][r] +
        (courseUses ? -W.extraRoom : 0) +
        rand() * 0.5;
      if (c < bestCost) {
        bestCost = c;
        best = r;
      }
    }
    return best;
  }

  /**
   * Moves the listed units ([unit, slot, room?]; a missing room picks the
   * best one) and returns the change in cost plus what is needed to undo it.
   */
  function moveUnits(list) {
    const affected = new Set();
    for (const [m] of list) for (const g of unitGroups[m]) affected.add(g);
    let d = -groupsCost(affected);
    const undo = list.map(([m]) => [m, slotOf[m], roomOf[m]]);
    for (const [m] of list) if (slotOf[m] >= 0) d += unplace(m);
    for (const [m, s, r] of list) d += place(m, s, r === undefined ? bestRoom(m, s) : r);
    d += groupsCost(affected);
    return { d, undo };
  }

  function undoMove(undo) {
    for (const [m] of undo) unplace(m);
    for (const [m, s, r] of undo) if (s >= 0) place(m, s, r);
  }

  // `useRooms` gives the rooms of locked classes that had none (when loading
  // a finished routine); otherwise they get the best free room.
  function resetState(useRooms = null) {
    roomOcc.fill(0);
    roomsUsed.fill(0);
    roomWeek.fill(0);
    occupantCount.fill(0);
    courseRoomCount.fill(0);
    coverOcc.fill(0);
    dayCover.fill(0);
    teacherOcc.fill(0);
    courseOcc.fill(0);
    mixCount.fill(0);
    mixTotal.fill(0);
    coverTotal.fill(0);
    coverMidday.fill(0);
    slotCount.fill(0);
    slotOf.fill(-1);
    roomOf.fill(-1);
    let cost = 0;
    for (let i = 0; i < U; i++) {
      if (fixedSlot[i] < 0) continue;
      const room = roomOpen[i] ? (useRooms ? useRooms[i] : bestRoom(i, fixedSlot[i])) : fixedRoom[i];
      cost += place(i, fixedSlot[i], room);
    }
    for (let g = 0; g < groups.length; g++) cost += groupCost(g);
    return cost;
  }

  // Greedy start: hardest slot groups first, each placed where it costs
  // least. Members of an "apart" group are placed one at a time.
  function construct() {
    let cost = resetState();
    const order = groups
      .flatMap((g) => {
        if (g.kind === "room" || g.kind === "days" || g.kind === "rooms") return [];
        const free = g.members.filter((m) => fixedSlot[m] < 0);
        return g.kind === "apart" ? free.map((m) => [m]) : [free];
      })
      .filter((free) => free.length > 0)
      .map((free) => ({
        free,
        feasible: Math.min(...free.map((m) => openSlots.filter((i) => slotStatic[m][i] < W.hard).length)),
        noise: rand(),
      }))
      .sort((a, b) => a.feasible - b.feasible || b.free.length - a.free.length || a.noise - b.noise);

    for (const { free } of order) {
      const options = [];
      for (const s of openSlots) {
        const { d, undo } = moveUnits(free.map((m) => [m, s]));
        undoMove(undo);
        options.push({ s, d: d + rand() * 20 });
      }
      options.sort((a, b) => a.d - b.d);
      // Some variety between runs, but never a clearly worse slot
      const close = options.filter((o) => o.d <= options[0].d + 30);
      const pick = close[Math.floor(rand() * close.length)].s;
      cost += moveUnits(free.map((m) => [m, pick])).d;
    }
    return cost;
  }

  // Cost of the current routine, summed from the occupancy counts. It must
  // equal the running total kept by place() / unplace().
  function totalCost() {
    let cost = 0;
    for (let s = 0; s < S; s++) {
      for (let r = 0; r < R; r++) {
        const c = roomOcc[s * R + r];
        cost += (W.hard * c * (c - 1)) / 2;
      }
      for (let k = 0; k < K; k++) {
        const c = coverOcc[s * K + k];
        cost += (W.hard * c * (c - 1)) / 2;
      }
      for (let t = 0; t < T; t++) {
        const c = teacherOcc[s * T + t];
        cost += (W.hard * c * (c - 1)) / 2;
      }
      for (let c = 0; c < C; c++) cost += W.hard * overLimit(c, courseOcc[s * C + c]);
      for (const [a, b] of apartList) {
        if (courseOcc[s * C + a] > 0 && courseOcc[s * C + b] > 0) cost += W.apart;
      }
      cost += crowd(roomsUsed[s]);
      cost += W.balance * slotCount[s] * slotCount[s];
    }
    for (let d = 0; d < D; d++) {
      for (let k = 0; k < K; k++) {
        const c = dayCover[d * K + k];
        cost += (W.sameDay * c * (c - 1)) / 2;
      }
    }
    for (let i = 0; i < U; i++) {
      if (slotOf[i] < 0) continue;
      cost += slotStatic[i][slotOf[i]];
      if (roomOf[i] >= 0) cost += roomStatic[i][roomOf[i]];
    }
    for (let g = 0; g < groups.length; g++) cost += groupCost(g);
    for (let m = 0; m < M; m++) cost += mixCost(m);
    for (let r = 0; r < R; r++) if (balanced[r]) cost += W.roomBalance * roomWeek[r] * roomWeek[r];
    for (let k = 0; k < K; k++) cost += middayOver(k);
    for (let g = 0; g < levelCoverList.length; g++) cost += levelCost(g);
    return cost;
  }

  // ---- annealing ---------------------------------------------------------
  const deadline = Date.now() + timeLimitMs;
  let best = null;
  let bestCost = Infinity;
  let runs = 0;

  for (let run = 0; run < restarts && adjustable.length > 0; run++) {
    runs++;
    let cost = construct();
    let runBest = cost;
    let runBestSlots = Int32Array.from(slotOf);
    let runBestRooms = Int32Array.from(roomOf);
    const T0 = 200;
    const T1 = 0.5;
    const cooling = Math.pow(T1 / T0, 1 / iterations);
    let temp = T0;

    for (let it = 0; it < iterations; it++) {
      if ((it & 1023) === 0 && Date.now() > deadline) break;
      temp *= cooling;

      const u = adjustable[Math.floor(rand() * adjustable.length)];
      // A locked class only ever changes room
      const kind = roomOpen[u] ? 0.7 : rand();
      let list = null;

      const blockKind = groups[slotGroupOf[u]].kind;
      // An elective option only ever changes slot as a whole
      if ((kind < 0.45 && blockKind === "together") || (kind < 0.65 && blockKind === "same")) {
        // Move the whole group to another slot
        const s = randomSlot();
        list = groups[slotGroupOf[u]].members.filter((m) => fixedSlot[m] < 0).map((m) => [m, s]);
      } else if (kind < 0.65) {
        list = [[u, randomSlot()]];
      } else if (kind < 0.8) {
        // Another room, taking room-sharing siblings in the same slot along
        if (R > 1) {
          const s = slotOf[u];
          let r = Math.floor(rand() * R);
          // Half the time, a room the course already uses
          const base = courseRoomBase[u];
          if (base >= 0 && rand() < 0.5) {
            const usedRooms = [];
            for (let x = 0; x < R; x++) if (x !== roomOf[u] && courseRoomCount[base + x] > 0) usedRooms.push(x);
            if (usedRooms.length) r = usedRooms[Math.floor(rand() * usedRooms.length)];
          }
          list = [[u, s, r]];
          for (const v of roomSiblings[u]) {
            if (slotOf[v] === s && (fixedSlot[v] < 0 || roomOpen[v])) list.push([v, s, r]);
          }
        }
      } else {
        const v = movable[Math.floor(rand() * movable.length)];
        if (v !== u && slotOf[v] !== slotOf[u]) {
          list = [
            [u, slotOf[v], roomOf[v]],
            [v, slotOf[u], roomOf[u]],
          ];
        }
      }

      if (!list || list.length === 0) continue;
      const { d, undo } = moveUnits(list);

      if (d <= 0 || rand() < Math.exp(-d / temp)) {
        cost += d;
        if (cost < runBest - 1e-9) {
          runBest = cost;
          runBestSlots = Int32Array.from(slotOf);
          runBestRooms = Int32Array.from(roomOf);
        }
      } else {
        undoMove(undo);
      }
    }

    if (runBest < bestCost) {
      bestCost = runBest;
      best = { slots: runBestSlots, rooms: runBestRooms };
    }
  }

  // ---- load the best routine and describe it -----------------------------
  resetState(best ? best.rooms : null);
  if (best) {
    for (let i = 0; i < U; i++) {
      if (fixedSlot[i] >= 0) continue;
      place(i, best.slots[i], best.rooms[i]);
    }
  }
  const score = best ? totalCost() : 0;

  return {
    seed,
    effort,
    runs,
    score: Math.round(score * 100) / 100,
    // Running total kept during the search; equals `score` when the
    // incremental accounting is right (checked by the tests).
    trackedScore: best ? Math.round(bestCost * 100) / 100 : 0,
    assignments: units.map((u, i) => ({
      unit: u,
      slot: slotOf[i],
      room: roomOf[i],
    })),
    report: describe(),
  };

  function describe() {
    const label = (i) => units[i].label;
    const slotName = (s) => `${slots[s].day} ${slots[s].time}:00`;
    const conflicts = [];
    const warnings = [];

    // Classes of different occupants in one room at once
    for (let s = 0; s < S; s++) {
      for (let r = 0; r < R; r++) {
        if (roomOcc[s * R + r] < 2) continue;
        const here = [];
        for (let i = 0; i < U; i++) if (slotOf[i] === s && roomOf[i] === r) here.push(label(i));
        conflicts.push(`${here.join(" and ")} are all in ${rooms[r].room} on ${slotName(s)}`);
      }
    }
    // A section with two classes at once
    let sectionClashes = 0;
    const seenSection = new Set();
    for (let i = 0; i < U; i++) {
      for (let j = i + 1; j < U; j++) {
        if (slotOf[i] < 0 || slotOf[i] !== slotOf[j]) continue;
        const shared = units[i].coverKeys.find((k) => units[j].coverKeys.includes(k));
        if (!shared) continue;
        const key = `${slotOf[i]}|${label(i)}|${label(j)}`;
        if (seenSection.has(key)) continue;
        seenSection.add(key);
        sectionClashes++;
        conflicts.push(`${label(i)} and ${label(j)} share a section and are both on ${slotName(slotOf[i])}`);
      }
    }
    // A teacher in two classes at once
    for (let s = 0; s < S; s++) {
      for (const [teacher, t] of teacherIndex) {
        if (teacherOcc[s * T + t] < 2) continue;
        const here = [];
        for (let i = 0; i < U; i++) if (slotOf[i] === s && teach[i].includes(t)) here.push(label(i));
        conflicts.push(`${teacher} teaches ${here.join(" and ")} at the same time on ${slotName(s)}`);
      }
    }
    // Too many subsections of one course in a slot
    for (let s = 0; s < S; s++) {
      for (let c = 0; c < C; c++) {
        if (overLimit(c, courseOcc[s * C + c]) <= 0) continue;
        const here = [];
        for (let i = 0; i < U; i++) if (slotOf[i] === s && course[i] === c) here.push(label(i));
        conflicts.push(
          `${here.join(", ")} are all on ${slotName(s)}; at most ${courseLimit[c]} subsections of a course may share a slot`
        );
      }
    }
    // Blocked slots and rooms
    let morningCount = 0;
    let labTypeMismatches = 0;
    const byTime = {};
    for (let i = 0; i < U; i++) {
      const s = slotOf[i];
      const r = roomOf[i];
      if (s < 0) continue;
      if (units[i].blocked && units[i].blocked[s]) {
        if (units[i].clashSlots && units[i].clashSlots[s]) sectionClashes++;
        conflicts.push(`${label(i)} on ${slotName(s)}: ${units[i].blocked[s]}`);
      }
      if (slots[s].isMorning) morningCount++;
      byTime[slots[s].time] = (byTime[slots[s].time] || 0) + 1;
      if (r >= 0 && roomStatic[i][r] >= W.hard) {
        const allowed = units[i].allowedRooms;
        conflicts.push(
          allowed && allowed.length
            ? `${label(i)} is in ${rooms[r].room}, not one of its rooms (${allowed.join(", ")})`
            : `${label(i)} is in ${rooms[r].room}, which is kept for other courses`
        );
      } else if (r >= 0 && roomStatic[i][r] >= W.labType) {
        labTypeMismatches++;
        warnings.push(
          `${label(i)} (${units[i].lab_type === "HW" ? "hardware" : "software"} lab) is in ${rooms[r].room}`
        );
      }
      if (r < 0 && R > 0) conflicts.push(`${label(i)} has no room`);
    }
    // Grouping rules kept or broken
    let subsectionGroups = 0;
    let subsectionGroupsOk = 0;
    let spreadTotal = 0;
    let spreadCourses = 0;
    let roomCourses = 0;
    let roomCoursesFewest = 0;
    groups.forEach((g, id) => {
      if (g.kind !== "rooms" || g.members.length < 2) return;
      roomCourses++;
      if (groupCost(id) === 0) roomCoursesFewest++;
    });
    for (const { kind, members } of groups) {
      if (members.length < 2 || kind === "rooms") continue;
      if (kind === "days") {
        const ds = members.map((m) => slotDay[slotOf[m]]);
        const spread = Math.max(...ds) - Math.min(...ds);
        spreadTotal += spread;
        spreadCourses++;
        if (spread >= 3) {
          const first = members.find((m) => slotDay[slotOf[m]] === Math.min(...ds));
          const last = members.find((m) => slotDay[slotOf[m]] === Math.max(...ds));
          warnings.push(
            `${units[first].course_id} sections are ${spread} days apart (${slots[slotOf[first]].day} to ${slots[slotOf[last]].day})`
          );
        }
        continue;
      }
      subsectionGroups++;
      const where = members
        .map((m) => `${label(m)} on ${slotName(slotOf[m])}${kind === "room" && roomOf[m] >= 0 ? ` in ${rooms[roomOf[m]].room}` : ""}`)
        .join(", ");
      const slotsUsed = new Set(members.map((m) => slotOf[m]));
      const cellsUsed = new Set(members.map((m) => slotOf[m] * RR + roomOf[m]));
      if (kind === "apart") {
        if (slotsUsed.size === members.length) subsectionGroupsOk++;
        else warnings.push(`${where} should be in different slots (one-section non-departmental course)`);
      } else if (kind === "room") {
        if (cellsUsed.size === 1) subsectionGroupsOk++;
        else warnings.push(`${where} should share one room`);
      } else if (slotsUsed.size === 1) {
        subsectionGroupsOk++;
      } else if (kind === "same") {
        conflicts.push(`${where} are one elective option but not in the same slot`);
      } else {
        warnings.push(`${where} are not in the same slot`);
      }
    }
    // Course preferences not met
    const outsidePreferred = new Map();
    for (let i = 0; i < U; i++) {
      if (slotOf[i] < 0 || !units[i].preferred || units[i].preferred[slotOf[i]]) continue;
      const key = units[i].course_id || units[i].courseKey;
      outsidePreferred.set(key, [...(outsidePreferred.get(key) || []), label(i)]);
    }
    for (const [c, labels] of outsidePreferred) {
      warnings.push(`${labels.join(", ")} ${labels.length === 1 ? "is" : "are"} not on ${c}'s preferred days`);
    }
    let apartBroken = 0;
    const courseName = [...courseIndex.keys()];
    for (let s = 0; s < S; s++) {
      for (const [a, b] of apartList) {
        if (courseOcc[s * C + a] > 0 && courseOcc[s * C + b] > 0) {
          apartBroken++;
          warnings.push(`${courseName[a]} and ${courseName[b]} are both on ${slotName(s)}`);
        }
      }
    }
    // Sections with too many midday labs
    let sectionsOverMidday = 0;
    for (const [key, k] of coverIndex) {
      if (coverMidday[k] <= middayLimit) continue;
      sectionsOverMidday++;
      warnings.push(`${key.split("|").slice(-1)[0]} (${key.split("|")[0]} batch ${key.split("|")[1]}) has ${coverMidday[k]} labs at 11 AM; at most ${middayLimit} leave room for theory`);
    }
    // Sections with every lab at one time
    let lopsidedSections = 0;
    for (const [key, k] of coverIndex) {
      if (coverTotal[k] < 2 || (coverMidday[k] > 0 && coverMidday[k] < coverTotal[k])) continue;
      lopsidedSections++;
      warnings.push(`${key.split("|").slice(-1)[0]} (${key.split("|")[0]} batch ${key.split("|")[1]}) has all ${coverTotal[k]} labs at ${coverMidday[k] ? "11 AM" : "2 PM"}`);
    }
    const full = slots.filter((_, s) => roomsUsed[s] > roomTarget);
    if (full.length > 0) {
      warnings.push(
        `No lab is left free on ${full.map((sl) => `${sl.day} ${sl.time}:00`).join(", ")}`
      );
    }

    const roomUsage = slots.map((slot, s) => {
      const used = new Set();
      for (let i = 0; i < U; i++) if (slotOf[i] === s && roomOf[i] >= 0) used.add(roomOf[i]);
      return {
        day: slot.day,
        time: slot.time,
        classes: slotCount[s],
        roomsUsed: used.size,
        freeRooms: rooms.filter((r, idx) => !r.restricted && !used.has(idx)).map((r) => r.room),
      };
    });

    return {
      conflicts,
      warnings,
      stats: {
        classes: U,
        locked: U - movable.length,
        conflicts: conflicts.length,
        sectionClashes,
        byTime,
        sectionsOverMidday,
        outsidePreferred: [...outsidePreferred.values()].reduce((n, l) => n + l.length, 0),
        apartBroken,
        lopsidedSections,
        roomCourses,
        classesPerRoom: Object.fromEntries(rooms.map((r, i) => [r.room, roomWeek[i]]).filter((_, i) => balanced[i])),
        roomCoursesFewest,
        averageDaySpread: spreadCourses ? Math.round((spreadTotal / spreadCourses) * 10) / 10 : 0,
        fullSlots: slots.filter((_, s) => roomsUsed[s] > roomTarget).length,
        subsectionGroups,
        subsectionGroupsOk,
        labTypeMismatches,
        morningCount,
        labRooms: rooms.filter((r) => !r.restricted).length,
      },
      roomUsage,
    };
  }
}
