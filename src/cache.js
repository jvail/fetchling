export default function () {

	const d = [];

	return {
		add: (h) => d.push(h),
		get: (url) => d.find(h => h.url === url)
	};

}
