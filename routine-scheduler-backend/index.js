import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
dotenv.config()

import route from './route.js';
import errorHandler from './src/config/error-handle.js';

import { connect } from "./src/config/database.js";
import { initSystemConfigs } from './src/config/init-config.js';

connect()
  .then(() => {
    console.log("Connected to the database ... ");
    // Initialize system configurations
    return initSystemConfigs();
  })
  .then(() => console.log("System configurations initialized..."))
  .catch((err) => console.log(err));

const app = express();
const port = process.env.PORT || 8000;


app.use(cors({
  origin: 'http://localhost:3000', // Allow only the frontend's origin
  credentials: true, // Allow cookies if needed
}));

app.use(express.json());
app.use("/v1", route);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Routine Scheduler listening on port ${port}`);
});
