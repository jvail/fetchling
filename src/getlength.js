export default async (url) => {
	try {
		const len = +(await fetch(url, {
			method: 'HEAD',
			mode: 'cors',
			cache: 'no-store'
		})).headers.get('Content-Length');
		if (Number.isFinite(len)) {
			return len;
		} else {
			throw Error(`HEAD request to "${url}" did report content length of image.`);
		}
	} catch (err) {
		return Promise.reject(err);
	}
};
