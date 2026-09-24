import test from 'node:test';
import assert from 'node:assert/strict';
import { connect } from '../config/database.js';
import { setTeacherSessionalAssignmentDB } from './repository.js';

// Opt-in PostgreSQL check. Every table used by the repository is shadowed by
// a connection-local temporary table; no actual teacher or schedule is changed.
test('PostgreSQL saves half shares, permits thesis overlaps, and rejects other lab conflicts',
  { skip: process.env.RUN_SESSIONAL_DB_TESTS !== '1' }, async () => {
    const client = await connect();
    try {
      await client.query(`
        CREATE TEMP TABLE configs (key text, value text);
        CREATE TEMP TABLE teachers (initial varchar PRIMARY KEY);
        CREATE TEMP TABLE courses (course_id varchar, session varchar, type integer);
        CREATE TEMP TABLE courses_sections (course_id varchar, session varchar, batch integer,
          section varchar, department varchar, teachers varchar[]);
        CREATE TEMP TABLE schedule_assignment (course_id varchar, session varchar, batch integer,
          section varchar, department varchar, day varchar, time integer, teachers varchar[]);
        CREATE TEMP TABLE teacher_sessional_assignment (initial varchar, course_id varchar,
          session varchar, batch integer, section varchar, share numeric(3,2),
          PRIMARY KEY (initial, course_id, session, batch, section));
        INSERT INTO configs VALUES ('CURRENT_SESSION', 'TEST'), ('times', '[8,9,10,11,12,1,2,3,4]');
        INSERT INTO teachers VALUES ('T1');
        INSERT INTO courses VALUES ('CSE105', 'TEST', 0), ('CSE106', 'TEST', 1), ('CSE400', 'TEST', 2);
        INSERT INTO schedule_assignment VALUES
          ('CSE106', 'TEST', 25, 'A1', 'CSE', 'Tuesday', 11, NULL),
          ('CSE105', 'TEST', 25, 'B', 'CSE', 'Tuesday', 12, ARRAY['T1']),
          ('CSE400', 'TEST', 25, 'A', 'CSE', 'Tuesday', 11, ARRAY['T1']),
          ('CSE106', 'OLD', 25, 'A1', 'CSE', 'Tuesday', 11, ARRAY[]::varchar[]);
      `);
      const getClient = async () => ({ query: client.query.bind(client), release() {} });
      const assignment = { initial: 'T1', course_id: 'CSE106', batch: 25, section: 'A1', share: 0.5 };
      const save = (share) => setTeacherSessionalAssignmentDB({ ...assignment, share }, getClient);
      await save(0.5);
      await save(0.5);
      assert.deepEqual((await client.query('SELECT share::float FROM teacher_sessional_assignment')).rows, [{ share: 0.5 }]);
      assert.deepEqual((await client.query("SELECT teachers FROM schedule_assignment WHERE course_id='CSE106' AND session='TEST'")).rows[0].teachers, ['T1']);
      assert.deepEqual((await client.query("SELECT teachers FROM schedule_assignment WHERE session='OLD'")).rows[0].teachers, []);
      await assert.rejects(save(1), /Theory class CSE105/);
      assert.equal((await client.query('SELECT share::float FROM teacher_sessional_assignment')).rows[0].share, 0.5);
      // Remove only the temporary theory fixture; thesis remains at the same time.
      await client.query("DELETE FROM pg_temp.schedule_assignment WHERE course_id='CSE105'");
      await save(1);
      assert.equal((await client.query('SELECT share::float FROM teacher_sessional_assignment')).rows[0].share, 1);
      await client.query(`INSERT INTO teacher_sessional_assignment VALUES ('T1','CSE108','TEST',25,'B1',1);
        INSERT INTO schedule_assignment VALUES ('CSE108','TEST',25,'B1','CSE','Tuesday',11,ARRAY['T1']);`);
      await assert.rejects(save(0.5), /Already assigned to CSE108/);
    } finally {
      client.release(true); // Close this connection and automatically discard its temporary tables.
    }
  });
