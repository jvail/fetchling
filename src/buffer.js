export default function Buffer(data) {
	const d = (data instanceof ArrayBuffer || Array.isArray(data)) ? new Uint8Array(data) : data;
	return Object.freeze({
		ui8: i => d[i],
		ui16: i => (d[i] << 8) + d[i+1],
		ui32: i => (d[i] << 24) + (d[i+1] << 16) + (d[i+2] << 8) + d[i+3],
		setUi8: (i, v) => {
			d[i] = v;
		},
		setUi16: (i, v) => {
			d[i] = v >> 8;
			d[i+1] = v;
		},
		setUi32: (i, v) => {
			d[i] = v >> 24;
			d[i+1] = v >> 16;
			d[i+2] = v >> 8;
			d[i+3] = v;
		},
		array: d,
		arrayBuffer: d.buffer,
		length: d.byteLength,
		len: d.byteLength,
		data: d.buffer,
		slice: (...args) => new Buffer(d.buffer.slice(...args))
	});
}
