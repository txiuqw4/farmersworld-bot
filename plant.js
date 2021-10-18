import { cropclaim, queryData, recover, tables } from "./farmersworld.js";
import { delay, calcNextClaim, getClaimableAssets, parseBalance, toCamelCase } from "./utils.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const accounts = require("./accounts.json");
const { TIMEZONE, PAYBW } = require("./config.json");
const ENERGY_PER_FOOD = 5;
const PLANT_CHARGE_TIME = 14400; // 4 hours

let cropconf;

async function water(plant, paybw = null) {
    console.log("Watering", plant.assetId);
    await cropclaim(plant, paybw);
}

async function getPlantConf() {
    const data = await queryData("cropconf", null, 1);
    return (
        data.rows
            .map((r) => toCamelCase(r))
            // map table
            .reduce((a, c) => {
                a[c.templateId] = c;
                return a;
            }, {})
    );
}

async function recoverEnergy(plants, paybw = null) {
    if (plants.length === 0) return;
    const wallets = new Set(plants.map((r) => r.wallet));

    for (const wallet of wallets) {
        const data = await queryData("accounts", wallet, 1);
        if (!data || data.rows.length === 0) continue;
        const account = toCamelCase(data.rows[0]);
        const food = parseBalance(
            account.balances.find((r) => r.toUpperCase().endsWith("FOOD"))
        );

        const consumedEnergy = plants
            .filter((r) => r.wallet === wallet)
            .reduce((a, c) => a + cropconf[c.templateId].energyConsumed, 0);

        console.log("Watering consume", consumedEnergy, "energy");

        if (account.energy < consumedEnergy) {
            let consumedFood = Math.floor(
                (account.maxEnergy - account.energy) / ENERGY_PER_FOOD
            );
            consumedFood =
                consumedFood < food ? consumedFood : Math.floor(food);
            const energy = consumedFood * ENERGY_PER_FOOD;

            console.log("Recover", wallet, energy, "energy");
            await recover(
                accounts.find((r) => r.wallet === wallet),
                energy,
                paybw
            );
            await delay(400);
        }
    }
}

async function main(paybw = null) {
    const plants = await tables("crops", accounts);
    const nextClaim = calcNextClaim(plants, PLANT_CHARGE_TIME);
    const difftime = Math.ceil(nextClaim - Date.now() / 1000);

    if (difftime > 0) {
        console.log(
            "Next cropclaim at",
            new Date(nextClaim * 1000).toLocaleString("en-US", {
                timeZoneName: "short",
                timeZone: TIMEZONE,
            })
        );

        await delay(difftime * 1000);
    }

    const claimable = getClaimableAssets(plants);

    await recoverEnergy(claimable, paybw);

    for (const plant of claimable) {
        await water(plant, paybw);
        await delay(400);
    }
}

export default async function () {
    let paybw = null;
    if (PAYBW) {
        paybw = require("./paybw.json");
    }

    // load cropconf
    cropconf = await getPlantConf();

    while (true) {
        try {
            await main(paybw);
        } catch (e) {
            // an error occus
            console.log("[Error] -", e);
        }
    }
}
