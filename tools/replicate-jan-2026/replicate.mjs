#!/usr/bin/env node
/*
 * Rebuilds the January 2026 routine of the Department of CSE in the routine
 * scheduler, through its API, the way it is done by hand in the app:
 * session, teachers, rooms, courses, level-terms, electives, teachers of each
 * course, the theory routine, labs and the sessional distribution. Then it
 * downloads every routine book the app prints.
 *
 * Start from a fresh database (init.sql) with the backend running:
 *
 *   node tools/replicate-jan-2026/replicate.mjs --api http://localhost:4200/v1 \
 *        --username admin --password <password> --out ./jan-2026-pdfs
 *
 * (--token <jwt> can stand in for the username and password.)
 *
 * data.json holds the term as the department's routine workbook
 * (Routine_January_2026_v1.0.xlsm) has it.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, a, i, all) => {
    if (a.startsWith("--")) pairs.push([a.slice(2), all[i + 1]]);
    return pairs;
  }, [])
);
const API = (args.api || process.env.ROUTINE_API || "http://localhost:4200/v1").replace(/\/$/, "");
const OUT = args.out || path.join(process.cwd(), "jan-2026-pdfs");
const data = JSON.parse(fs.readFileSync(args.data || path.join(here, "data.json"), "utf8"));

let token = args.token || process.env.ROUTINE_TOKEN;
const problems = [];

async function call(method, route, body, { raw = false } = {}) {
  const res = await fetch(API + route, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${route} -> ${res.status} ${text.slice(0, 300)}`);
  }
  if (raw) return res;
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Carries on after a failed step, and lists the failures at the end
async function attempt(what, fn) {
  try {
    return await fn();
  } catch (err) {
    problems.push(`${what}: ${err.message}`);
    return null;
  }
}

const step = (title) => console.log(`\n== ${title}`);
const enc = encodeURIComponent;

/* --------------------------------------------------------------- 0. login */

if (!token) {
  if (!args.username || !args.password) {
    console.error("Pass --username and --password (or --token).");
    process.exit(1);
  }
  const login = await call("POST", "/auth/login", { username: args.username, password: args.password });
  token = login.token;
}

/* ------------------------------------------------------------ 1. session */

step(`Session ${data.session}`);
await call("POST", "/config/CURRENT_SESSION", { value: data.session });
await call("POST", "/config/ALL_SESSIONS", { value: JSON.stringify([data.session]) });

/* ----------------------------------------------------------- 2. teachers */

step("Teachers");
const existingTeachers = new Map((await call("GET", "/teacher")).map((t) => [t.initial, t]));
const inTerm = new Set(data.teachers.map((t) => t.initial));
for (const [i, t] of data.teachers.entries()) {
  const old = existingTeachers.get(t.initial);
  const body = {
    initial: t.initial,
    name: t.name,
    surname: t.nickname,
    email: old?.email || "routine.scheduler.buet@gmail.com",
    seniority_rank: i + 1,
    active: "1",
    theory_courses: old?.theory_courses ?? 1,
    sessional_courses: old?.sessional_courses ?? 1,
    designation: t.designation || old?.designation || (t.full_time ? "Lecturer" : "Adjunct Lecturer"),
    full_time_status: t.full_time,
    offers_thesis_1: t.thesis_1,
    offers_thesis_2: false,
    offers_msc: t.msc,
    // The load the term's Course Load workbook gave (HoD 12, study leave 0, …)
    teacher_credits_offered: t.load ?? old?.teacher_credits_offered ?? 21,
  };
  await attempt(`teacher ${t.initial}`, () =>
    old ? call("PUT", `/teacher/${enc(t.initial)}`, body) : call("POST", "/teacher", body)
  );
}
// Teachers who were not in the department that term take no part in it
for (const [initial, t] of existingTeachers) {
  if (inTerm.has(initial)) continue;
  await attempt(`retire ${initial}`, () =>
    call("PUT", `/teacher/${enc(initial)}`, { ...t, active: "0", offers_thesis_1: false, offers_thesis_2: false })
  );
}
await call("PUT", "/teacher/seniority", {
  initials: [...data.teachers.map((t) => t.initial), ...[...existingTeachers.keys()].filter((i) => !inTerm.has(i))],
});
console.log(`${data.teachers.length} teachers, ${data.teachers.filter((t) => !t.full_time).length} part-time`);

/* -------------------------------------------------------------- 3. rooms */

step("Rooms");
const existingRooms = new Map((await call("GET", "/room")).map((r) => [r.room, r]));
for (const [i, r] of data.rooms.entries()) {
  const old = existingRooms.get(r.room);
  // A room of another department keeps its lab/theory kind; ours may serve both
  const type = old && !r.external ? (old.type === r.type ? r.type : 2) : r.type;
  const body = {
    room: r.room,
    type,
    active: true,
    lab_type: type === 0 ? null : old?.lab_type || null,
    room_number: old?.room_number || null,
    full_name: old?.full_name || null,
  };
  await attempt(`room ${r.room}`, () =>
    old ? call("PUT", `/room/${enc(r.room)}`, body) : call("POST", "/room", body)
  );
}
console.log(`${data.rooms.length} rooms`);

/* ------------------------------------------------------------ 4. courses */

step("Course catalogue");
const catalogue = await call("GET", "/course");
const inCatalogue = (id, lt) => catalogue.some((c) => c.course_id === id && c.level_term === lt);
for (const c of data.new_courses) {
  if (inCatalogue(c.course_id, c.level_term)) continue;
  await attempt(`add ${c.course_id}`, () => call("POST", "/course", { ...c, optional: 0 }));
  console.log(`added ${c.course_id} (${c.to} ${c.level_term})`);
}
for (const c of data.retired_courses) {
  if (!inCatalogue(c.course_id, c.level_term)) continue;
  await attempt(`remove ${c.course_id}`, () =>
    call("DELETE", `/course/${enc(c.course_id)}?level_term=${enc(c.level_term)}`)
  );
  console.log(`removed ${c.course_id} (not offered that term)`);
}
/* -------------------------------------------------------- 5. level-terms */

step("Level-terms");
const listLevelTerms = async () => (await call("GET", "/level_terms")).data;
let levelTerms = await listLevelTerms();
for (const lt of data.level_terms) {
  if (!levelTerms.some((x) => x.department === lt.department && x.level_term === lt.level_term)) {
    await call("POST", "/level_terms/add", { level_term: lt.level_term, department: lt.department });
    console.log(`added ${lt.department} ${lt.level_term}`);
  }
}
levelTerms = await listLevelTerms();
const batchOf = new Map(data.level_terms.map((lt) => [`${lt.department}|${lt.level_term}`, lt.batch]));
await call(
  "PUT",
  "/level_terms/set",
  levelTerms.map((lt) => {
    const batch = batchOf.get(`${lt.department}|${lt.level_term}`);
    return { ...lt, active: batch !== undefined, batch: batch ?? lt.batch };
  })
);
console.log(data.level_terms.map((lt) => `${lt.department} ${lt.level_term} (${lt.batch})`).join(", "));

// Electives offered, in their options (Optional Courses page): each option's
// three courses run side by side in one slot for all sections
step("Optional courses");
for (const [levelTerm, options] of Object.entries(data.electives)) {
  const courses = Object.entries(options).flatMap(([option, ids]) =>
    ids.map((course_id) => ({ course_id, offered: true, option_group: Number(option) }))
  );
  await attempt(`electives of ${levelTerm}`, () =>
    call("PUT", "/course/optional", { level_term: levelTerm, department: "CSE", courses })
  );
  for (const [option, ids] of Object.entries(options)) console.log(`${levelTerm} Option ${option}: ${ids.join(", ")}`);
}

/* --------------------------------------------------------- 6. who teaches */

step("Theory teachers");
const courseInfo = new Map(
  [...data.courses, ...data.new_courses].map((c) => [c.course_id, c])
);
for (const tt of data.theory_teachers) {
  for (const section of tt.sections) {
    for (const initial of tt.teachers) {
      await attempt(`${tt.course_id}(${section}) ${initial}`, () =>
        call("POST", "/assign/theory-teacher/add", { course_id: tt.course_id, section, initial })
      );
    }
  }
}
console.log(`${data.theory_teachers.length} course sections`);

/* ----------------------------------------------------- 7. theory routine */

step("Theory routine");
const batchFor = (department, levelTerm) => batchOf.get(`${department}|${levelTerm}`);
// Each section's usual room: the one most of its classes are in
const roomVotes = new Map();
for (const e of data.theory) {
  if (e.course_id === "CT" || e.all_sections || !e.room) continue;
  const k = `${e.department}|${e.level_term}|${e.section}`;
  if (!roomVotes.has(k)) roomVotes.set(k, new Map());
  roomVotes.get(k).set(e.room, (roomVotes.get(k).get(e.room) || 0) + 1);
}
const sectionRoom = new Map();
for (const [k, votes] of roomVotes) {
  const [room] = [...votes].sort((a, b) => b[1] - a[1])[0];
  sectionRoom.set(k, room);
  const [department, level_term, section] = k.split("|");
  await attempt(`room of ${k}`, () =>
    call("PUT", "/theory_room_assignment/section/update", { level_term, department, section, room_no: room })
  );
}

const cells = new Map();
for (const e of data.theory) {
  const k = `${e.department}|${e.level_term}|${e.section}|${e.day}|${e.time}`;
  if (!cells.has(k)) cells.set(k, []);
  cells.get(k).push(e.course_id);
}
for (const [k, course_ids] of cells) {
  const [department, levelTerm, section, day, time] = k.split("|");
  await attempt(`theory ${k}`, () =>
    call("PUT", "/schedule/theory/cell", {
      department,
      batch: batchFor(department, levelTerm),
      section,
      day,
      time: Number(time),
      course_ids,
    })
  );
}
let moved = 0;
for (const e of data.theory) {
  if (e.course_id === "CT") continue;
  const usual = sectionRoom.get(`${e.department}|${e.level_term}|${e.section}`);
  if (e.room === usual) continue;
  moved++;
  await attempt(`room ${e.course_id}(${e.section}) ${e.day} ${e.time}`, () =>
    call("POST", "/theory_room_assignment/update", {
      course_id: e.course_id,
      section: e.section,
      day: e.day,
      time: e.time,
      room_no: e.room,
    })
  );
}
console.log(`${cells.size} periods, ${moved} classes away from their section's room`);

/* -------------------------------------------------------------- 8. labs */

step("Labs");
for (const e of data.labs) {
  const batch = batchFor(e.department, e.level_term);
  const ok = await attempt(`lab ${e.course_id}(${e.section}) ${e.day} ${e.time}`, () =>
    call("POST", `/schedule/sessional/${batch}/${enc(e.section)}/${enc(e.department)}`, {
      course_id: e.course_id,
      day: e.day,
      time: e.time,
      add: true,
    })
  );
  if (ok === null || !e.room) continue;
  // CSE labs get their rooms in the sessional distribution; other
  // departments' labs on the non-departmental lab room page
  await attempt(`lab room ${e.course_id}(${e.section})`, () =>
    e.course_id.startsWith("CSE")
      ? call("PUT", "/sessional-scheduler/room", {
          course_id: e.course_id,
          batch,
          section: e.section,
          department: e.department,
          room: e.room,
        })
      : call("PUT", "/theory_room_assignment/non-departmental/update", {
          course_id: e.course_id,
          section: e.section,
          room_no: e.room,
        })
  );
}
console.log(`${data.labs.length} labs`);

step("Lab teachers");
for (const st of data.sessional_teachers) {
  const c = courseInfo.get(st.course_id);
  const batch = batchFor(c.to, c.level_term);
  // two teachers in a slot share it
  for (const slot of st.slots) {
    for (const initial of slot) {
      await attempt(`${st.course_id}(${st.section}) ${initial}`, () =>
        call("PUT", "/assign/sessional/set", {
          initial,
          course_id: st.course_id,
          batch,
          section: st.section,
          share: slot.length > 1 ? 0.5 : 1,
        })
      );
    }
  }
}
console.log(`${data.sessional_teachers.length} lab sections`);

/* -------------------------------------------------------------- 9. books */

step(`Routine books -> ${OUT}`);
fs.mkdirSync(OUT, { recursive: true });
for (const kind of [
  "levelTerm",
  "teacher",
  "partTimeTeacher",
  "room",
  "department",
  "sessionalDistribution",
  "courseTeacher",
  "courseLoad",
]) {
  await attempt(`book ${kind}`, async () => {
    const res = await call("GET", `/pdf/book/${kind}`, undefined, { raw: true });
    const name = (/filename="([^"]+)"/.exec(res.headers.get("content-disposition") || "") || [])[1] || `${kind}.pdf`;
    fs.writeFileSync(path.join(OUT, name), Buffer.from(await res.arrayBuffer()));
    console.log(name);
  });
}

if (problems.length) {
  console.log(`\n${problems.length} step(s) failed:`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exitCode = 1;
} else {
  console.log("\nDone: the routine is in the app and its books are saved.");
}
