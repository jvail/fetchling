import fetchBytes from './fetchbytes.js';
import Buffer from './buffer.js';

export default async function (header, idx) {

	const url = header.url,
		imgLen = header.imgLen,
		tiles = header.tiles,
		BYTES = 1024 * 512,
		idx_ = idx;

	async function _(offset) {

		try {
			if (offset < 0 || offset >= imgLen) return { pos: -1, idx: -1 };
			let bytes = await fetchBytes(url, offset, Math.min(offset + BYTES - 1, imgLen));
			if (bytes.byteLength) {
				let buffer = new Buffer(bytes);
				let pos = 0;
				while (pos < bytes.byteLength - 1) {
					if (buffer.ui16(pos) === 0xff90) {
						let idx = buffer.ui16(pos + 4);
						let len = buffer.ui32(pos + 6);
						// console.log('look for ' + idx_,'found ' + idx, len);
						if (idx === tiles.length - 1) {
							return { pos: pos + offset, idx };
						} else if (idx < tiles.length - 1) {
							// verify
							if (header.tiles[idx + 1].off === offset + pos) {
								header.tiles[idx].off = offset + pos;
								header.tiles[idx].len = len;
							} else {
								let bytes = await fetchBytes(url, offset + pos + len, offset + pos + len + 2);
								let buffer = new Buffer(bytes);
								if (buffer.ui16(0) === 0xff90) {
									header.tiles[idx].off = pos + offset;
									header.tiles[idx].len = len;
									return { pos: pos + offset, idx };
								}
							}
						}
					}
					pos++;
				}
				return { pos: 0, idx: -1 };
			}
			return { pos: -1, idx: -1 };
		} catch (err) {
			return Promise.reject(err);
		}

	}

	async function seek(ahead, back) {

		try {
			// TODO: search multiple times ahead and back if index found is too (criteria?) far away
			let sot, sots = await Promise.all([_(ahead), _(back)]);
			if (sot = sots.find(s => s.pos > 0 && s.idx <= idx)) {
				return sot.pos;
			} else {
				return await seek(sots[0].idx > idx || sots[0].idx < 0 ? -1 : ahead + BYTES, back - BYTES);
			}

		} catch (err) {
			return Promise.reject(err);
		}

	}


	if (tiles[idx_].off > 0) {
		return tiles[idx_].off;
	} else if (idx_ > 0 && tiles[idx_ - 1].off > 0) {
		return tiles[idx_ - 1].off + tiles[idx_ - 1].len;
	} else if (idx_ <= tiles.length / 8) {
		return tiles[0].off;
	} else {

		let pre = tiles.slice(0, idx_).reverse().find(t => t.off > 0).idx;
		// let next = tiles.slice(idx_).find(t => t.off > 0);
		// next = next ? next.idx : -1;
		if (idx_ - pre > tiles.length / 8) {
			let stat = tiles.reduce((o, t)=> {
				o.s += t.len;
				o.c += !!t.len;
				return o;
			}, { s: 0, c: 0 } );
			let avg = stat.s / stat.c;
			try {
				return await seek(Math.round(avg * (idx_ - 0.5)) /*ahead*/, Math.round(avg * (idx_ - 0.5)) - BYTES);
			} catch (err) {
				return Promise.reject(err);
			}
		} else {
			return tiles[pre].off;
		}

	}

};
