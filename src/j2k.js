import getPath from './path.js';
export default (function () {
	const queue = [];
	const worker = new Worker(getPath('j2k-worker.js'));
	let initialized = new Promise ((resolve, reject) => {
		queue.push({ resolve, reject });
	});
	worker.onmessage = (evt) => {
		if (!initialized && evt.data.initialized) {
			queue.shift().resolve(initialized = true);
		} else {
			if (evt.data) {
				queue.shift().resolve({
					idx: evt.data.idx,
					i16: new Int16Array(evt.data.buf)
				});
			} else {
				queue.shift().reject(evt.data);
			}
		}
	}
	return async function (data) {
		if (initialized !== true) await initialized;
		return new Promise((resolve, reject) => {
			if (!(data.buf instanceof ArrayBuffer)) {
				reject('Input not a buffer');
			} else {
				queue.push({ resolve, reject });
				worker.postMessage(data, [data.buf]);
			}
		});
	};
}());
