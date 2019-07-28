import { fetchling } from '../dist/fetchling';
import fetch from 'node-fetch';
global.fetch = fetch;

(async () => {
    try {
        const header = await fetchling.header('http://localhost:5000');
    } catch (err) {
        console.log(err);
    }
})();

(async () => {
    try {
        const header = await fetchling.header('http://localhost:5000/TCI.jp2');
        const tile = await fetchling.tiles(header, [0]);
    } catch (err) {
        console.log(err);
    }
})();
