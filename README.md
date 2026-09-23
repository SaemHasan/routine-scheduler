# Routine Scheduler

Routine Scheduler is a full-stack web application that helps educational institutions efficiently manage and automate class schedules. Built with a React frontend and an Express backend, it supports user authentication, routine conflict resolution, and integration with PostgreSQL for reliable data storage.

## Project Overview

This application solves the complex problem of creating academic schedules while avoiding conflicts in teacher assignments, room allocations, and time slots. It provides an intuitive interface for administrators to manage schedules efficiently.

## Features

- User authentication and role management
- Interactive dashboard for schedule management
- Automatic conflict detection and resolution
- Teacher preference submission system
- Room and resource allocation
- PDF report generation
- Responsive design for desktop and mobile use

## Tech Stack

- **Frontend**: React.js, Bootstrap, SCSS
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT
- **Containerization**: Docker
- **PDF Generation**: HTML/CSS templates

## Project Setup

### Prerequisites

- Docker and Docker Compose

> **New to Docker?** Check out this [Docker Tutorial](https://github.com/AfzalHossan-2005021/Tutorial/blob/main/Docker_Tutorial.md) to learn about Docker and Docker Compose.

### Installation and Setup

1. Clone the repository:
   ```bash
   git clone --recurse-submodules https://github.com/AfzalHossan-2005021/routine-scheduler.git
   cd routine-scheduler
   ```

2. Create a `.env` file following the given `.env.example`

3. Run the application using Docker Compose:
   ```bash
   docker-compose up --build
   ```

4. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4200

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Thanks to all contributors who have helped improve this project
- Inspired by the need for better academic scheduling systems