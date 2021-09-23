import transact from "./transact.js";

/*
 * make a mine
 *
 * @param inputData object {"wallet": "", "privateKey": "", "assetId": ""}
 * @param paybw object {"wallet": "", "privateKey": ""} | null
 * @return Promise
 */
export function mine(inputData, paybw = null) {
    return transact(
        inputData.privateKey,
        [
            {
                account: "farmersworld",
                name: "claim",
                authorization: [
                    {
                        actor: inputData.wallet,
                        permission: "active",
                    },
                ],
                data: {
                    owner: inputData.wallet,
                    asset_id: inputData.assetId,
                },
            },
        ],
        paybw
    );
}

/*
 * repair a tool
 *
 * @param inputData object {"wallet": "", "privateKey": "", "assetId": ""}
 * @param paybw object {"wallet": "", "privateKey": ""} | null
 * @return Promise
 */
export function repair(inputData, paybw = null) {
    return transact(
        inputData.privateKey,
        [
            {
                account: "farmersworld",
                name: "repair",
                authorization: [
                    {
                        actor: inputData.wallet,
                        permission: "active",
                    },
                ],
                data: {
                    asset_owner: inputData.wallet,
                    asset_id: inputData.assetId,
                },
            },
        ],
        paybw
    );
}

/*
 * recover energy
 *
 * @param inputData object {"wallet": "", "privateKey": ""}
 * @param energy number example 140
 * @param paybw object {"wallet": "", "privateKey": ""} | null
 * @return Promise
 */
export function recover(inputData, energy, paybw = null) {
    return transact(
        inputData.privateKey,
        [
            {
                account: "farmersworld",
                name: "recover",
                authorization: [
                    {
                        actor: inputData.wallet,
                        permission: "active",
                    },
                ],
                data: {
                    owner: inputData.wallet,
                    energy_recovered: energy,
                },
            },
        ],
        paybw
    );
}

/*
 * withdraw
 *
 * @param inputData object {"wallet": "", "privateKey": ""}
 * @param quantities array example ["101.9150 FOOD"]
 * @param fee number example 8
 * @param paybw object {"wallet": "", "privateKey": ""} | null
 * @return Promise
 */
export function withdraw(inputData, quantities, fee, paybw = null) {
    return transact(
        inputData.privateKey,
        [
            {
                account: "farmersworld",
                name: "withdraw",
                authorization: [
                    {
                        actor: inputData.wallet,
                        permission: "active",
                    },
                ],
                data: {
                    owner: inputData.wallet,
                    quantities: quantities,
                    fee: fee,
                },
            },
        ],
        paybw
    );
}
