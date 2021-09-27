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
