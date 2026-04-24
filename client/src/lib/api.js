import axios from "axios";

const API = axios.create({
  baseURL: "https://novacentral-production.up.railway.app/api",
});

export default API;