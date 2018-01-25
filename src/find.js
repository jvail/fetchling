import fetchBytes from './fetchbytes.js';
import Buffer from './buffer.js';

export default async function (header, idx) {

	const url = header.url,
		imgLength = header.imgLength,
		tiles = header.tiles,
		BYTES = 1024 * 512;

	async function look(offset) {

		try {
			if (offset < 0) return { pos: -1, idx: -1 };
			let bytes = await fetchBytes(url, offset, offset + BYTES - 1);
			if (bytes.byteLength) {
				let buffer = new Buffer(bytes);
				let pos = 0;
				while (pos < bytes.byteLength - 1) {
					if (buffer.ui16(pos) === 0xff90) {
						let idx = buffer.ui16(pos + 4);
						let len = buffer.ui32(pos + 6);
						if (idx === tiles.length - 1) {
							return { pos: pos + offset, idx };
						} else if (idx < tiles.length - 1) {
							let bytes = await fetchBytes(url, offset + pos + len, offset + pos + len + 2);
							let buffer = new Buffer(bytes);
							if (buffer.ui16(0) === 0xff90) {
								header.tiles[idx].offset = pos + offset;
								header.tiles[idx].size = len;
								return { pos: pos + offset, idx };
							}
						}
					}
					pos++;
				}
				return { pos: 0, idx: -1 };
			}
			return { pos: -1, idx: -1 };
		} catch (err) {
			Promise.reject(err);
		}

	}

	async function seek(ahead, back) {

		try {

			let sot, sots = await Promise.all([look(ahead), look(back)]);
			if (sot = sots.find(s => s.pos > 0 && s.idx <= idx)) {
				return sot.pos;
			} else {
				return await seek(sots[0].idx > idx || sots[0].idx < 0 ? -1 : ahead + BYTES, back - BYTES);
			}

		} catch (err) {
			Promise.reject(err);
		}

	}

	if (tiles[idx].offset > 0) {
		return tiles[idx].offset;
	} else if (idx > 0 && tiles[idx - 1].offset > 0) {
		return tiles[idx - 1].offset + tiles[idx - 1].size;
	} else {
		/* TODO: include idxs ahead as well */
		let pre = tiles.slice(0, idx).reverse().find(t => t.offset > 0).idx;
		if (idx - pre > tiles.length / 8) {
			let stat = tiles.reduce((o, t)=> {
				o.s += t.size;
				o.c += t.size ? 1 : 0;
				return o;
			}, { s: 0, c: 0 } );
			let avg = stat.s / stat.c;
			try {
				return await seek(Math.round(avg * (idx - 0.5)) /*ahead*/, Math.round(avg * (idx - 0.5)) - BYTES);
			} catch (err) {
				Promise.reject(err);
			}
		} else {
			return tiles[pre].offset;
		}
	}

};
