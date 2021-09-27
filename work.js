import query from "./service/wax-query.js";
import historyTransaction from "./service/wax-transaction.js";
import { mine, repair, recover, withdraw } from "./farmersworld.js";
import { toCamelCase } from "./utils.js";
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
 * Fetch tools from contract
 *
 * @return Array
 */
async function fetchTools() {
    let tools = [];

    for (const account of accounts) {
        console.log("run with wallet", account.wallet);
        const data = await queryData(account.wallet);
        tools = tools.concat(
            data
                ? data.rows.map((r) => ({ ...toCamelCase(r), ...account }))
                : []
        );
    }

    return tools;
}

function calcNextClaim(tools) {
    return tools.reduce(function (min, r) {
        return min >= r.nextAvailability ? r.nextAvailability : min;
    }, Math.floor(Date.now() / 1000 + MAX_DELAY));
}

function getClaimableTools(tools) {
    return tools.filter(
        (r) => Math.ceil(r.nextAvailability - Date.now() / 1000) <= 0
    );
}

function getRepairTools(tools) {
    return tools.filter(
        (r) => r.currentDurability <= REPAIR_IF_DURABILITY_LOWER
    );
}

async function makeMine(tool, paybw) {
    console.log("claim with asset_id", tool.assetId);
    const result = await mine(tool, paybw);

    await delay(1000);

    const reward = await logClaim(result.transaction_id);
    console.log("Log claim", reward);
}

function logDurability(tools) {
    for (const row of tools) {
        let difftime = Math.ceil(row.nextAvailability - Date.now() / 1000);

        console.log(
            "asset_id",
            row.assetId,
            "diff",
            difftime,
            "seconds",
            "current durability",
            row.currentDurability
        );
    }
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
    let tools = await fetchTools();
    logDurability(tools);

    let claimable = getClaimableTools(tools);
    for (const tool of claimable) {
        await makeMine(tool, paybw);
        await delay(1000);
    }

    const repairTools = getRepairTools(tools);
    await anotherTask(repairTools, paybw);

    const nextClaim = calcNextClaim(tools);
    const difftime = Math.ceil(nextClaim - Date.now() / 1000);
    if (difftime <= 0) return main(paybw);

    console.log(
        "Next claim at",
        new Date(nextClaim * 1000).toLocaleString("en-US", {
            timeZoneName: "short",
            timeZone: TIMEZONE,
        })
    );

    await countdown(difftime);
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
        } catch (e) {
            // an error occus
            console.log("[Error] -", e);
        }
    }
}
