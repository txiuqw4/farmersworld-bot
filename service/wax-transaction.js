import axios from "./axios.js";

const base_api = [
    "https://wax.eosrio.io",
    "https://wax.greymass.com"
];

function getRandom(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

export default async function getActions(trxId) {
    const mockIp = `${getRandom(1, 255)}.${getRandom(1, 255)}.${getRandom(1,255)}.${getRandom(1, 255)}`;
    const index = getRandom(0, base_api.length);
    const url = `${base_api[index]}/v1/history/get_transaction`;

    const payload = {
        id: trxId,
        block_num_hint: 0,
    };

    return axios
        .post(url, payload, {
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
