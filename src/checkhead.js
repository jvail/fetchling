export default async (url) => {
	try {
		let res = await fetch(url, {
				method: 'GET',
				headers: {
					Range: `bytes=0-1`
				}
			});
		return {
			type: res.headers.get('Content-Type'),
			length: (res.headers.get('Content-Length') ||
				res.headers.get('Content-Range')) || Infinity
		};
	} catch (err) {
		return Promise.reject(err);
	}
};
