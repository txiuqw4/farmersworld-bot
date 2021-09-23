import axios from "./axios.js";

const endpoint = "https://wax.eosrio.io";

function getRandom(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

export default async function getActions(payload) {
    const mockIp = `${getRandom(1, 255)}.${getRandom(1, 255)}.${getRandom(1,255)}.${getRandom(1, 255)}`;
    const qs = Object.keys(payload)
        .map((key) => `${key}=${payload[key]}`)
        .join("&");

    const url = `${endpoint}/v2/history/get_actions?${qs}`;

    return axios
        .get(url, {
            headers: {
                "X-Forwarded-For": mockIp,
            },
            timeout: 15000,
        })
        .then((resp) => {
            if (resp.data) {
                return resp.data;
            } else {
                throw "An error occus";
            }
        });
}
