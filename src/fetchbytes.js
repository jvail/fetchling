export default async (url, srt, end) => {
	try {
		let res = await fetch(url, {
				method: 'GET',
				mode: 'cors',
				headers: {
					Range: `bytes=${srt}-${end}`
				}
			});
		if (res.ok) {
			return res.arrayBuffer();
		} else {
			Promise.reject(new Error(`Request failed (${res.status})`));
		}
	} catch (err) {
		Promise.reject(err);
	}
};
