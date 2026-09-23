import axios from "axios";
import { api_url } from ".";

export const getVersions = () => {
    return axios.get(api_url("/versions")).then((res) => res.data);
};

export const saveVersion = (versionName) => {
    return axios.post(api_url("/versions/save"), { versionName }).then((res) => res.data);
};

export const loadVersion = (filename) => {
    return axios.post(api_url(`/versions/load/${filename}`)).then((res) => res.data);
};

export const deleteVersion = (filename) => {
    return axios.delete(api_url(`/versions/${filename}`)).then((res) => res.data);
};

export const downloadVersion = (filename) => {
    return axios({
        method: 'GET',
        url: api_url(`/versions/download/${filename}`),
        responseType: 'blob', // Important for file downloads
    }).then((response) => {
        // Create blob link to download
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        return { message: `${filename} downloaded successfully.` };
    });
};

export const uploadVersion = (file, versionName = null) => {
    const formData = new FormData();
    formData.append('dumpFile', file);
    if (versionName) {
        formData.append('versionName', versionName);
    }

    return axios.post(api_url("/versions/upload"), formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    }).then((res) => res.data);
};
