import query from "./service/wax-query.js";
import historyTransaction from "./service/wax-transaction.js";
import { mine, repair, recover, withdraw } from "./farmersworld.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const accounts = require("./accounts.json");
const MAX_DELAY = 3600; // 1 hour
const {
    REPAIR_IF_DURABILITY_LOWER,
    RECOVER_IF_ENERGY_LOWER,
    LOWEST_ENERGY,
    PAYBW,
    MINIMUM_FEE,
    MINIMUN_WITHDRAW,
    TIMEZONE,
} = require("./config.json");

function queryData(wallet) {
    return query({
        json: true,
        code: "farmersworld",
        scope: "farmersworld",
        table: "tools",
        lower_bound: wallet,
        upper_bound: wallet,
        index_position: 2,
        key_type: "i64",
        limit: "100",
        reverse: false,
        show_payer: false,
    });
}

/*
 * Check withdraw fee is equal target
 *
 * @param target number
 *
 * @return bool
 */
async function isWithdrawFeeEqual(target = 5) {
    const data = await query({
        json: true,
        code: "farmersworld",
        scope: "farmersworld",
        table: "config",
        lower_bound: null,
        upper_bound: null,
        index_position: 1,
        key_type: "",
        limit: "100",
        reverse: false,
        show_payer: false,
    });

    if (!data || data.rows.length === 0) return false;

    console.log("Current withdraw fee", data.rows[0].fee);

    return data.rows[0].fee === target;
}

/*
 * Get reward after claim
 *
 * @return string
 */
async function logClaim(trxId) {
    try {
        const trans = await historyTransaction(trxId);
        const traces = trans.traces.find((r) => r.act.name === "logclaim");
        const rewards = traces.act.data.rewards;

        return rewards && rewards instanceof Array ? rewards.join(" - ") : "";
    } catch {
        return "";
    }
}

async function delay(ms = 1000) {
    return new Promise((r) => setTimeout(r, ms));
}

async function countdown(seconds) {
    for (let i = seconds; i > 0; i--) {
        process.stdout.write("\r");
        process.stdout.write(` -> ${i} seconds remaining...`);

        await delay(1000);
    }

    process.stdout.write("\n");
}

async function getAccount(wallet) {
    const data = await query({
        json: true,
        code: "farmersworld",
        scope: "farmersworld",
        table: "accounts",
        lower_bound: wallet,
        upper_bound: wallet,
        index_position: 1,
        key_type: "",
        limit: "100",
        reverse: false,
        show_payer: false,
    });

    return data && data.rows.length > 0 ? data.rows[0] : null;
}

/*
 * Make claim
 *
 * @param account object
 * @param paybw object
 *
 * @return object {nextAvailability: number, tools: Array{assetId: string, wallet: string, privateKey: string, currentDurability: number}}
 */
async function claim(account, paybw) {
    const wallet = account.wallet;
    console.log("run with wallet ", wallet);

    const data = await queryData(wallet);
    if (!data || data.rows.length === 0)
        return Math.floor(Date.now() / 1000) + 10;

    let nextAvailability = Math.floor(Date.now() / 1000 + MAX_DELAY);
    let tools = [];
    let assetIds = [];

    for (const row of data.rows) {
        if (row.current_durability <= REPAIR_IF_DURABILITY_LOWER)
            tools.push({
                assetId: row.asset_id,
                currentDurability: row.current_durability,
                durability: row.durability,
                ...account,
            });
        if (row.current_durability === 0) continue;

        let assetId = row.asset_id;
        let difftime = Math.ceil(row.next_availability - Date.now() / 1000);

        console.log(
            "asset_id",
            assetId,
            "diff",
            difftime,
            "seconds",
            "current durability",
            row.current_durability
        );

        if (difftime < 0) assetIds.push(assetId);
        else if (nextAvailability > row.next_availability)
            nextAvailability = row.next_availability;
    }

    if (assetIds.length > 0) {
        for (const assetId of assetIds) {
            console.log("claim with asset_id", assetId);

            const result = await mine(
                {
                    ...account,
                    assetId,
                },
                paybw
            );

            await delay(1000);

            const reward = await logClaim(result.transaction_id);
            console.log("Log claim", reward);
        }

        await delay(1000);
    }

    return {
        nextAvailability,
        tools,
    };
}

/*
 * Fetch account infomation
 *
 * @return array
 */
async function syncAccounts() {
    const data = [];

    for (const account of accounts) {
        const r = await getAccount(account.wallet);
        data.push({
            ...r,
            ...account,
        });
        await delay(500);
    }

    return data;
}

async function fetchBalanceOf(wallet, type) {
    const account = await getAccount(wallet);
    return parseBalance(
        account.balances.find((r) => r.toUpperCase().endsWith(type))
    );
}

function parseBalance(value) {
    return Number(value.split(" ")[0]);
}

/*
 * logic withdraw, repair, recover
 *
 * @param tools Array[]
 * @param paybw object | null
 *
 * @return void
 */
async function anotherTask(tools, paybw = null) {
    try {
        // TASK: repair
        for (const tool of tools) {
            const gold = await fetchBalanceOf(tool.wallet, "GOLD");
            const consumed = (tool.durability - tool.currentDurability) / 5;
            console.log("Repair", tool.assetId, "gold consumed", consumed);
            if (gold >= consumed) await repair(tool, paybw);
            else console.log("Not enough gold to repair.");
            await delay(500);
        }

        const canWithdraw = await isWithdrawFeeEqual(MINIMUM_FEE);
        const fwAccounts = await syncAccounts();

        for (const account of fwAccounts) {
            if (account.energy <= RECOVER_IF_ENERGY_LOWER) {
                let energy = account.max_energy - account.energy;
                let consumed = energy / 5;
                const food = parseBalance(
                    account.balances.find((r) =>
                        r.toUpperCase().endsWith("FOOD")
                    )
                );

                if (account.energy <= LOWEST_ENERGY && food < consumed) {
                    consumed = Math.floor(food);
                    energy = consumed * 5;
                }

                if (food >= consumed) {
                    console.log("Recover", account.wallet, energy, "energy");
                    await recover(account, energy, paybw);
                } else {
                    console.log("Not enough food to recover.");
                    continue;
                }
            }

            if (canWithdraw) {
                const quantities = account.balances.filter((r) => {
                    const amount = parseBalance(r);
                    return !r.endsWith("GOLD") && amount > MINIMUN_WITHDRAW;
                });

                if (quantities.length > 0) {
                    console.log("Withdrawing...");
                    await withdraw(account, quantities, MINIMUM_FEE, paybw);
                }
            }
        }
    } catch (e) {
        console.log("[ERROR] another task error -", e.message);
    }
}

async function main(paybw) {
    let nextClaim = Math.floor(Date.now() / 1000 + MAX_DELAY);
    let tools = [];

    for (const account of accounts) {
        try {
            const result = await claim(account, paybw);

            if (nextClaim > result.nextAvailability) {
                nextClaim = result.nextAvailability;
            }

            tools = tools.concat(result.tools);
        } catch (e) {
            // an error occus
            console.log("[Error] -", e);
            nextClaim = Math.floor(Date.now() / 1000) + 1;
        }
    }

    await anotherTask(tools, paybw);

    console.log(
        "Next claim at",
        new Date(nextClaim * 1000).toLocaleString("en-US", {
            timeZoneName: "short",
            timeZone: TIMEZONE,
        })
    );

    await countdown(nextClaim - Math.floor(Date.now() / 1000));
}

export default async function () {
    let paybw = null;
    if (PAYBW) {
        paybw = require("./paybw.json");
    }

    console.log("working...");

    while (true) {
        try {
            await main(paybw);
        } catch {}
    }
}
