import { resend } from "../config/mail.js";
import { v4 as uuidv4 } from "uuid";
import {
  getScheduleConfigs,
  getTheorySchedule,
  setTheorySchedule,
  getTheoryScheduleForms,
  getTheoryScheduleTeachers,
  nextInSeniority,
  getSessionalSchedule,
  getDepartmentalSessionalSchedule,
  setSessionalSchedule,
  getAllScheduleDB,
  getCourseAllSchedule,
  getCourseSectionalSchedule,
  teacherContradictionDB,
  ensureEmailTemplateExists,
} from "./repository.js";
import { createForm, getTemplate } from "../assignment/repository.js";
import { HttpError } from "../config/error-handle.js";

/**
 * Get schedule configuration values
 */
export async function getScheduleConfigValues(req, res, next) {
  try {
    const configs = await getScheduleConfigs();
    res.json({ success: true, data: configs });
  } catch (err) {
    next(err);
  }
}

async function sendMail(initial, email, template, token) {
  var url = process.env.URL || "http://localhost:3000";
  url = url + "/form/theory-sched/" + token;
  const msg =
    "<p>" + template + "</p>" +
    "<h2> For " + initial + ":</h2><br>" + " <h1>Please fill up this form</h1>  <a href=' " +
    url +
    " ' > " +
    url +
    "</a>";
  const info = await resend.emails.send({
    from: 'Routine_Scheduler <onboarding@resend.dev>',
    to: email,
    subject: "Theory Schedule Form",
    html: msg,
  });
  return info;
}

export async function setTheoryScheduleAPI(req, res, next) {
  try {
    let { batch, section, course } = req.params;
    batch = parseInt(batch);
    const schedule = req.body;
    const ok = await setTheorySchedule(batch, section, course, schedule);
    if (ok) res.status(200).json({ msg: "successfully send", body: schedule });
    else throw new HttpError(400, "Insert Failed");
  } catch (e) {
    next(e);
  }
}

export async function getTheoryScheduleAPI(req, res, next) {
  try {
    let { department, batch, section } = req.params;
    batch = parseInt(batch);

    const result = await getTheorySchedule(department, batch, section);

    res.status(200).json(result);
  } catch (e) {
    next(e);
  }
}

export async function getSessionalScheduleAPI(req, res, next) {
  try {
    let { batch, section } = req.params;
    batch = parseInt(batch);
    const result = await getSessionalSchedule(batch, section);
    res.status(200).json(result);
  } catch (e) {
    next(e);
  }
}

export async function getDepartmentalSessionalScheduleAPI(req, res, next) {
  try {
    const result = await getDepartmentalSessionalSchedule();
    res.status(200).json(result);
  } catch (e) {
    next(e);
  }
}

export async function setSessionalScheduleAPI(req, res, next) {
  try {
    let { batch, section, department } = req.params;
    console.log(req.params);
    batch = parseInt(batch);
    const schedule = req.body;
    console.log("Setting sessional schedule:", batch, section, department, schedule);
    const ok = await setSessionalSchedule(batch, section, department, schedule);
    if (ok) res.status(200).json({ msg: "successfully send", body: schedule });
    else throw new HttpError(400, "Insert Failed");
  } catch (e) {
    next(e);
  }
}

export async function sendTheorySchedNextMail(batch, next) {
  try {
    // First ensure the template exists
    await ensureEmailTemplateExists("SCHEDULE_EMAIL");
    
    // Now get the template
    const msgBody = await getTemplate("SCHEDULE_EMAIL");
    if (msgBody && msgBody.length > 0 && msgBody[0].value) {
      const teachers = await nextInSeniority();
      for (const teacher of teachers.filter((t) => t.batch === batch)) {
        await sendMail(teacher.initial, teacher.email, msgBody[0].value, teacher.id);
      } 
    } else {
      // Handle case where the template exists but has no value
      const error = new HttpError(400, "Template not found or empty");
      if (next) next(error);
      else throw error;
    }
  } catch (err) {
    console.error("Error in sendTheorySchedNextMail:", err);
    if (next) next(err);
    else throw err;
  }
}

export async function initiate(req, res, next) {
  try {    
    // Get the list of teachers
    const teachers = await getTheoryScheduleTeachers();
    
    if (!teachers || teachers.length === 0) {
      return res.status(200).json({ msg: "No teachers found to send email" });
    }
    
    const batches = new Set();
    
    // Create forms for each teacher
    for (const teacher of teachers) {
      const id = uuidv4();
      await createForm(id, teacher.initial, "theory-sched");
      batches.add(teacher.batch);
    }

    // Process all batches without passing next to sendTheorySchedNextMail
    // This prevents early response sending
    let errors = [];
    for (const batch of batches) {
      try {
        await sendTheorySchedNextMail(batch);
      } catch (error) {
        // Collect errors but continue processing other batches
        console.error(`Error sending mails for batch ${batch}:`, error);
        errors.push({ batch, error: error.message });
      }
    }

    // Send response with any errors that occurred
    if (errors.length > 0) {
      res.status(207).json({ 
        msg: "Some emails were sent successfully, but there were errors", 
        errors: errors 
      });
    } else {
      res.status(200).json({ msg: "successfully sent" });
    }
  } catch (error) {
    console.error("Error in initiate:", error);
    // Avoid sending headers if they've already been sent
    if (!res.headersSent) {
      next(error);
    }
  }
}

export async function getCurrStatus(req, res, next) {
  try {
    const result = await getTheoryScheduleForms();
    if (result.length === 0) {
      res.status(200).json({ status: 0 });
    } else {
      const mailed = await nextInSeniority();
      const nullResponse = result.filter((row) => row.response === null);
      const otherResponse = result.filter((row) => row.response !== null);
      const mailedObj = mailed.reduce((acc, row) => {
        acc[row.initial] = row;
        return acc;
      }, {});
      const mailedResponse = result
        .filter(
          (row) => row.response === null && mailedObj[row.initial] !== undefined
        )
        .map((row) => {
          row.batch = mailedObj[row.initial].batch;
          row.course_id = mailedObj[row.initial].course_id;
          return row;
        });
      res.status(200).json({
        status: nullResponse.length === 0 ? 2 : 1,
        values: mailedResponse,
        submitted: otherResponse,
      });
    }
  } catch (err) {
    next(err);
  }
}

export async function getAllSchedule(req, res, next) {
  try {
    const result = await getAllScheduleDB();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getCourseAllScheduleAPI(req, res, next) {
  try {
    const { initial, course_id } = req.params;
    const result = await getCourseAllSchedule(initial, course_id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getCourseSectionalScheduleAPI(req, res, next) {
  try {
    const { course_id, section } = req.params;
    const result = await getCourseSectionalSchedule(course_id, section);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function teacherContradiction(req, res, next) {
  try {
    const { batch, section, course_id } = req.params;
    const result = await teacherContradictionDB(batch, section, course_id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}