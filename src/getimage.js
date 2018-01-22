import fetchBytes from './fetchbytes.js';
import boxes from './box.js'
import markers from './marker.js'
import concat from './concat.js'
import checkHead from './checkhead.js'
import Buffer from './buffer.js'


export default async (url_, idx_) => {

	const EXTRA_BYTES = 42, // enough for box & marker type & size & SIZ vars
		url = url_,
		idx = idx_,
		head = await checkHead(url);

	if (head.ranges !== true) throw new Error('no support for range requests');
	if (head.type !== 'image/jp2') throw new Error('no jp2 image');

	const getBox = (pos, buffer) => {
			let xlen = 0;
			let len = buffer.ui32(pos);
			let box = boxes[buffer.ui32(pos + 4).toString(16)];
			if (len === 1) {
				xlen = buffer.ui32(pos + 8) * 4294967296 + buffer.ui32(pos + 12);
			} else if (len === 0) {
				len = 0; /* TODO: till end of file */
			}
			return {
				name: box.name,
				sbox: box.sbox,
				len,
				xlen
			};
		},
		getTile = async (pos /* points to SOT */, idx, buffer /* only SOT */) => {
			if (buffer.length < 10) {
				let buf = await fetchBytes(url, pos, pos + 9);
				buffer = new Buffer(buf);
			}
			let marker = markers[buffer.ui16(0).toString(16)];
			if (marker.name !== 'SOT') {
				throw new Error('expected SOT');
			}
			let Isot = buffer.ui16(4);
			let Psot = buffer.ui32(6);
			// TODO:
			// check end of file and idx in range
			// Psot === 0 dann bis EOC
			// size: (size === 0 ? buffer.length - srt : size - 2)  // Psot - (EOC) marker.size
			if (Isot === idx) {
				let buf = await fetchBytes(url, pos, pos + Psot - 1);
				return {
					idx: idx,
					buf: new Buffer(buf)
				};
			} else {
				// fetch only the first 12 bytes of next SOT and set pos to next SOT
				let buf = await fetchBytes(url, pos + Psot, pos + Psot + 9);
				return await getTile(pos + Psot, idx, new Buffer(buf));
			}
		},
		getCodestreamHeader = async (pos, buffer, header) => {
			let marker = markers[buffer.ui16(pos).toString(16)];
			if (marker.name === 'SIZ') {
				let Xsiz = buffer.ui32(pos + 6);
				let Ysiz = buffer.ui32(pos + 10);
				let XOsiz = buffer.ui32(pos + 14);
				let YOsiz = buffer.ui32(pos + 18);
				let XTsiz = buffer.ui32(pos + 22);
				let YTsiz = buffer.ui32(pos + 26);
				let XTOsiz = buffer.ui32(pos + 30);
				let YTOsiz = buffer.ui32(pos + 34);
				let Csiz = buffer.ui16(pos + 38);
				let Ssiz = (buffer.ui8(pos + 40) & 127) + 1;

				// tile dimensions
				let nXTiles = Math.ceil((Xsiz - XTOsiz) / XTsiz);
				let nYTiles = Math.ceil((Ysiz - YTOsiz) / YTsiz);
				let py = Math.floor(idx / nYTiles);
				let px = idx - (nYTiles * py);
				let tx0 = Math.max(XTOsiz + px * XTsiz, XOsiz);
				let tx1 = Math.min(XTOsiz + (px + 1) * XTsiz, Xsiz);
				let ty0 = Math.max(YTOsiz + py * YTsiz, YOsiz);
				let ty1 = Math.min(YTOsiz + (py + 1) * YTsiz, Ysiz);

				header.w = Xsiz;
				header.h = Xsiz;
				header.tw = tx1 - tx0;
				header.th = ty1 - ty0;
				header.tx0 = tx0;
				header.ty0 = ty0;
				header.Ssiz = Ssiz;
				header.Csiz = Csiz;
				header.nx = nXTiles;
				header.ny = nYTiles;

			} else if (marker.name === 'SOT') {
				return { pos, buffer, header };
			}
			let size = marker.delimiting ? 0 : buffer.ui16(pos + 2);
			header.push({
				name: marker.name,
				buf: buffer.slice(pos, pos + size + 2)
			});
			if (pos + size >= buffer.length - EXTRA_BYTES) {
				let srt = buffer.length;
				let end = srt + Math.max(511, pos + size - srt + EXTRA_BYTES);
				let buf = await fetchBytes(url, srt, end);
				buffer = new Buffer(concat([buffer, buf]));
			}
			return await getCodestreamHeader(pos + 2 /* marker size */ + size, buffer, header);
		},
		parse = async (pos, buffer) => {

			if (pos >= buffer.length - EXTRA_BYTES) {
				let srt = buffer.length;
				let end = srt + Math.max(511, pos - srt + EXTRA_BYTES);
				let buf = await fetchBytes(url, srt, end);
				buffer = new Buffer(concat([buffer, buf]));
			}

			let box = getBox(pos, buffer);

			if (box.name === 'contiguousCodestream') {
				let ret = await getCodestreamHeader(pos + 8 + (box.xlen ? 8 : 0), buffer, []);
				let tile = await getTile(ret.pos, idx, ret.buffer.slice(ret.pos));

				tile.buf = concat([tile.buf, [255, 217] /* EOC */]);

				return {
					header: ret.header,
					tile
				};

			} else if (box.len) { // stop if box.len = 0
				pos = box.sbox ?
					(pos + 8 + (box.xlen ? 8 : 0)) :
					(pos + (box.xlen ? box.xlen : box.len));
				return await parse(pos, buffer);
			}
		};

	return parse(0, new Buffer([]));

};
