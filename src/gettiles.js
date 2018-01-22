import Buffer from './buffer.js'
import fetchBytes from './fetchbytes.js';
import concat from './concat.js'

/* TODO: cache tile byte pos in header.tiles */

export default async function getTiles(header, idxs_) {

	const url = header.url,
		imgLength = header.imgLength,
		head = header.buf,
		idxs = idxs_.slice().sort();

	async function get(pos, tiles) {

		try {

			let bytes = await fetchBytes(url, pos, pos + 9);
			let buffer = new Buffer(bytes);

			if (buffer.ui16(0) === 0xff90 /* SOT */) {

				let idx = buffer.ui16(4);
				let len = buffer.ui32(6) === 0 ? imgLength - pos - 2 : buffer.ui32(6);

				if (idx === idxs[0]) {
					let tile = await fetchBytes(url, pos, pos + len - 1);
					tiles.push({
						idx: idxs.shift(),
						buf: concat([head, tile, [255, 217] /* EOC */])
					});
				}

				if (!idxs.length) return tiles;

				if (pos + len + 1 > imgLength) throw new Error('reached end of file');

				return await get(pos + len, tiles);

			} else {
				throw new Error('expected SOT');
			}

		} catch (err) {
			return Promise.reject(err);
		}

	};

	return get(header.posSOT, []);

}
