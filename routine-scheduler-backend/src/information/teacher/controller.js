
import { getAll, removeTeacher, saveTeacher, updateTeacher,findByInitial } from "./repository.js";


export async function getAllTeacher(req, res, next) {
    try {
        const teachers = await getAll();
        res.status(200).json(teachers);
    } catch(err) {
        next(err)
    }
}

export async function getTeacher(req,res,next){
    const initial = req.params['initial']
    try{
        const teacher = await findByInitial(initial);
        res.status(200).json(teacher);

    } catch(err) {
        next(err)

    }
}

export async function addTeacher(req, res, next) {

    //initial, name,surname,email,seniority_rank,active,theory_courses, sessional_courses
    const initial = req.body.initial
    const name = req.body.name
    const surname = req.body.surname
    const email = req.body.email
    const seniority_rank = req.body.seniority_rank
    const active = req.body.active
    const theory_courses = req.body.theory_courses
    const sessional_courses = req.body.sessional_courses
    const designation = req.body.designation
    const full_time_status = req.body.full_time_status
    const offers_thesis_1 = req.body.offers_thesis_1
    const offers_thesis_2 = req.body.offers_thesis_2
    const offers_msc = req.body.offers_msc
    const teacher_credits_offered = req.body.teacher_credits_offered 

    const teacher = {
        initial: initial,
        name: name,
        surname: surname,
        email: email,
        seniority_rank: seniority_rank,
        active: active,
        theory_courses: theory_courses,
        sessional_courses: sessional_courses,
        designation: designation,
        full_time_status: full_time_status,
        offers_thesis_1: offers_thesis_1,
        offers_thesis_2: offers_thesis_2,
        offers_msc: offers_msc,
        teacher_credits_offered: teacher_credits_offered
    }

    try {
        const rowCount = await saveTeacher(teacher);
        res.status(200).json({message: "success"});

    } catch(err) {
        next(err)
    }

}


export async function editTeacher(req, res, next) {
    const initial = req.params['initial']
    
    const name = req.body.name
    const surname = req.body.surname
    const email = req.body.email
    const seniority_rank = req.body.seniority_rank
    const active = req.body.active
    const theory_courses = req.body.theory_courses
    const sessional_courses = req.body.sessional_courses
    const designation = req.body.designation
    const full_time_status = req.body.full_time_status
    const offers_thesis_1 = req.body.offers_thesis_1
    const offers_thesis_2 = req.body.offers_thesis_2
    const offers_msc = req.body.offers_msc
    const teacher_credits_offered = req.body.teacher_credits_offered 
    
    const teacher = {
        initial: initial,
        name: name,
        surname: surname,
        email: email,
        seniority_rank: seniority_rank,
        active: active,
        theory_courses: theory_courses,
        sessional_courses: sessional_courses,
        designation: designation,
        full_time_status: full_time_status,
        offers_thesis_1: offers_thesis_1,
        offers_thesis_2: offers_thesis_2,
        offers_msc: offers_msc,
        teacher_credits_offered: teacher_credits_offered
    }
    
    
    try{
        const rowCount = await updateTeacher(teacher)
        res.status(200).json({ teacher:teacher })

    }catch(err) {
        next(err)
    }

}

export async function deleteTeacher(req, res, next) {
    const initial = req.params['initial']
    try{
        const rowCount = await removeTeacher(initial)
        res.status(200).json({ row:rowCount })

    }catch(err) {
        next(err)
    }
}