import dotenv from 'dotenv'
dotenv.config()
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.CONNECTION_URL,
    ssl: {
        rejectUnauthorized: false
    },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
})

// Neon closes idle connections when the compute scales to zero. Without this
// listener the pool's 'error' event is unhandled and crashes the process; the
// pool drops the dead client and opens a new one on the next query.
pool.on('error', (err) => {
    console.error('Idle database client error:', err.message)
})

const connect = async () => {
    return await pool.connect()
}

export { connect }
