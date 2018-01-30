export default async (url) => {
	try {
		let res = await fetch(url, {
				method: 'HEAD',
				mode: 'cors',
				cache: 'no-store'
			});
		return {
			type: res.headers.get('Content-Type'),
			length: res.headers.get('Content-Length') || Infinity
		};
	} catch (err) {
		return Promise.reject(err);
	}
};
