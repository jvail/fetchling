export default (url) => {
	return new Promise((resolve, reject) => {
		/* apparently fetch does not expose all response headers */
		try {
			let req = new XMLHttpRequest();
			req.onload = () => {
				if (req.status === 200) {
					resolve({
						status: req.status,
						ranges: (req.getResponseHeader('Accept-Ranges') && req.getResponseHeader('Accept-Ranges').indexOf('bytes') >= 0),
						type: req.getResponseHeader('Content-Type'),
						length: +req.getResponseHeader('Content-Length')
					});
				} else {
					reject(new Error(`Request failed (${req.status})`));
				}
			};
			req.onerror = () => {
				reject(new Error(`Request failed (${req.status})`));
			};
			req.open('HEAD', url);
			req.send();
		} catch (err) {
			reject(err);
		}
	});
};
