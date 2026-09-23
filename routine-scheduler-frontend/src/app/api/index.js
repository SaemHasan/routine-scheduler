import axios from 'axios';

export const UNAUTHORIZED = 401, FORBIDDEN = 403;
const BASE_URL = process.env.REACT_APP_BASE_URL || "http://localhost:4200";


export const api_url = (path) => (`${BASE_URL}/v1${path}`);
export const baseUrl = `${BASE_URL}/v1`;

axios.interceptors.request.use( config => {
    const jwt = localStorage.getItem("token")
    if (jwt && config.url.includes(BASE_URL))
        config.headers.Authorization = `Bearer ${jwt}`
    return config
})

// Import and re-export API modules
export * from './auth';
export * from './dashboard';
export * from './db-crud';
export * from './form';
export * from './pdf';
export * from './sessional-schedule';
export * from './theory-assign';
export * from './theory-schedule';
export * from './config';  // Add the config API module