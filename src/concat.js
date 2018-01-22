export default (bufs) => {
	return bufs.reduce((a, b) => {
		let alen = a.byteLength, blen = 0;
		if (Array.isArray(b)) {
			blen = b.length;
		} else {
			if (b.array instanceof Uint8Array) {
				b = b.array;
				blen = b.byteLength;
			} else if (b instanceof ArrayBuffer) {
				b = new Uint8Array(b)
				blen = b.byteLength;
			}
		}
		let c = new Uint8Array(alen + blen);
		c.set(a, 0);
		c.set(b, alen);
		return c;
	}, new Uint8Array()).buffer;
}
