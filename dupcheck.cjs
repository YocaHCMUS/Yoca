const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'cg_data.json');
const cgData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

const countMap = {};
for (const str of cgData) {
    countMap[str] = (countMap[str] || 0) + 1;
}

const repeated = {};
for (const [str, count] of Object.entries(countMap)) {
    if (count > 1) repeated[str] = count;
}

console.log(repeated);
console.log(Object.keys(repeated).length);