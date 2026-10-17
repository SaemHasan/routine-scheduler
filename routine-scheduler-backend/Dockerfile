# Use a more complete Node.js image with required dependencies
FROM node:18

# Set the working directory in the container
WORKDIR /app

# pg_dump refuses to dump a newer server, so this must be at least the Neon
# database's Postgres major version
ARG PG_MAJOR=18

# Install required dependencies for PDF generation, and the Postgres client
# for database backups from the PostgreSQL apt repository (Debian's is older)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl && \
    install -d /usr/share/postgresql-common/pgdg && \
    curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
        https://www.postgresql.org/media/keys/ACCC4CF8.asc && \
    . /etc/os-release && \
    echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list && \
    apt-get update && apt-get install -y --no-install-recommends \
    libfreetype6 \
    libfontconfig1 \
    fontconfig \
    postgresql-client-${PG_MAJOR} && \
    rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install all dependencies
RUN npm install --production

# Copy the rest of the application code to the working directory
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Define the command to run your app
CMD ["npm", "start"]