import { Api, JsonRpc, RpcError } from "eosjs";
import { JsSignatureProvider } from "eosjs/dist/eosjs-jssig.js";
import fetch from "node-fetch";
import { TextEncoder, TextDecoder } from "util";
const rpcEndPoint = "https://wax.greymass.com";
const MAX_RETRIES = 3;

/*
 * Make a transact
 *
 * @param privateKey string
 * @param action array
 * @param paybw object | null
 * @return Promise
 */
function makeTransaction(privateKey, actions, paybw = null) {
    const privateKeys = [privateKey];
    const actionsClone = actions.map(r => r); 

    // insert noop action
    if (paybw) {
        privateKeys.push(paybw.privateKey);
        actionsClone.unshift({
            account: "boost.wax",
            name: "noop",
            authorization: [
                {
                    actor: paybw.wallet,
                    permission: "active",
                },
            ],
            data: null,
        });
    }

    const signatureProvider = new JsSignatureProvider(privateKeys);
    const rpc = new JsonRpc(rpcEndPoint, { fetch });
    const api = new Api({
        rpc,
        signatureProvider,
        textDecoder: new TextDecoder(),
        textEncoder: new TextEncoder(),
    });

    return api.transact(
        {
            actions: actionsClone,
        },
        {
            blocksBehind: 3,
            expireSeconds: 30,
        }
    );
}

/*
 * Retry transact
 *
 * @param privateKey string
 * @param actions array
 * @param paybw object | null
 * @param tries number default 0
 *
 * @return Promise
 */
export default async function transact(privateKey, actions, paybw = null, tries = 0) {
    let result;
    try {
        result = await makeTransaction(privateKey, actions, paybw);
        console.log(
            "[Finished] - Successful - Transaction id",
            result.transaction_id
        );
    } catch (e) {
        console.log("[ERROR] -", e.message);
        if (tries < MAX_RETRIES)
            return transact(privateKey, actions, paybw, tries + 1);

        throw e;
    }

    return result;
}
