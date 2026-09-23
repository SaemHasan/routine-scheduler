# Routine Scheduler Backend

This is the backend for the Routine Scheduler project. It is a RESTful API built using Express.js and PostgreSQL.

## Setup

### Database

1. Install PostgreSQL
2. Create a new database
3. Create a new user and grant all privileges on the new database
4. Create a `.env` file in the root directory of the project and add the following environment variables:

5. Use dump file to restore the database

```bash
psql -U user -d database_name -f dump.sql
```

### Running the server

1. Install dependencies

```bash
npm install
```

2. Create a `.env` file in the root directory of the project and add the following environment variables:
```
CONNECTION_URL="postgresql://user:password@localhost:5432/routine_scheduler?sslmode=disable"
SECRET=jst_secret_set_1234
SENDEREMAIL= '___@gmail.com'
SENDERPASSWORD = ''
PORT=4200
```
Create a app password for gmail and add it to the SENDERPASSWORD

3. Start the server

```bash
npm start
```

### Accessing the API

Credentials:

```
username: admin
password: password
```

To change the credentials, [generate a bcrypt hash](https://bcrypt-generator.com/) of the new password and update in the database.

### API Documentation

## Table of Contents
- [Authentication](##authentication)
- [Teachers](##teachers)
- [Rooms](##rooms)
- [Courses](##courses)
- [Sections](##sections)
- [Forms](##forms)
- [Configurations](##configurations)
- [Assignments](##assignments)
- [Schedules](##schedules)
- [Lab Rooms](##lab-rooms)
- [Routines](##routines)

---

## Authentication

### Admin Login
- **HTTP Method**: POST  
- **Endpoint**: `/v1/auth/login`  
- **Description**: Authenticate admin user.  
- **Auth**: ❌  
- **Request Body**: 
```
    {
        "adminID":"rt3210",
        "password":"letscreateroutine"
    }
``` 
- **Response Body**: 
```
    {
        "jwt":"tokengh43gh43#123"
    }
``` 
- **Status**: 200  

### Admin Logout
- **HTTP Method**: POST  
- **Endpoint**: `/v1/auth/logout`  
- **Description**: Logout admin user.  
- **Auth**: ✅  
- **Request Body**: 
```
    {
        "jwt":"tokengh43gh43#123"
    }
```
- **Response Body**: `{"message": "Logged out"}`  
- **Status**: 200  

### Update Admin Email
- **HTTP Method**: PATCH  
- **Endpoint**: `/v1/auth/update-mail`  
- **Description**: Update admin email.  
- **Auth**: ✅  
- **Request Body**: 
```
    {
        "email":"mehedi32@buet.ac.bd"
    }
```
- **Response Body**: `{"message": "Email updated successfully"}`  
- **Status**: 200  

### Request Password Reset
- **HTTP Method**: POST  
- **Endpoint**: `/v1/auth/forgot-pass-req`  
- **Description**: Request a password reset link via email.  
- **Auth**: ✅  
- **Request Body**: 
```
    {
        "adminid":"rt3210"
    }
```  
- **Response Body**: `{"message": "Please check mail"}`  
- **Status**: 200  

### Reset Password
- **HTTP Method**: POST  
- **Endpoint**: `/v1/auth/forget-pass`  
- **Description**: Reset admin password using a token.  
- **Auth**: ✅ 
- **Request Body**: 
```
    {
        "token":"rt3210Ajksskjadka",
        "password": "password"
    }
```  
- **Response Body**: `{"message": "Password reset successful"}`  
- **Status**: 200  

### Change Password
- **HTTP Method**: POST  
- **Endpoint**: `/v1/auth/update-pass`  
- **Description**: Change admin password.  
- **Auth**: ✅  
- **Request Body**: 
```
    {
        "oldpassword":"itsverystrong",
        "newpassword":"itsverystrong_"
    }
```  
- **Response Body**: `{"message": "Password changed"}`  
- **Status**: 200  

---

## Teachers

### Get All Full time Teachers
- **HTTP Method**: GET  
- **Endpoint**: `/v1/db/teachers/get-ft`  
- **Description**: Get the list of all teachers from the database.  
- **Auth**: ✅  
- **Response Body**:
``` 
    [
        {
            "initial": "MMA",
            "name": "Dr. Md. Mashroor Ali",
            "designation": "Professor",
            "email": "...",
            "FT": "yes",
        }, ...
    ]
```
- **Status**: 200

### Get All Part time Teachers
- **HTTP Method**: GET  
- **Endpoint**: `/v1/db/teachers/get-pt`  
- **Description**: Get the list of all teachers from the database.  
- **Auth**: ✅  
- **Response Body**:
``` 
    [
        {
            "initial": "SDH",
            "name": "Sadat Hossain",
            "designation": "adjunct lecturer",
            "email": "...",
            "FT": "no",
        }, ...
    ]
```
- **Status**: 200


## Get All Active Teachers
- **HTTP Method**: GET  
- **Endpoint**: `/v1/db/teachers/get-active`  
- **Description**: Get the list of all active teachers from the database.  
- **Auth**: ✅  
- **Response Body**:
``` 
    [
        {
            "initial": "MMA",
            "name": "Dr. Md. Mashroor Ali",
            "designation": "Professor",
            "email": "...",
            "active": "yes",
        }, ...
    ]
```
- **Status**: 200

### Get Selected Teacher
- **HTTP Method**: GET  
- **Endpoint**: `/v1/db/teachers/get/{initial}`  
- **Description**: Get information of a selected teacher from the database.  
- **Auth**: ✅  
- **Response Body**:
``` 
    [
        {
            "initial": "MMA",
            "name": "Dr. Md. Mashroor Ali",
            "designation": "Professor",
            "email": "...",
            "FT": "yes",
        }, ...
    ]
```
- **Status**: 200  

### Add Teacher
- **HTTP Method**: POST  
- **Endpoint**: `/v1/db/teachers/add`  
- **Description**: Add a teacher's information to the database.  
- **Auth**: ✅  
- **Request Body**:
``` 
    [
        {
            "initial": "MMA",
            "name": "Dr. Md. Mashroor Ali",
            "designation": "Professor",
            "email": "...",
            "FT": "yes",
        }, ...
    ]
``` 
- **Response Body**: `{"message": "Teacher added successfully"}`  
- **Status**: 201  

### Update Teacher
- **HTTP Method**: PATCH  
- **Endpoint**: `/v1/db/teachers/edit/{initial}`  
- **Description**: Update information of an existing teacher in the database.  
- **Auth**: ✅  
- **Request Body**:
```
    {
        "email": "new_mail@gmail.com",
        ...
    }
``` 
- **Response Body**: `{"message": "Teacher updated successfully"}`  
- **Status**: 200  

### Delete Teacher
- **HTTP Method**: DELETE  
- **Endpoint**: `/v1/db/teachers/remove/{initial}`  
- **Description**: Delete an entry of a teacher from the database.  
- **Auth**: ✅  
- **Response Body**: `{"message": "Teacher removed successfully"}`  
- **Status**: 200  

---

## Rooms

### Get All Rooms
- **HTTP Method**: GET  
- **Endpoint**: `/v1/db/rooms/get-all`  
- **Description**: Get information of all rooms.  
- **Auth**: ✅  
- **Response Body**:
```
    [
        {
            "room_no": "404",
            "name": "VLSI Lab",
            "type": "Sessional",
            "available": 1,
        }, ...
    ]
``` 
- **Status**: 200  

### Get Selected Room
- **HTTP Method**: GET  
- **Endpoint**: `/v1/db/rooms/get/{room_no}`  
- **Description**: Get information of a selected room.  
- **Auth**: ✅  
- **Response Body**:
```
    [
        {
            "room_no": "404",
            "name": "VLSI Lab",
            "type": "Sessional",
            "available": 1,
        }, ...
    ]
``` 
- **Status**: 200  

### Add Room
- **HTTP Method**: POST  
- **Endpoint**: `/v1/db/rooms/add`  
- **Description**: Add a new room to the database.  
- **Auth**: ✅  
- **Request Body**:
```
    [
        {
            "room_no": "404",
            "name": "VLSI Lab",
            "type": "Sessional",
            "available": 1,
        }, ...
    ]
``` 
- **Response Body**: `{"message": "Room added successfully"}`  
- **Status**: 201  

### Update Room
- **HTTP Method**: PATCH  
- **Endpoint**: `/v1/db/rooms/edit/{room_no}`  
- **Description**: Update information of an existing room in the database.  
- **Auth**: ✅  
- **Request Body**:
```
    {
        "avilable": 0,
        ...
    }
```  
- **Response Body**: `{"message": "Room updated successfully"}`  
- **Status**: 200  

### Delete Room
- **HTTP Method**: DELETE  
- **Endpoint**: `/v1/db/rooms/remove/{room_no}`  
- **Description**: Delete an entry of a room from the database.  
- **Auth**: ✅  
- **Response Body**: `{"message": "Room removed successfully"}`  
- **Status**: 200  

---

## Courses

### Get All Courses
- **HTTP Method**: GET  
- **Endpoint**: `/v1/db/courses/get-all`  
- **Description**: Get information of all offered courses.  
- **Auth**: ✅  
- **Response Body**:
```
    [
        {
            "course_id": "CSE 101",
            "name": "Basic C Programming",
            "type": "Theory",
            "batch": 21,
        }, ...
    ]
``` 
- **Status**: 200  

### Get Unassigned Courses
- **HTTP Method**: GET  
- **Endpoint**: `/v1/db/courses/get-unassigned`  
- **Description**: Get information of all unassigned offered courses.  
- **Auth**: ✅  
- **Response Body**:
```
    [
        {
            "course_id": "CSE 101",
            "name": "Basic C Programming",
            "type": "Theory",
            "batch": 21,
        }, ...
    ]
``` 
- **Status**: 200 

### Get Selected Course
- **HTTP Method**: GET  
- **Endpoint**: `/v1/db/courses/get/{course_id}`  
- **Description**: Get information of a selected course.  
- **Auth**: ✅  
- **Response Body**:
```
    [
        {
            "course_id": "CSE 101",
            "name": "Basic C Programming",
            "type": "Theory",
            "batch": 21,
        }, ...
    ]
```   
- **Status**: 200  

### Add Course
- **HTTP Method**: POST  
- **Endpoint**: `/v1/db/courses/add`  
- **Description**: Add a new course to the database.  
- **Auth**: ✅  
- **Request Body**:
```
    [
        {
            "course_id": "CSE 101",
            "name": "Basic C Programming",
            "type": "Theory",
            "batch": 21,
        }, ...
    ]
```  
- **Response Body**: `{"message": "Course added successfully"}`  
- **Status**: 201  

### Update Course
- **HTTP Method**: PATCH  
- **Endpoint**: `/v1/db/courses/edit/{course_id}`  
- **Description**: Update information of an existing course in the database.  
- **Auth**: ✅  
- **Request Body**: 
```
    {
        "batch": 21,
        ...
    }
```
- **Response Body**: `{"message": "Course updated successfully"}`  
- **Status**: 200  

### Delete Course
- **HTTP Method**: DELETE  
- **Endpoint**: `/v1/db/courses/remove/{course_id}`  
- **Description**: Delete an entry of a course from the database.  
- **Auth**: ✅  
- **Response Body**: `{"message": "Course removed successfully"}`  
- **Status**: 200  

---

## Sections

### Get All Section Information
- **HTTP Method**: GET  
- **Endpoint**: `/v1/db/sections/get-all`  
- **Description**: Get informational of all sections of current batches.  
- **Auth**: ✅  
- **Response Body**:
```
    [
        {
            "section": "A",
            "session": "January 2023",
            "type": "Theory",
            "batch": 21,
        }, ...
    ]
```  
- **Status**: 200 / 404  

### Get Section Information
- **HTTP Method**: GET  
- **Endpoint**: `/v1/db/sections/get/{section_id}`  
- **Description**: Get information of selected section.  
- **Auth**: ✅  
- **Response Body**:
```
    [
        {
            "section": "A",
            "session": "January 2023",
            "type": "Theory",
            "batch": 21,
        }, ...
    ]
```  
- **Status**: 200 / 404  

### Add Section
- **HTTP Method**: POST  
- **Endpoint**: `/v1/db/sections/add`  
- **Description**: Add a new section of the current batch to the database.  
- **Auth**: ✅  
- **Request Body**:
```
    [
        {
            "section": "A",
            "session": "January 2023",
            "type": "Theory",
            "batch": 21,
        }, ...
    ]
```  
- **Response Body**: `{"message": "Section added successfully"}`  
- **Status**: 201  

### Update Section
- **HTTP Method**: PATCH  
- **Endpoint**: `/v1/db/sections/edit/{section_id}`  
- **Description**: Update information of an existing section in the database.  
- **Auth**: ✅  
- **Request Body**:
```
    {
        "batch": 21,
        ...
    }
```
- **Response Body**: `{"message": "Section updated successfully"}`  
- **Status**: 200  

### Delete Section
- **HTTP Method**: DELETE  
- **Endpoint**: `/v1/db/sections/remove/{section_id}`  
- **Description**: Delete an entry of a section from the database.  
- **Auth**: ✅  
- **Response Body**: `{"message": "Section removed successfully"}`  
- **Status**: 200 / 404  

---

## Forms

### Get Theory Course Preferences
- **HTTP Method**: GET  
- **Endpoint**: `/v1/forms/theory/pref/{form_id}`  
- **Description**: Get the preferred theory course list from a teacher's submitted form.  
- **Auth**: ❌  
- **Response Body**: 
```
    {
        "initial": "MMA",
        "name": "Dr. Md. Mashroor Ali",
        "designation": "Professor",
        "courses": [{...}],
    }
``` 
- **Status**: 200  

### Submit Theory Course Preferences
- **HTTP Method**: POST  
- **Endpoint**: `/v1/forms/theory/pref/{form_id}`  
- **Description**: Submit the preferred theory course list for a teacher.  
- **Auth**: ❌  
- **Request Body**: 
```
    {
        "courses": [
        ...
        ]
    }
```
- **Response Body**: `{"message": "Form submitted successfully"}`  
- **Status**: 200  

### Get Theory Time Schedule Preferences
- **HTTP Method**: GET  
- **Endpoint**: `/v1/forms/theory/subedule/{form_id}`  
- **Description**: Get the preferred time schedule for theory courses from a teacher's submitted form.  
- **Auth**: ❌  
- **Response Body**: 
```
    {
        "initial": "MMA",
        "name": "Dr. Md. Mashroor Ali",
        "designation": "Professor",
        "course": {...},
        "co_teacher": [...],
        "current_schedule": [{sec: "A", sched: ...}]
    }
``` 
- **Status**: 200  

### Submit Theory Time Schedule Preferences
- **HTTP Method**: POST  
- **Endpoint**: `/v1/forms/theory/subedule/{form_id}`  
- **Description**: Submit the preferred time schedule for theory courses.  
- **Auth**: ❌  
- **Request Body**: 
```
    [
        {
            "sec": "A",
            "choosen_schedule": [
            {"day": "Saturday", "time": "9:00"}, ...
            ]
        }, ...
    ]
``` 
- **Response Body**: `{"message": "Form submitted successfully"}`  
- **Status**: 200  

### Get Sessional Course Preferences
- **HTTP Method**: GET  
- **Endpoint**: `/v1/forms/sessional/pref/{form_id}`  
- **Description**: Get the preferred sessional course list from a teacher's submitted form.  
- **Auth**: ❌  
- **Response Body**: P
```
    {
        "initial": "MMA",
        "name": "Dr. Md. Mashroor Ali",
        "designation": "Professor",
        "courses": [{...}],
    }
```  
- **Status**: 200  

### Submit Sessional Course Preferences
- **HTTP Method**: POST  
- **Endpoint**: `/v1/forms/sessional/pref/{form_id}`  
- **Description**: Submit the preferred sessional course list for a teacher.  
- **Auth**: ❌  
- **Request Body**: 
```
    {
        "courses": [
        ...
        ]
    }
``` 
- **Response Body**: `{"message": "Form submitted successfully"}`  
- **Status**: 200  

---

## Configurations

### Get Current Session Info
- **HTTP Method**: GET  
- **Endpoint**: `/v1/configs/session/get`  
- **Description**: Get information about the current session.  
- **Auth**: ✅  
- **Response Body**: 
```
    {
        "session": "Januray 2025",
        "type": "Undergraduate",
        "start_date": "06-05-2025",
        ...
    }
```
- **Status**: 200 / 404  

### Update Current Session Info
- **HTTP Method**: PATCH  
- **Endpoint**: `/v1/configs/session/edit`  
- **Description**: Update the information of the current session.  
- **Auth**: ✅  
- **Request Body**: 
```
    {
        "session": "Januray 2023",
        "type": "Undergraduate",
        "start_date": "06-05-2025",
        ...
    }
```  
- **Response Body**: `{"message": "Session info updated successfully"}`  
- **Status**: 200  

### Get Email Configuration
- **HTTP Method**: GET  
- **Endpoint**: `/v1/configs/mail/get`  
- **Description**: Get email configuration such as password and others (which are sent to teachers) 
- **Auth**: ✅  
- **Response Body**: 
```
    {
        "email": "...",
        "password": "*********",
        ...
    }
``` 
- **Status**: 200  

### Update Email Configuration
- **HTTP Method**: PATCH  
- **Endpoint**: `/v1/configs/mail/edit`  
- **Description**: Update email configuration.  
- **Auth**: ✅  
- **Request Body**: 
```
    {
        "email": "...",
        "password": "*********",
        ...
    }
```   
- **Response Body**: `{"message": "Email updated successfully"}`  
- **Status**: 200  

### Get Email Templates
- **HTTP Method**: GET  
- **Endpoint**: `/v1/configs/templates/get-all`  
- **Description**: Get email templates which are sent to teachers  
- **Auth**: ✅  
- **Response Body**: 
```
    [
        {
            "id": "theory-pref",
            "title": "Theory Course",
            "subtitle": "for selecting course",
            "text": "Dear ${teacher_name}, ...",
        }, ...
    ]
```
- **Status**: 200  

### Update Email Template
- **HTTP Method**: PATCH  
- **Endpoint**: `/v1/configs/templates/edit/{id}`  
- **Description**: Update an email template.  
- **Auth**: ✅  
- **Request Body**: 
```
    {
        "text": "Dear ${teacher_name}, ...",
        ...
    }
```
- **Response Body**: `{"message": "Template updated successfully"}`  
- **Status**: 200  

### Get Form Submission Progress
- **HTTP Method**: GET  
- **Endpoint**: `/v1/configs/stage/get`  
- **Description**: Get the progress of form submissions.  
- **Auth**: ✅  
- **Response Body**: 
```
    {
        "stage": 2,
        "title": "Schedule Collection",
        "progress": "35%",
        ...
    }
```
- **Status**: 200  

---

## Assignments

### Initiate Theory Assignment
- **HTTP Method**: POST  
- **Endpoint**: `/v1/assign/theory/initiate`  
- **Description**: Initialize the theory course assignment process.  
- **Auth**: ✅  
- **Response Body**: `{"message": "Theory schedule initiated"}`  
- **Status**: 200  

### Get Theory Submission Status
- **HTTP Method**: GET  
- **Endpoint**: `/v1/assign/theory/status`  
- **Description**: Get the form submission status of teachers.  
- **Auth**: ✅ 
- **Response Body**: 
```
    [
        {
            "initial": "MMA",
            "name": "Dr. Md. Mashroor Ali",
            "email_time": "2023-05-01 22:03:12",
            "status": "Submitted", ...
        }, ...
    ]
```
- **Status**: 200  

### Finalize Theory Assignment
- **HTTP Method**: POST  
- **Endpoint**: `/v1/assign/theory/finalize`  
- **Description**: Complete the theory course assignment process.  
- **Auth**: ✅
- **Response Body**: `{"message": "Theory schedule done"}`  
- **Status**: 200  

### Resend Theory Assignment Email
- **HTTP Method**: POST  
- **Endpoint**: `/v1/assign/theory/mail/{initial}`  
- **Description**: Resend email to teachers who haven't submitted the form.  
- **Auth**: ✅ 
- **Response Body**: `{"message": "Emailed successfully"}`  
- **Status**: 200  

### Get Current Theory Assignment
- **HTTP Method**: GET  
- **Endpoint**: `/v1/assign/theory/current/{section}`  
- **Description**: Get the current theory assignment of a section.  
- **Auth**: ✅ 
- **Response Body**: 
```
    [
        {
            "initial": "MMA",
            "name": "Dr. Md. Mashroor Ali",
            "email_time": "2023-05-01 22:03:12",
            "status": "Submitted", ...
        }, ...
    ]
```  
- **Status**: 200  

### Initiate Sessional Assignment
- **HTTP Method**: POST  
- **Endpoint**: `/v1/assign/sessional/initiate`  
- **Description**: Initialize the sessional course assignment process.  
- **Auth**: ✅  
- **Response Body**: `{"message": "Sessional schedule initiated"}`  
- **Status**: 200  

### Get Sessional Submission Status
- **HTTP Method**: GET  
- **Endpoint**: `/v1/assign/sessional/status`  
- **Description**: Get the form submission status of teachers for sessional courses.  
- **Auth**: ✅  
- **Response Body**: 
```
    [
        {
            "initial": "MMA",
            "name": "Dr. Md. Mashroor Ali",
            "email_time": "2023-05-01 22:03:12",
            "status": "Submitted", ...
        }, ...
    ]
``` 
- **Status**: 200  

### Finalize Sessional Assignment
- **HTTP Method**: POST  
- **Endpoint**: `/v1/assign/sessional/finalize`  
- **Description**: Complete the sessional course assignment process.  
- **Auth**: ✅  
- **Response Body**: `{"message": "Sessional schedule done"}`  
- **Status**: 200  

### Resend Sessional Assignment Email
- **HTTP Method**: POST  
- **Endpoint**: `/v1/assign/sessional/mai1/{initial}`  
- **Description**: Resend email to teachers who haven't submitted the sessional form.  
- **Auth**: ✅  
- **Response Body**: `{"message": "Emailed successfully"}`  
- **Status**: 200  

### Get Current Sessional Assignment
- **HTTP Method**: GET  
- **Endpoint**: `/v1/assign/sessional/current/{section}`  
- **Description**: Get the current sessional assignment of a section.  
- **Auth**: ✅   
- **Response Body**: 
```
    [
        {
            "initial": "MMA",
            "name": "Dr. Md. Mashroor Ali",
            "email_time": "2023-05-01 22:03:12",
            "status": "Submitted", ...
        }, ...
    ]
``` 
- **Status**: 200  

---

## Schedules

### Get Fixed Theory Schedule
- **HTTP Method**: GET  
- **Endpoint**: `/v1/schedule/theory/fixed/{section}`  
- **Description**: Get the fixed time schedule for non-department courses.  
- **Auth**: ✅   
- **Response Body**: 
```
    [{
        "day": "Saturday",
        "time": "8",
        "course_id": "CT",
        "course_title": "Class Test",
        ...
    }, ...]
``` 
- **Status**: 200  

### Set Fixed Theory Schedule
- **HTTP Method**: POST  
- **Endpoint**: `/v1/schedule/theory/fixed/{section}/{day}/{time}`  
- **Description**: Set the fixed time for non-department courses.  
- **Auth**: ✅  
- **Request Body**: 
```
    {
        "course_id": "CT",
        "course_title": "Class Test",
        ...
    }
``` 
- **Response Body**: `{"message": "Fixed Schedule set successfully"}`  
- **Status**: 201  

### Reset Fixed Theory Schedule
- **HTTP Method**: DELETE  
- **Endpoint**: `/v1/schedule/theory/fixed/{section}/{day}/{time}`  
- **Description**: Reset the fixed time for non-department courses.  
- **Auth**: ✅ 
- **Response Body**: `{"message": "Fixed Schedule reset successfully"}`  
- **Status**: 200  

### Initiate Theory Scheduling
- **HTTP Method**: POST  
- **Endpoint**: `/v1/schedule/theory/initiate`  
- **Description**: Initialize the theory scheduling stage.  
- **Auth**: ✅  
- **Response Body**: `{"message": "Theory schedule initiated"}`  
- **Status**: 200  

### Get Theory Scheduling Status
- **HTTP Method**: GET  
- **Endpoint**: `/v1/schedule/theory/status`  
- **Description**: Get the form submission status of teachers.  
- **Auth**: ✅  
- **Response Body**: 
```
    [
        {
            "initial": "MMA",
            "name": "Dr. Md. Mashroor Ali",
            "email_time": "2023-05-01 22:03:12",
            "status": "Submitted", ...
        }, ...
    ]
```  
- **Status**: 200  

### Finalize Theory Scheduling
- **HTTP Method**: POST  
- **Endpoint**: `/v1/schedule/theory/finalize`  
- **Description**: Complete the theory scheduling process.  
- **Auth**: ✅  
- **Response Body**: `{"message": "Theory schedule done"}`  
- **Status**: 200  

### Resend Theory Scheduling Email
- **HTTP Method**: POST  
- **Endpoint**: `/v1/schedule/theory/mail/{initial}`  
- **Description**: Resend email to teachers who haven't submitted the form.  
- **Auth**: ✅  
- **Response Body**: `{"message": "Emailed successfully"}`  
- **Status**: 200  

### Get Current Theory Scheduling
- **HTTP Method**: GET  
- **Endpoint**: `/v1/schedule/theory/current/{section}`  
- **Description**: Get the current theory scheduling of a section.  
- **Auth**: ✅  
- **Response Body**: 
```
    [
        {
            "initial": "MMA",
            "name": "Dr. Md. Mashroor Ali",
            "email_time": "2023-05-01 22:03:12",
            "status": "Submitted", ...
        }, ...
    ]
```  
- **Status**: 200  

### Toggle Auto Email
- **HTTP Method**: PATCH  
- **Endpoint**: `/v1/schedule/theory/mail/auto`  
- **Description**: Toggle automatic email sending after teacher submissions.  
- **Auth**: ✅  
- **Request Body**: `{"auto_mail": true}`  
- **Response Body**: `{"message": "Auto email-ing is on"}`  
- **Status**: 200  

### Set Sessional Schedule
- **HTTP Method**: POST  
- **Endpoint**: `/v1/schedule/sessional/slot/{section}/{day}/{time}`  
- **Description**: Set the schedule for sessional courses.  
- **Auth**: ✅  
- **Request Body**: 
```
    {
        "course_id": "CT",
        "course_title": "Class Test",
        ...
    }
```  
- **Response Body**: 
```
    {
        "message": "Sessional Schedule set",
        "conflict": {
        "room": [{"room": "401", date: "Sat", "time":
        2}, ...],
        "teacher": [{"inital": "MMA", date: "Sat",
        "time": 2}, ...]
        }
    }
```  
- **Status**: 200  

### Reset Sessional Schedule
- **HTTP Method**: DELETE  
- **Endpoint**: `/v1/schedule/sessional/slot/{section}/{day}/{time}`  
- **Description**: Reset the schedule for sessional courses.  
- **Auth**: ✅   
- **Request Body**:
```
    {
        "day": "Saturday",
        "time": "8",
        "course_id": "CT",
        "course_title": "Class Test",
        ...
    }
```
- **Response Body**: `
```
    {
        "message": "Sessional Schedule reset",
        "conflict": {
        "room": [{"room": "401", date: "Sat", "time":
        2}, ...],
        "teacher": [{"inital": "MMA", date: "Sat",
        "time": 2}, ...]
        }
    }
```  
- **Status**: 200  

### Get Unscheduled Sessional Courses
- **HTTP Method**: GET  
- **Endpoint**: `/v1/schedule/sessional/unassigned/{section}`  
- **Description**: Get the list of unscheduled sessional courses.  
- **Auth**: ✅  
- **Response Body**: 
```
    [
        {
            "course_id": "CSE 102",
            "name": "Basic C Programming Sessional",
            "type": "Sessional",
            "batch": 21,
        }, ...
    ]
```  
- **Status**: 200  

### Get Scheduled Sessional Courses
- **HTTP Method**: GET  
- **Endpoint**: `/v1/schedule/sessional/current/{section}`  
- **Description**: Get the list of currently scheduled sessional courses.  
- **Auth**: ✅   
- **Response Body**: 
```
    [
        {
            "course_id": "CSE 102",
            "name": "Basic C Programming Sessional",
            "type": "Sessional",
            "batch": 21,
        }, ...
    ]
```  
- **Status**: 200  

---

## Lab Rooms

### Initiate Lab Room Assignment
- **HTTP Method**: POST  
- **Endpoint**: `/v1/labroom/initiate`  
- **Description**: Initialize the lab room assignment process.  
- **Auth**: ✅  
- **Response Body**: `{"message": "Lab room assign initiated"}`  
- **Status**: 200  

### Get Room Constraints
- **HTTP Method**: GET  
- **Endpoint**: `/v1/labroom/constraint/{room_no}`  
- **Description**: Get constraints of a room.  
- **Auth**: ✅ 
- **Response Body**: 
```
    {
        "possible": [
        {
        "id": "CSE 102",
        "title": "C Programming Sessional", ...
        }, ...
        ], "impossible": [...]
    }
```
- **Status**: 201  

### Add Room Constraint
- **HTTP Method**: POST  
- **Endpoint**: `/v1/labroom/constraint/{room_no}`  
- **Description**: Add a constraint to a room.  
- **Auth**: ✅ 
- **Request Body**: 
```
    {
        "possible": [
        {
        "id": "CSE 102",
        "title": "C Programming Sessional", ...
        }, ...
        ], "impossible": [...]
    }
``` 
- **Response Body**: `{"message": "Constraint added to room 402"}`  
- **Status**: 201  

### Assign sessional to Room
- **HTTP Method**: POST  
- **Endpoint**: `/v1/labroom/assign`  
- **Description**: Assign sessional to a room.  
- **Auth**: ✅  
- **Response Body**: 
```
    [
        {
            "room_no":"402",
            "name": "PL Lab",
            "frequency":"4"
        }, ...
    ]
``` 
- **Status**: 200  

### View Room Assignments
- **HTTP Method**: GET  
- **Endpoint**: `/v1/labroom/view-assignment`  
- **Description**: Show assignments of rooms.  
- **Auth**: ✅  
- **Response Body**: 
```
    [
        {
            "room_no":"402",
            "name": "PL Lab",
            "frequency":"4",
            "assignments": [
            {"day": "Sat", "time": 11, course: "CSE 102"},
            ...]
        }, ...
    ]
```
- **Status**: 200  

### Confirm Room Assignment
- **HTTP Method**: POST  
- **Endpoint**: `/v1/labroom/confirm`  
- **Description**: Confirm the room assignment.  
- **Auth**: ✅  
- **Response Body**: `{"message": "Lab room assignment done"}`  
- **Status**: 201  

---

## Routines

### Generate Routine from Partial Data
- **HTTP Method**: POST   
- **Endpoint**: `/v1/routine/generate-dynamic`  
- **Description**: Generate a partial routine from current available data.  
- **Auth**: ✅
- **Response Body**: 
```
    {
        "message": "Partial routine generated",
        "warnings": [
            {
                "course_id": "CSE102",
                "issue": "No full-time teacher assigned"
            },
            ...
        ]
    }
```
- **Status**: 200

### Generate Final Routine
- **HTTP Method**: POST  
- **Endpoint**: `/v1/routine/generate-final`  
- **Description**: Generate the final routine.  
- **Auth**: ✅
- **Response Body**: `{"message": "Routine has been generated"}`  
- **Status**: 200

### Get Student Routine
- **HTTP Method**: GET  
- **Endpoint**: `/v1/routine/forstudents/{section}`  
- **Description**: Get the generated routine from a student's perspective.  
- **Auth**: ✅
- **Response Body**: 
```
    [
        {
            "day":"sun",
            "time":"8:00",
            "course":"cse201"
            "teacher": ["MMA", "AKMAR"]
        },{...},...
    ]
```
- **Status**: 200 

### Notify Teachers on Routine Change
- **Endpoint**: /v1/routine/notify-change
- **Method**: POST
- **Description**: Send email notifications to teachers whose routine has changed.
- **Auth**: ✅
- **Request Body**:
```
    {
        "changes": [
            {
            "teacher_initial": "MMA",
            "day": "Sunday",
            "time": "10:00",
            "old_course": "CSE101",
            "new_course": "CSE202"
            },
            ...
        ]
    }
```
- **Response Body**:
```
    {
        "message": "Notifications sent to affected teachers"
    }
```
- **Status**: 200 

### Get Teacher Routine
- **HTTP Method**: GET  
- **Endpoint**: `/v1/routine/forteacher/{initial}`  
- **Description**: Get the generated routine from a teacher's perspective.  
- **Auth**: ✅ 
- **Response Body**:
```
    [
        {
            "day":"sun",
            "time":"8:00",
            "course":"cse201"
            "teacher": ["MMA", "AKMAR"]
        },{...},...
    ]
```
- **Status**: 200  

### Get Room Routine
- **HTTP Method**: GET  
- **Endpoint**: `/v1/routine/forrooms/{room_no}`  
- **Description**: Get the generated routine from a room's perspective.  
- **Auth**: ✅  
- **Response Body**: 
```
    [
        {
            "day":"sun",
            "time":"8:00",
            "course":"cse201"
            "teacher": ["MMA", "AKMAR"]
        },{...},...
    ]
``` 
- **Status**: 200  

### Email Teachers Routine
- **HTTP Method**: POST  
- **Endpoint**: `/v1/routine/mail-teachers`  
- **Description**: Send the final course assignment to teachers via email.  
- **Auth**: ✅  
- **Response Body**: `{"message": "Email sent"}`  
- **Status**: 200
