export default async (url, srt, end) => {
	try {
		let res = await fetch(url, {
				method: 'GET',
				mode: 'cors',
				headers: {
					Range: `bytes=${srt}-${end}`
				}
			});
		if (res.status === 206 /* partial */) return res.arrayBuffer();
		if (res.status === 416 /* exceeds length */) return new ArrayBuffer(0);
		Promise.reject(new Error(`Request failed (${res.status})`));
	} catch (err) {
		if (res.status === 416) return new ArrayBuffer(0);
		Promise.reject(err);
	}
};
