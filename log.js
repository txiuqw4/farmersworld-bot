const orgLog = console.log;
const logs = [];
const MAX_LINES = 100;

console.log = function (...oths) {
    oths.unshift("[-]");
    orgLog(...oths);
    logs.unshift(oths.join(" "));

    if (logs.length > MAX_LINES) logs.pop();
};

export default logs;
