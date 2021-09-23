import axios from "./axios.js";

const base_api = [
    "https://wax.pink.gg",
    "https://wax.cryptolions.io",
    "https://wax.dapplica.io",
    // 'https://api.wax.liquidstudios.io',
    "https://wax.eosn.io",
    "https://api.wax.alohaeos.com",
    "https://wax.greymass.com",
    "https://wax-bp.wizardsguild.one",
    // 'https://apiwax.3dkrender.com',
    "https://wax.eu.eosamsterdam.net",
    // 'https://wax.csx.io',
    "https://wax.eoseoul.io",
    "https://wax.eosphere.io",
    // 'https://api.waxeastern.cn'
];

function getRandom(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

export default async function getTableRows(payload) {
    const index = getRandom(0, base_api.length);
    const url = `${base_api[index]}/v1/chain/get_table_rows`;
    const mockIp = `${getRandom(1, 255)}.${getRandom(1, 255)}.${getRandom(
        1,
        255
    )}.${getRandom(1, 255)}`;

    // get data as json
    payload.json = true;

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
