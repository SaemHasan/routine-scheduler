CREATE TABLE public."admin" (
	username varchar NOT NULL,
	email varchar NOT NULL,
	"password" varchar NOT NULL,
	CONSTRAINT admin_pk PRIMARY KEY (username),
	CONSTRAINT admin_un UNIQUE (email)
);

CREATE TABLE public.configs (
	"key" varchar NOT NULL,
	value varchar NOT NULL,
	CONSTRAINT configs_pk PRIMARY KEY (key)
);

CREATE TABLE public.sessional_types (
	code varchar NOT NULL,
	"name" varchar NOT NULL,
	-- Teachers assigned to each section of a course of this kind.
	teacher_count int4 NOT NULL,
	-- 'SW' or 'HW': the kind of lab the course runs in. NULL for presentation
	-- sessionals, which need no particular lab.
	lab_type varchar NULL,
	sort_order int4 DEFAULT 0 NOT NULL,
	CONSTRAINT sessional_types_pk PRIMARY KEY (code)
);

CREATE TABLE public.courses (
	course_id varchar NOT NULL,
	"name" varchar NOT NULL,
	-- 0 = theory, 1 = sessional, 2 = thesis (Thesis 1 in L-4 T-1, Thesis 2 in
	-- L-4 T-2). Thesis is not scheduled; supervisors come from the teachers'
	-- offers_thesis_1 / offers_thesis_2 flags.
	"type" int4 NOT NULL,
	"session" varchar NOT NULL,
	class_per_week float8 NOT NULL,
	"from" character varying DEFAULT 'CSE'::character varying NOT NULL,
    "to" character varying DEFAULT 'CSE'::character varying NOT NULL,
    teacher_credit double precision DEFAULT '9'::double precision NOT NULL,
    level_term character varying DEFAULT ''::character varying,
    optional int4 DEFAULT 0 NOT NULL,
    -- For optional courses: how many section-sized groups are needed. Students
    -- enrol from every section, so this is a capacity, not a set of sections.
    optional_section_count int4 DEFAULT 0 NOT NULL,
    -- For sessional courses: a sessional_types code, which sets how many
    -- teachers each section gets. NULL for theory courses.
    sessional_type varchar NULL,
	CONSTRAINT courses_pk PRIMARY KEY (course_id, session),
	CONSTRAINT courses_sessional_type_fk FOREIGN KEY (sessional_type) REFERENCES public.sessional_types(code) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE public.forms (
	id varchar NOT NULL,
	"type" varchar NOT NULL,
	response varchar NULL,
	initial varchar NOT NULL,
	CONSTRAINT forms_pk PRIMARY KEY (id)
);
CREATE INDEX forms_key_idx ON public.forms USING btree (id);

CREATE TABLE public.rooms (
	room varchar NOT NULL,
	-- 0 = theory, 1 = lab (sessional), 2 = used for both theory and lab
	"type" int4 NULL,
	-- 'SW' or 'HW' for lab rooms, NULL for theory rooms.
	lab_type varchar NULL,
	-- Optional full name, e.g. 'Interfacing Lab' for IL.
	full_name varchar NULL,
	-- Optional physical room number, e.g. for a lab known by its short name.
	room_number varchar NULL,
    active boolean DEFAULT true NOT NULL,
	CONSTRAINT rooms_pk PRIMARY KEY (room)
);

CREATE TABLE public.teachers (
	initial varchar NOT NULL,
	"name" varchar NOT NULL,
	surname varchar NOT NULL,
	email varchar NOT NULL,
	seniority_rank int4 NOT NULL,
	active int2 NOT NULL,
	theory_courses int4 NOT NULL,
	sessional_courses int4 NOT NULL,
	designation character varying DEFAULT 'Professor'::character varying NOT NULL,
    full_time_status boolean DEFAULT true NOT NULL,
    -- Thesis 1 is switched on for teachers whose name has "Dr." (see the
    -- UPDATE after the teacher rows); everything else starts off.
    offers_thesis_1 boolean DEFAULT false NOT NULL,
    offers_thesis_2 boolean DEFAULT false NOT NULL,
    offers_msc boolean DEFAULT false NOT NULL,
    teacher_credits_offered double precision DEFAULT '15'::double precision NOT NULL,
	CONSTRAINT teachers_pk PRIMARY KEY (initial)
);

CREATE TABLE public.level_term_unique (
    level_term character varying NOT NULL,
    department character varying NOT NULL,
    active boolean DEFAULT false NOT NULL,
    batch integer DEFAULT 0,
	CONSTRAINT level_term_unique_pkey PRIMARY KEY (level_term, department)
);

CREATE TABLE public.sections (
	batch int4 NOT NULL,
	"section" varchar NOT NULL,
	"type" int4 NOT NULL,
	room varchar NULL,
	"session" varchar NOT NULL,
	level_term varchar NOT NULL,
	department character varying DEFAULT 'CSE'::character varying NOT NULL,
	CONSTRAINT sections_pk PRIMARY KEY (department, batch, section),
	CONSTRAINT sections_department_level_term_fkey FOREIGN KEY (department, level_term) REFERENCES public.level_term_unique(department, level_term) ON DELETE CASCADE
);

CREATE TABLE public.teacher_assignment (
	course_id varchar NOT NULL,
	initial varchar NOT NULL,
	"session" varchar NOT NULL,
	CONSTRAINT teacher_assignment_pk PRIMARY KEY (course_id, initial, session),
	CONSTRAINT teacher_assignment_fk FOREIGN KEY (course_id,"session") REFERENCES public.courses(course_id,"session") ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT teacher_assignment_fk_1 FOREIGN KEY (initial) REFERENCES public.teachers(initial) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE public.courses_sections (
	course_id varchar NOT NULL,
	"session" varchar NOT NULL,
	batch int4 NOT NULL,
	"section" varchar NOT NULL,
	teachers text[] DEFAULT '{}'::text[],
    department character varying DEFAULT 'CSE'::character varying,
	CONSTRAINT courses_sections_pk PRIMARY KEY (course_id, session, batch, section),
	CONSTRAINT courses_sections_fk FOREIGN KEY (department, batch,"section") REFERENCES public.sections(department, batch,"section") ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT courses_sections_fk_c FOREIGN KEY (course_id,"session") REFERENCES public.courses(course_id,"session") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE public.schedule_assignment (
	course_id varchar NOT NULL,
	"session" varchar NOT NULL,
	batch int4 NOT NULL,
	"section" varchar NOT NULL,
	"day" varchar NOT NULL,
	"time" int4 NOT NULL,
	department character varying DEFAULT 'CSE'::character varying NOT NULL,
	room_no character varying,
	teachers text[] DEFAULT '{}'::text[],
	-- Sessional placements kept when the sessional scheduler runs again;
	-- anything placed or changed by hand is locked.
	locked boolean DEFAULT false NOT NULL,
	CONSTRAINT schedule_assignment_check CHECK (((day)::text = ANY (ARRAY[('Saturday'::character varying)::text, ('Sunday'::character varying)::text, ('Monday'::character varying)::text, ('Tuesday'::character varying)::text, ('Wednesday'::character varying)::text]))),
	CONSTRAINT schedule_assignment_pk PRIMARY KEY (department, batch, section, day, "time", course_id),
	CONSTRAINT schedule_assignment_un UNIQUE (course_id, session, batch, section, day, "time", department),
	-- This constraint is commented out to fit CT in the routine. When courses table will be modified to include "level_term", this constraint should be uncommented.
	-- CONSTRAINT schedule_assignment_fk FOREIGN KEY (course_id,"session") REFERENCES public.courses(course_id,"session"),
	CONSTRAINT schedule_assignment_fk1 FOREIGN KEY (department, batch,"section") REFERENCES public.sections(department, batch,"section") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE public.teacher_sessional_assignment (
	initial varchar NOT NULL,
	course_id varchar NOT NULL,
	"session" varchar NOT NULL,
	batch int4 NOT NULL,
	"section" varchar NOT NULL,
	-- 1 for a full lab slot, 0.5 when two teachers share one slot (each takes
	-- half the lab and half its credit).
	share numeric(3, 2) DEFAULT 1 NOT NULL,
	CONSTRAINT teacher_sessional_assignment_share_check CHECK (share IN (0.5, 1)),
	CONSTRAINT teacher_sessional_assignment_pk PRIMARY KEY (initial, course_id, session, batch, section),
	CONSTRAINT teacher_sessional_assignment_courses_sections_fk FOREIGN KEY (course_id,"session",batch,"section") REFERENCES public.courses_sections(course_id,"session",batch,"section"),
	CONSTRAINT teacher_sessional_assignment_teachers_fk FOREIGN KEY (initial) REFERENCES public.teachers(initial) ON UPDATE CASCADE
);

-- Rules the sessional scheduler must follow.
--   blocked_slot: no sessional for the matching sections on `day` (at the
--                 period `time`, or all day when it is NULL). department,
--                 level_term and section narrow it; NULL means all.
--   course_rooms: course_id may only use `rooms`.
--   course_together: for course_id, `same_slot` puts all its sections in one
--                 slot and `shared_room` has each section's subsections
--                 (A1 and A2) use one room together.
CREATE TABLE public.sessional_constraints (
	id serial NOT NULL,
	kind varchar NOT NULL,
	department varchar NULL,
	level_term varchar NULL,
	section varchar NULL,
	"day" varchar NULL,
	"time" int4 NULL,
	course_id varchar NULL,
	rooms text[] NULL,
	same_slot boolean DEFAULT false NOT NULL,
	shared_room boolean DEFAULT false NOT NULL,
	note varchar NULL,
	CONSTRAINT sessional_constraints_pkey PRIMARY KEY (id),
	CONSTRAINT sessional_constraints_kind_check CHECK (kind IN ('blocked_slot', 'course_rooms', 'course_together'))
);

CREATE TABLE public.all_courses (
	course_id varchar NOT NULL,
	"name" varchar NOT NULL,
	-- 0 = theory, 1 = sessional, 2 = thesis (see courses)
	"type" int4 NOT NULL,
	class_per_week float8 NOT NULL,
  	"from" varchar NOT NULL,
  	"to" varchar NOT NULL,
  	level_term varchar NOT NULL,
  	optional int4 DEFAULT 0 NOT NULL,
	-- For optional courses: how many section-sized groups are needed. Students
	-- enrol from every section, so this is a capacity, not a set of sections.
	optional_section_count int4 DEFAULT 0 NOT NULL,
	sessional_type varchar NULL,
	CONSTRAINT all_courses_pk PRIMARY KEY (course_id, level_term),
	CONSTRAINT all_courses_sessional_type_fk FOREIGN KEY (sessional_type) REFERENCES public.sessional_types(code) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE public.default_section_count (
	department character varying NOT NULL,
	section_count int4 NOT NULL,
	subsection_count_per_section int4 NOT NULL,
	CONSTRAINT default_section_count_pkey PRIMARY KEY (department)
);

CREATE TABLE public.section_count (
	batch int4 NOT NULL,
	department character varying NOT NULL,
	section_count int4 NOT NULL,
	subsection_count_per_section int4 NOT NULL,
	CONSTRAINT section_count_pkey PRIMARY KEY (batch, department),
	CONSTRAINT section_count_department_fkey FOREIGN KEY (department) REFERENCES public.default_section_count(department) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE public.hosted_departments (
	department character varying NOT NULL,
	CONSTRAINT hosted_department_pkey PRIMARY KEY (department)
);

INSERT INTO public."admin" (username,email,"password") VALUES
	('admin','ask@mail.com','$2a$12$9DOeaW4x5gJqWC4WKXMInOzkJUDqbA2x60QhydtAOE81W7qs8Ymqm');

	
INSERT INTO public.configs ("key",value) VALUES
	('CURRENT_SESSION','July-25'),
	('ALL_SESSIONS','["July-25"]'),
	('THEORY_PREFERENCES_COMPLETE','0'),
	('THEORY_EMAIL','Sample theory email'),
	('SCHEDULE_EMAIL','Sample schedule email'),
	('SESSIONAL_EMAIL','Sample sessional email'),
	('THEORY_PREF_STATUS','0'),
	('days','["Saturday","Sunday","Monday","Tuesday","Wednesday"]'),
	('times','[8,9,10,11,12,1,2,3,4]'),
	('possibleLabTimes','[8,11,2]'),
	('LEVEL_COUNT', '4'),
	('TERM_COUNT', '2');

INSERT INTO public.sessional_types (code, "name", teacher_count, lab_type, sort_order) VALUES
	('DEPT_SW', 'Departmental Software', 3, 'SW', 1),
	('DEPT_HW', 'Departmental Hardware', 2, 'HW', 2),
	('DEPT_PRESENTATION', 'Departmental Presentation', 2, 'SW', 3),
	('NON_DEPT_SW', 'Non-Departmental Software', 2, 'SW', 4),
	('NON_DEPT_HW', 'Non-Departmental Hardware', 2, 'HW', 5);

-- Capstone runs for every section at once, one room per section.
INSERT INTO public.sessional_constraints (kind, course_id, same_slot, shared_room, note) VALUES
	('course_together', 'CSE450', true, true, 'Capstone project');

-- Tuesday 2 PM was kept free of sessionals in past routines.
INSERT INTO public.sessional_constraints (kind, "day", "time", note) VALUES
	('blocked_slot', 'Tuesday', 2, 'Kept free in past routines');

INSERT INTO public.rooms (room,"type",lab_type,full_name,room_number) VALUES
('IAC', 1, 'SW', 'BK-IAC Center', 'G-02'),
('CL', 1, 'SW', 'Computing Lab', 'G-04'),
('IL', 1, 'HW', 'Interfacing Lab', 'G-07'),
('DL', 1, 'HW', 'Digital Lab', 'G-09'),
('VDAL', 1, 'SW', 'VLSI Design Automation Lab', 'R-404'),
('WNL', 1, 'SW', 'Wireless Network Lab', 'R-405'),
('PL', 1, 'SW', 'Programming Language Lab', 'R-406'),
('DBL', 1, 'SW', 'Database & Data Warehouse Lab', 'R-407'),
('CCL', 1, 'SW', 'Cloud Computing Laboratory', 'R-904'),
('CSL', 1, 'SW', 'Cyber Security Laboratory', 'R-907'),
('BL', 1, 'SW', NULL, NULL),
('AIRL', 1, 'SW', NULL, NULL);

INSERT INTO public.rooms (room,"type") VALUES
('103', 0),
('104', 0),
('107', 0),
('108', 0),
('109', 0),
('203', 0),
('204', 0),
('205', 0),
('206', 0),
('207', 0),
('504', 0),
('903', 0),
('904', 0);

INSERT INTO public.level_term_unique (level_term, department) VALUES
	('L-2 T-1',	'BME'),
	('L-2 T-2',	'BME'),
	('L-3 T-1',	'BME'),
	('L-4 T-1',	'BME'),
	('L-1 T-1',	'CSE'),
	('L-1 T-2',	'CSE'),
	('L-2 T-1',	'CSE'),
	('L-2 T-2',	'CSE'),
	('L-3 T-1',	'CSE'),
	('L-3 T-2',	'CSE'),
	('L-4 T-1',	'CSE'),
	('L-4 T-2',	'CSE'),
	('L-1 T-1',	'EEE'),
	('L-4 T-1',	'EEE'),
	('L-2 T-1',	'IPE'),
	('L-2 T-1',	'MME'),
	('L-2 T-1',	'NCE'),
	('L-1 T-2',	'URP');

-- Listed most senior first; seniority_rank follows the order.
INSERT INTO public.teachers (initial,"name",surname,designation,email,seniority_rank,active,theory_courses,sessional_courses) VALUES
	('MMA', 'Dr. Muhammad Masroor Ali', 'Masroor', 'Professor', 'routine.scheduler.buet@gmail.com', 1, 1, 1, 1),
	('ASLMH', 'Dr. Abu Sayed Md. Latiful Hoque', 'Latif', 'Professor', 'routine.scheduler.buet@gmail.com', 2, 1, 1, 1),
	('MMI', 'Dr. Md. Monirul Islam', 'Monir', 'Professor', 'routine.scheduler.buet@gmail.com', 3, 1, 1, 1),
	('MMAK', 'Dr. Md. Mostofa Akbar', 'Mostofa', 'Professor', 'routine.scheduler.buet@gmail.com', 4, 1, 1, 1),
	('MMFZ', 'Dr. Mohammad Mahfuzul Islam', 'Mahfuz', 'Professor', 'routine.scheduler.buet@gmail.com', 5, 1, 1, 1),
	('AKMAR', 'Dr. A.K.M. Ashikur Rahman', 'Ashik', 'Professor', 'routine.scheduler.buet@gmail.com', 6, 1, 1, 1),
	('MN', 'Dr. Mahmuda Naznin', 'Mahmuda', 'Professor', 'routine.scheduler.buet@gmail.com', 7, 1, 1, 1),
	('MDMI', 'Dr. Md. Monirul Islam', 'Monir Jr.', 'Professor', 'routine.scheduler.buet@gmail.com', 8, 1, 1, 1),
	('TH', 'Dr. Tanzima Hashem', 'Tanzima', 'Professor', 'routine.scheduler.buet@gmail.com', 9, 1, 1, 1),
	('MSH', 'Dr. Md. Shohrab Hossain', 'Shohrab', 'Professor', 'routine.scheduler.buet@gmail.com', 10, 1, 1, 1),
	('AAI', 'Dr. A. B. M. Alim Al Islam', 'Alim', 'Professor', 'routine.scheduler.buet@gmail.com', 11, 1, 1, 1),
	('AI', 'Dr. Anindya Iqbal', 'Anindya', 'Professor', 'routine.scheduler.buet@gmail.com', 12, 1, 1, 1),
	('RS', 'Dr. Rifat Shahriyar', 'Rifat', 'Professor', 'routine.scheduler.buet@gmail.com', 13, 1, 1, 1),
	('MDAA', 'Dr. Muhammad Abdullah Adnan', 'Adnan', 'Professor', 'routine.scheduler.buet@gmail.com', 14, 1, 1, 1),
	('MDSR', 'Dr. Mohammad Saifur Rahman', 'Saifur', 'Professor', 'routine.scheduler.buet@gmail.com', 15, 1, 1, 1),
	('MSB', 'Dr. Md. Shamsuzzoha Bayzid', 'Bayzid', 'Professor', 'routine.scheduler.buet@gmail.com', 16, 1, 1, 1),
	('AHR', 'Dr. Atif Hasan Rahman', 'Atif', 'Associate Professor', 'routine.scheduler.buet@gmail.com', 17, 1, 1, 1),
	('SS', 'Dr. Sadia Sharmin', 'Sadia', 'Associate Professor', 'routine.scheduler.buet@gmail.com', 18, 1, 1, 1),
	('AW', 'Abu Wasif', 'Wasif', 'Associate Professor', 'routine.scheduler.buet@gmail.com', 19, 1, 1, 1),
	('SB', 'Sukarna Barua', 'Sukarna', 'Associate Professor', 'routine.scheduler.buet@gmail.com', 20, 1, 1, 1),
	('MSIB', 'Md. Shariful Islam Bhuyan', 'Sharif', 'Associate Professor', 'routine.scheduler.buet@gmail.com', 21, 1, 1, 1),
	('RRR', 'Dr. Rezwana Reaz Rimpi', 'Rimpi', 'Associate Professor', 'routine.scheduler.buet@gmail.com', 22, 1, 1, 1),
	('MTA', 'Dr. Tanveer Awal', 'Tanveer', 'Assistant Professor', 'routine.scheduler.buet@gmail.com', 23, 1, 1, 1),
	('KMS', 'Khaled Mahmud Shahriar', 'Shahriar', 'Assistant Professor', 'routine.scheduler.buet@gmail.com', 24, 1, 1, 1),
	('CRH', 'Dr. Ch. Md. Rakin Haider', 'Rakin', 'Assistant Professor', 'routine.scheduler.buet@gmail.com', 25, 1, 1, 1),
	('HT', 'Tahmid Hasan', 'Tahmid', 'Assistant Professor', 'routine.scheduler.buet@gmail.com', 26, 1, 1, 1),
	('NVN', 'Dr. Novia Nurain', 'Novia', 'Assistant Professor', 'routine.scheduler.buet@gmail.com', 27, 1, 1, 1),
	('IJ', 'Ishrat Jahan', 'Ishrat', 'Assistant Professor', 'routine.scheduler.buet@gmail.com', 28, 1, 1, 1),
	('JYK', 'Junaed Younus Khan', 'Junaed', 'Assistant Professor', 'routine.scheduler.buet@gmail.com', 29, 1, 1, 1),
	('MNM', 'Md. Nurul Muttakin', 'Muttakin', 'Assistant Professor', 'routine.scheduler.buet@gmail.com', 30, 1, 1, 1),
	('MHE', 'A. K. M. Mehedi Hasan', 'Mehedi', 'Lecturer', 'routine.scheduler.buet@gmail.com', 31, 1, 1, 1),
	('ART', 'Abdur Rashid Tushar', 'Tushar', 'Lecturer', 'routine.scheduler.buet@gmail.com', 32, 1, 1, 1),
	('SAH', 'Sheikh Azizul Hakim', 'Hakim', 'Lecturer', 'routine.scheduler.buet@gmail.com', 33, 1, 1, 1),
	('KRV', 'Kowshic Roy', 'Vodro', 'Lecturer', 'routine.scheduler.buet@gmail.com', 34, 1, 1, 1),
	('SMH', 'Saem Hasan', 'Saem', 'Lecturer', 'routine.scheduler.buet@gmail.com', 35, 1, 1, 1),
	('EHP', 'Md. Emamul Haque Pranta', 'Pranta', 'Lecturer', 'routine.scheduler.buet@gmail.com', 36, 1, 1, 1),
	('AMR', 'Ahmed Mahir Sultan Rumi', 'Rumi', 'Lecturer', 'routine.scheduler.buet@gmail.com', 37, 1, 1, 1),
	('RJM', 'Rabib Jahin Ibn Momin', 'Rabib', 'Lecturer', 'routine.scheduler.buet@gmail.com', 38, 1, 1, 1),
	('ADR', 'Abdur Rafi', 'Rafi', 'Lecturer', 'routine.scheduler.buet@gmail.com', 39, 1, 1, 1),
	('ABS', 'Anwarul Bashir Shuaib', 'Shuaib', 'Lecturer', 'routine.scheduler.buet@gmail.com', 40, 1, 1, 1),
	('STR', 'Shattik Islam Rhythm', 'Shattik', 'Lecturer', 'routine.scheduler.buet@gmail.com', 41, 1, 1, 1),
	('MSD', 'Mohammad Sadat Hossain', 'Sadat', 'Lecturer', 'routine.scheduler.buet@gmail.com', 42, 1, 1, 1),
	('NTD', 'Nafis Tahmid', 'Nafis', 'Lecturer', 'routine.scheduler.buet@gmail.com', 43, 1, 1, 1),
	('ARK', 'Md. Ashrafur Rahman Khan', 'Ashrafur', 'Lecturer', 'routine.scheduler.buet@gmail.com', 44, 1, 1, 1),
	('RZS', 'MD. Roqunuzzaman Sojib', 'Sojib', 'Lecturer', 'routine.scheduler.buet@gmail.com', 45, 1, 1, 1),
	('NZR', 'Niaz Rahman', 'Niaz', 'Lecturer', 'routine.scheduler.buet@gmail.com', 46, 1, 1, 1),
	('MLD', 'Mahir Labib Dihan', 'Dihan', 'Lecturer', 'routine.scheduler.buet@gmail.com', 47, 1, 1, 1),
	('AKS', 'Anik Saha', 'Anik', 'Lecturer', 'routine.scheduler.buet@gmail.com', 48, 1, 1, 1),
	('AMA', 'Abdullah Muhammed Amimul Ehsan', 'Amimul', 'Lecturer', 'routine.scheduler.buet@gmail.com', 49, 1, 1, 1),
	('IRK', 'Md. Irtiaz Kabir', 'Irtiaz', 'Lecturer', 'routine.scheduler.buet@gmail.com', 50, 1, 1, 1),
	('STP', 'Swastika Pandit', 'Swastika', 'Lecturer', 'routine.scheduler.buet@gmail.com', 51, 1, 1, 1),
	('AHJ', 'Anup Halder Joy', 'Anup', 'Lecturer', 'routine.scheduler.buet@gmail.com', 52, 1, 1, 1),
	('ZMS', 'Md. Zim - Mim Siddiqee Sowdha', 'Sowdha', 'Lecturer', 'routine.scheduler.buet@gmail.com', 53, 1, 1, 1);

-- Only teachers with a doctorate supervise Thesis 1 by default.
UPDATE public.teachers SET offers_thesis_1 = true WHERE "name" ILIKE '%Dr.%';

-- Credit hours each teacher takes on by default, by designation.
UPDATE public.teachers SET teacher_credits_offered = CASE designation
	WHEN 'Professor' THEN 15
	WHEN 'Associate Professor' THEN 15
	WHEN 'Assistant Professor' THEN 18
	WHEN 'Lecturer' THEN 21
	ELSE teacher_credits_offered
END;

INSERT INTO all_courses (course_id, name, type, class_per_week, "from", "to", level_term, optional) VALUES
	-- =========================================================================
	-- Level 1, Term 1 Courses
	-- =========================================================================
	('CSE101', 'Structured Programming Language', 0, 3.00, 'CSE', 'CSE', 'L-1 T-1', 0),
	('CSE102', 'Structured Programming Language Sessional', 1, 1.50, 'CSE', 'CSE', 'L-1 T-1', 0),
	('CSE103', 'Discrete Mathematics', 0, 3.00, 'CSE', 'CSE', 'L-1 T-1', 0),
	('EEE163', 'Introduction to Electrical Engineering', 0, 3.00, 'EEE', 'CSE', 'L-1 T-1', 0),
	('EEE164', 'Introduction to Electrical Engineering Sessional', 1, 1.50, 'EEE', 'CSE', 'L-1 T-1', 0),
	('MATH141', 'Calculus I', 0, 3.00, 'MATH', 'CSE', 'L-1 T-1', 0),
	('PHY129', 'Structure of Matter, Electricity & Magnetism, Wave Mechanics', 0, 3.00, 'PHY', 'CSE', 'L-1 T-1', 0),
	('PHY114', 'Physics Sessional', 1, 1.50, 'PHY', 'CSE', 'L-1 T-1', 0),

	-- =========================================================================
	-- Level 1, Term 2 Courses
	-- =========================================================================
	('CSE107', 'Object Oriented Programming Language', 0, 3.00, 'CSE', 'CSE', 'L-1 T-2', 0),
	('CSE108', 'Object Oriented Programming Language Sessional', 1, 1.50, 'CSE', 'CSE', 'L-1 T-2', 0),
	('CSE105', 'Data Structures and Algorithms I', 0, 3.00, 'CSE', 'CSE', 'L-1 T-2', 0),
	('CSE106', 'Data Structures and Algorithms I Sessional', 1, 1.50, 'CSE', 'CSE', 'L-1 T-2', 0),
	('CHEM113', 'Chemistry', 0, 3.00, 'CHEM', 'CSE', 'L-1 T-2', 0),
	('CHEM118', 'Chemistry Sessional', 1, 0.75, 'CHEM', 'CSE', 'L-1 T-2', 0),
	('MATH143', 'Linear Algebra', 0, 3.00, 'MATH', 'CSE', 'L-1 T-2', 0),
	('ME165', 'Basic Mechanical Engineering', 0, 3.00, 'ME', 'CSE', 'L-1 T-2', 0),
	('ME174', 'Mechanical Engineering Drawing and CAD', 1, 1.50, 'ME', 'CSE', 'L-1 T-2', 0),

	-- =========================================================================
	-- Level 2, Term 1 Courses
	-- =========================================================================
	('CSE205', 'Digital Logic Design', 0, 3.00, 'CSE', 'CSE', 'L-2 T-1', 0),
	('CSE206', 'Digital Logic Design Sessional', 1, 1.50, 'CSE', 'CSE', 'L-2 T-1', 0),
	('CSE207', 'Data Structures and Algorithms II', 0, 3.00, 'CSE', 'CSE', 'L-2 T-1', 0),
	('CSE208', 'Data Structures and Algorithms II Sessional', 1, 1.50, 'CSE', 'CSE', 'L-2 T-1', 0),
	('CSE215', 'Database', 0, 3.00, 'CSE', 'CSE', 'L-2 T-1', 0),
	('CSE216', 'Database Sessional', 1, 1.50, 'CSE', 'CSE', 'L-2 T-1', 0),
	('EEE263', 'Electronic Circuits', 0, 3.00, 'EEE', 'CSE', 'L-2 T-1', 0),
	('EEE264', 'Electronic Circuits Sessional', 1, 1.50, 'EEE', 'CSE', 'L-2 T-1', 0),
	('MATH241', 'Advanced Calculus', 0, 3.00, 'MATH', 'CSE', 'L-2 T-1', 0),

	-- =========================================================================
	-- Level 2, Term 2 Courses
	-- =========================================================================
	('CSE200', 'Technical Writing and Presentation', 1, 0.75, 'CSE', 'CSE', 'L-2 T-2', 0),
	('CSE209', 'Computer Architecture', 0, 3.00, 'CSE', 'CSE', 'L-2 T-2', 0),
	('CSE210', 'Computer Architecture Sessional', 1, 0.75, 'CSE', 'CSE', 'L-2 T-2', 0),
	('CSE211', 'Theory of Computation', 0, 3.00, 'CSE', 'CSE', 'L-2 T-2', 0),
	('CSE213', 'Software Engineering', 0, 3.00, 'CSE', 'CSE', 'L-2 T-2', 0),
	('CSE214', 'Software Engineering Sessional', 1, 0.75, 'CSE', 'CSE', 'L-2 T-2', 0),
	('CSE219', 'Signals and Linear Systems', 0, 3.00, 'CSE', 'CSE', 'L-2 T-2', 0),
	('CSE220', 'Signals and Linear Systems Sessional', 1, 1.50, 'CSE', 'CSE', 'L-2 T-2', 0),
	('MATH243', 'Probability and Statistics', 0, 3.00, 'MATH', 'CSE', 'L-2 T-2', 0),

	-- =========================================================================
	-- Level 3, Term 1 Courses
	-- =========================================================================
	('CSE301', 'Mathematics for Computing and Data Science', 0, 3.00, 'CSE', 'CSE', 'L-3 T-1', 0),
	('CSE309', 'Compiler', 0, 3.00, 'CSE', 'CSE', 'L-3 T-1', 0),
	('CSE310', 'Compiler Sessional', 1, 0.75, 'CSE', 'CSE', 'L-3 T-1', 0),
	('CSE313', 'Operating System', 0, 3.00, 'CSE', 'CSE', 'L-3 T-1', 0),
	('CSE314', 'Operating System Sessional', 1, 0.75, 'CSE', 'CSE', 'L-3 T-1', 0),
	('CSE315', 'Microprocessors, Microcontrollers, and Embedded Systems', 0, 3.00, 'CSE', 'CSE', 'L-3 T-1', 0),
	('CSE316', 'Microprocessors, Microcontrollers, and Embedded Systems Sessional', 1, 0.75, 'CSE', 'CSE', 'L-3 T-1', 0),
	('CSE317', 'Artificial Intelligence', 0, 3.00, 'CSE', 'CSE', 'L-3 T-1', 0),
	('CSE318', 'Artificial Intelligence Sessional', 1, 0.75, 'CSE', 'CSE', 'L-3 T-1', 0),

	-- =========================================================================
	-- Level 3, Term 2 Courses
	-- =========================================================================
	('CSE311', 'Data Communication', 0, 3.00, 'CSE', 'CSE', 'L-3 T-2', 0),
	('CSE321', 'Computer Networks', 0, 3.00, 'CSE', 'CSE', 'L-3 T-2', 0),
	('CSE322', 'Computer Networks Sessional', 1, 1.50, 'CSE', 'CSE', 'L-3 T-2', 0),
	('CSE325', 'Information Systems Development and Management', 0, 3.00, 'CSE', 'CSE', 'L-3 T-2', 0),
	('CSE326', 'Information Systems Development and Management Sessional', 1, 1.50, 'CSE', 'CSE', 'L-3 T-2', 0),
	('CSE329', 'Machine Learning', 0, 3.00, 'CSE', 'CSE', 'L-3 T-2', 0),
	('CSE330', 'Machine Learning Sessional', 1, 1.50, 'CSE', 'CSE', 'L-3 T-2', 0),
	('CSE450', 'Capstone Project', 1, 1.50, 'CSE', 'CSE', 'L-3 T-2', 0),
	('HUM347', 'Ethics in Society and E-Governance', 0, 3.00, 'HUM', 'CSE', 'L-3 T-2', 0),

	-- =========================================================================
	-- Level 4, Term 1 Compulsory Courses
	-- =========================================================================
	('CSE400', 'Project and Thesis', 2, 3.00, 'CSE', 'CSE', 'L-4 T-1', 0),
	('CSE401', 'Numerical Analysis, Simulation and Modeling', 0, 3.00, 'CSE', 'CSE', 'L-4 T-1', 0),
	('CSE402', 'Numerical Analysis, Simulation and Modeling Sessional', 1, 0.75, 'CSE', 'CSE', 'L-4 T-1', 0),
	('CSE405', 'Cyber Security', 0, 3.00, 'CSE', 'CSE', 'L-4 T-1', 0),
	('CSE406', 'Cyber Security Sessional', 1, 0.75, 'CSE', 'CSE', 'L-4 T-1', 0),
	('CSE450', 'Capstone Project', 1, 1.50, 'CSE', 'CSE', 'L-4 T-1', 0),
	('HUM475', 'Engineering Economics', 0, 3.00, 'HUM', 'CSE', 'L-4 T-1', 0),

	-- =========================================================================
	-- Level 4, Term 1 Elective Courses (Option 1 & Option 2)
	-- =========================================================================
	('CSE417', 'Cyber-Physical Systems', 0, 3.00, 'CSE', 'CSE', 'L-4 T-1', 1),
	('CSE419', 'Internet of Things (IoT)', 0, 3.00, 'CSE', 'CSE', 'L-4 T-1', 1),
	('CSE421', 'Basic Graph Theory', 0, 3.00, 'CSE', 'CSE', 'L-4 T-1', 1),
	('CSE423', 'Fault Tolerant Systems', 0, 3.00, 'CSE', 'CSE', 'L-4 T-1', 1),
	('CSE425', 'Human Computer Interaction', 0, 3.00, 'CSE', 'CSE', 'L-4 T-1', 1),
	('CSE429', 'Deep Learning', 0, 3.00, 'CSE', 'CSE', 'L-4 T-1', 1),
	('CSE435', 'Introduction to Quantum Computing', 0, 3.00, 'CSE', 'CSE', 'L-4 T-1', 1),
	('CSE441', 'Mobile Computing', 0, 3.00, 'CSE', 'CSE', 'L-4 T-1', 1),
	('CSE445', 'Data Mining and Information Retrieval', 0, 3.00, 'CSE', 'CSE', 'L-4 T-1', 1),
	('CSE453', 'High Performance Database System', 0, 3.00, 'CSE', 'CSE', 'L-4 T-1', 1),
	('CSE455', 'Next Generation Wireless Networks', 0, 3.00, 'CSE', 'CSE', 'L-4 T-1', 1),
	('CSE457', 'Wireless Networks', 0, 3.00, 'CSE', 'CSE', 'L-4 T-1', 1),
	('CSE459', 'Communication Systems', 0, 3.00, 'CSE', 'CSE', 'L-4 T-1', 1),
	('CSE463', 'Bioinformatics', 0, 3.00, 'CSE', 'CSE', 'L-4 T-1', 1),
	('CSE467', 'Software Architecture', 0, 3.00, 'CSE', 'CSE', 'L-4 T-1', 1),
	('CSE477', 'Cloud Computing', 0, 3.00, 'CSE', 'CSE', 'L-4 T-1', 1),
	('EEE463', 'Optical Communications', 0, 3.00, 'EEE', 'CSE', 'L-4 T-1', 1),
	('EEE465', 'Telecommunication Systems', 0, 3.00, 'EEE', 'CSE', 'L-4 T-1', 1),
	('MATH441', 'Mathematical Optimization', 0, 3.00, 'MATH', 'CSE', 'L-4 T-1', 1),
	('MATH443', 'Game Theory', 0, 3.00, 'MATH', 'CSE', 'L-4 T-1', 1),
	('PHY405', 'Quantum Mechanics', 0, 3.00, 'PHY', 'CSE', 'L-4 T-1', 1),

	-- =========================================================================
	-- Level 4, Term 2 Compulsory Courses
	-- =========================================================================
	('CSE400', 'Project and Thesis', 2, 3.00, 'CSE', 'CSE', 'L-4 T-2', 0),
	('HUM403', 'Communication in English', 0, 3.00, 'HUM', 'CSE', 'L-4 T-2', 0),
	('HUM402', 'Professional Communication in English Sessional', 1, 1.50, 'HUM', 'CSE', 'L-4 T-2', 0),
	('HUM429', 'Accounting and Entrepreneurship for IT Business', 0, 3.00, 'HUM', 'CSE', 'L-4 T-2', 0),
	('IPE493', 'Industrial Management', 0, 3.00, 'IPE', 'CSE', 'L-4 T-2', 0),

	-- =========================================================================
	-- Level 4, Term 2 Elective Courses (Option 3 & Option 4 with Sessionals)
	-- =========================================================================
	('CSE409', 'Computer Graphics', 0, 3.00, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE410', 'Computer Graphics Sessional', 1, 0.75, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE411', 'Simulation and Modeling', 0, 3.00, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE412', 'Simulation and Modeling Sessional', 1, 0.75, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE413', 'High Performance Computing', 0, 3.00, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE414', 'High Performance Computing Sessional', 1, 0.75, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE415', 'Real-time Embedded Systems', 0, 3.00, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE416', 'Real-time Embedded Systems Sessional', 1, 0.75, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE427', 'Network Security', 0, 3.00, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE428', 'Network Security Sessional', 1, 0.75, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE431', 'Natural Language Processing', 0, 3.00, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE432', 'Natural Language Processing Sessional', 1, 0.75, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE433', 'Image Processing and Computer Vision', 0, 3.00, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE434', 'Image Processing and Computer Vision Sessional', 1, 0.75, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE437', 'Data Science and Big Data Analytics', 0, 3.00, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE438', 'Data Science and Big Data Analytics Sessional', 1, 0.75, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE439', 'Functional Programming', 0, 3.00, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE440', 'Functional Programming Sessional', 1, 0.75, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE447', 'Introduction to Blockchain', 0, 3.00, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE448', 'Introduction to Blockchain Sessional', 1, 0.75, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE461', 'Algorithm Engineering', 0, 3.00, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE462', 'Algorithm Engineering Sessional', 1, 0.75, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE469', 'Software Testing and Quality Assurance', 0, 3.00, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE470', 'Software Testing and Quality Assurance Sessional', 1, 0.75, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE475', 'Robotics', 0, 3.00, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE476', 'Robotics Sessional', 1, 0.75, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE481', 'VLSI Design', 0, 3.00, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE482', 'VLSI Design Sessional', 1, 0.75, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE483', 'Interfacing', 0, 3.00, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE484', 'Interfacing Sessional', 1, 0.75, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE485', 'Digital Signal Processing', 0, 3.00, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE486', 'Digital Signal Processing Sessional', 1, 0.75, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE487', 'Mobile Applications Development', 0, 3.00, 'CSE', 'CSE', 'L-4 T-2', 1),
	('CSE488', 'Mobile Applications Development Sessional', 1, 0.75, 'CSE', 'CSE', 'L-4 T-2', 1),
	('EEE469', 'Electrical Machines and Instrumentation', 0, 3.00, 'EEE', 'CSE', 'L-4 T-2', 1),
	('EEE470', 'Electrical Machines and Instrumentation Sessional', 1, 0.75, 'EEE', 'CSE', 'L-4 T-2', 1),

	-- =========================================================================
	-- Courses Offered to Other Departments
	-- =========================================================================
	-- Offered to EEE
	('CSE109', 'Computer Programming', 0, 3.00, 'CSE', 'EEE', 'L-1 T-1', 0),
	('CSE110', 'Computer Programming Sessional', 1, 1.50, 'CSE', 'EEE', 'L-1 T-1', 0),
	('CSE451', 'Computer Networks', 0, 3.00, 'CSE', 'EEE', 'L-4 T-1', 0),
	('CSE452', 'Computer Networks Sessional', 1, 1.50, 'CSE', 'EEE', 'L-4 T-1', 0),

	-- Offered to BME
	('CSE281', 'Computer Programming', 0, 3.00, 'CSE', 'BME', 'L-2 T-1', 0),
	('CSE282', 'Computer Programming Sessional', 1, 1.50, 'CSE', 'BME', 'L-2 T-1', 0),
	('CSE283', 'Digital Techniques', 0, 3.00, 'CSE', 'BME', 'L-2 T-2', 0),
	('CSE284', 'Digital Techniques Sessional', 1, 1.50, 'CSE', 'BME', 'L-2 T-2', 0),
	('CSE391', 'Embedded Systems and Interfacing', 0, 3.00, 'CSE', 'BME', 'L-3 T-1', 0),
	('CSE392', 'Embedded Systems and Interfacing Sessional', 1, 1.50, 'CSE', 'BME', 'L-3 T-1', 0),
	('CSE493', 'Medical Informatics', 0, 3.00, 'CSE', 'BME', 'L-4 T-1', 0),

	-- Offered to IPE
	('CSE295', 'Computer Programming Techniques', 0, 3.00, 'CSE', 'IPE', 'L-2 T-1', 0),
	('CSE296', 'Computer Programming Techniques Sessional', 1, 1.50, 'CSE', 'IPE', 'L-2 T-1', 0),

	-- Offered to MME
	('CSE287', 'Computer Programming', 0, 3.00, 'CSE', 'MME', 'L-2 T-1', 0),
	('CSE288', 'Computer Programming Sessional', 1, 1.50, 'CSE', 'MME', 'L-2 T-1', 0),

	-- Offered to NCE
	('CSE273', 'Computer Programming and Numerical Analysis for Materials Modeling', 0, 3.00, 'CSE', 'NCE', 'L-2 T-1', 0),
	('CSE274', 'Computer Programming and Numerical Analysis for Materials Modeling Sessional', 1, 1.50, 'CSE', 'NCE', 'L-2 T-1', 0);

-- Kind of every sessional CSE runs; it sets how many teachers each section gets.
-- Sessionals run by other departments have no kind: CSE assigns them no teachers.
UPDATE all_courses SET sessional_type = 'DEPT_SW' WHERE "to" = 'CSE' AND course_id IN (
	'CSE102', 'CSE106', 'CSE108', 'CSE208', 'CSE214', 'CSE216', 'CSE220',
	'CSE310', 'CSE314', 'CSE318', 'CSE322', 'CSE326', 'CSE330',
	'CSE402', 'CSE406', 'CSE410', 'CSE412', 'CSE414', 'CSE428', 'CSE432',
	'CSE434', 'CSE438', 'CSE440', 'CSE448', 'CSE470', 'CSE486', 'CSE488'
);
UPDATE all_courses SET sessional_type = 'DEPT_HW' WHERE "to" = 'CSE' AND course_id IN (
	'CSE206', 'CSE210', 'CSE316', 'CSE416', 'CSE476', 'CSE482', 'CSE484'
);
UPDATE all_courses SET sessional_type = 'DEPT_PRESENTATION' WHERE "to" = 'CSE' AND course_id IN (
	'CSE200', 'CSE450', 'CSE462'
);
UPDATE all_courses SET sessional_type = 'NON_DEPT_SW' WHERE "to" <> 'CSE' AND course_id IN (
	'CSE110', 'CSE452', 'CSE282', 'CSE296', 'CSE288', 'CSE274'
);
UPDATE all_courses SET sessional_type = 'NON_DEPT_HW' WHERE "to" <> 'CSE' AND course_id IN (
	'CSE284', 'CSE392'
);

INSERT INTO public.hosted_departments (department) VALUES
	('CHEM'),
	('CSE'),
	('EEE'),
	('HUM'),
	('IPE'),
	('MATH'),
	('ME'),
	('PHY');

INSERT INTO default_section_count (department, section_count, subsection_count_per_section) VALUES
	('CSE', 3, 2),
	('EEE', 3, 2),
	('BME', 1, 2),
	('IPE', 2, 2),
	('MME', 1, 2),
	('NCE', 1, 1),
	('URP', 1, 1);

INSERT INTO public.section_count (batch, department, section_count, subsection_count_per_section) VALUES
	('21', 'CSE', 3, 2),
	('21', 'EEE', 3, 2),
	('21', 'BME', 1, 2),
	('21', 'IPE', 2, 2),
	('21', 'MME', 1, 2),
	('21', 'NCE', 1, 1),
	('21', 'URP', 1, 1);

INSERT INTO public.section_count (batch, department, section_count, subsection_count_per_section) VALUES
	('22', 'CSE', 3, 2),
	('22', 'EEE', 3, 2),
	('22', 'BME', 1, 2),
	('22', 'IPE', 2, 2),
	('22', 'MME', 1, 2),
	('22', 'NCE', 1, 1),
	('22', 'URP', 1, 1);

INSERT INTO public.section_count (batch, department, section_count, subsection_count_per_section) VALUES
	('23', 'CSE', 3, 2),
	('23', 'EEE', 3, 2),
	('23', 'BME', 1, 2),
	('23', 'IPE', 2, 2),
	('23', 'MME', 1, 2),
	('23', 'NCE', 1, 1),
	('23', 'URP', 1, 1);

INSERT INTO public.section_count (batch, department, section_count, subsection_count_per_section) VALUES
	('24', 'CSE', 3, 2),
	('24', 'EEE', 3, 2),
	('24', 'BME', 1, 2),
	('24', 'IPE', 2, 2),
	('24', 'MME', 1, 2),
	('24', 'NCE', 1, 1),
	('24', 'URP', 1, 1);

INSERT INTO public.section_count (batch, department, section_count, subsection_count_per_section) VALUES
	('25', 'CSE', 3, 2),
	('25', 'EEE', 3, 2),
	('25', 'BME', 1, 2),
	('25', 'IPE', 2, 2),
	('25', 'MME', 1, 2),
	('25', 'NCE', 1, 1),
	('25', 'URP', 1, 1);
