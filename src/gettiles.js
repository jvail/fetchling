import Buffer from './buffer.js'
import fetchBytes from './fetchbytes.js';
import concat from './concat.js'
import find from './find.js'

/* TODO: cache tile byte pos in header.tiles */

export default async function getTiles(header, idxs_) {

	const url = header.url,
		imgLen = header.imgLen,
		head = header.buf,
		BYTES = 10,
		idxs = idxs_.slice().sort();

	async function get(pos, tiles) {

		try {

			let bytes = await fetchBytes(url, pos, pos + BYTES - 1);
			let buffer = new Buffer(bytes);

			if (buffer.ui16(0) === 0xff90 /* SOT */) {

				let idx = buffer.ui16(4);
				let len = buffer.ui32(6) === 0 ? imgLen - pos - 2 : buffer.ui32(6);

				header.tiles[idx].off = pos;
				header.tiles[idx].len = len;

				if (idx === idxs[0]) {
					let tile = await fetchBytes(url, pos, pos + len - 1);
					tiles.push({
						idx: idxs.shift(),
						buf: concat([head, tile, [255, 217] /* EOC */])
					});
				}

				if (!idxs.length) return tiles;

				if (pos + len + 1 > imgLen) throw new Error('reached end of file');

				return await get(pos + len, tiles);

			} else {
				throw new Error('expected SOT');
			}

		} catch (err) {
			return Promise.reject(err);
		}

	};

	try {
		let pos = await find(header, idxs[0]);
		return get(pos, []);
	} catch (err) {
		Promise.reject(err);
	}

}
