export default async (url) => {
	try {
		return (await fetch(url, {
			method: 'HEAD',
			mode: 'cors',
			cache: 'no-store'
		})).headers.get('Content-Length') || Infinity;
	} catch (err) {
		return Promise.reject(err);
	}
};
