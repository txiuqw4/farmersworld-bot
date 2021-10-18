export function camelize(a) {
    return a.replace(/\_([a-zA-Z])/g, function($1) {
            return $1.toUpperCase();
        })
        .replace(/\_+/g, '');
}

export function toCamelCase(data) {
    return Object.keys(data).reduce((o, k) => {
        o[camelize(k)] = data[k];
        return o;
    }, {});
}

export function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}

export function calcNextClaim(assets, assetChargeTime) {
    return assets.reduce(function (min, r) {
        return min >= r.nextAvailability ? r.nextAvailability : min;
    }, Math.floor(Date.now() / 1000 + assetChargeTime));
}

export function getClaimableAssets(assets) {
    return assets.filter(
        (r) => Math.ceil(r.nextAvailability - Date.now() / 1000) <= 0
    );
}

export function parseBalance(value) {
    return Number(value.split(" ")[0]);
}
