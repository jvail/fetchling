import fetchBytes from './fetchbytes.js';
import boxes from './box.js'
import markers from './marker.js'
import concat from './concat.js'
import checkHead from './checkhead.js'
import Buffer from './buffer.js'
import dims from './tiledims.js'
import Cache from './cache.js'

const cache = new Cache();

export default async function getHeader(url) {

	const EXTRA_BYTES = 42; // enough for box & marker type & size & SIZ vars

	let imgLength = 0, header;

	if (header = cache.get(url)) return header;

	try {
		let head = await checkHead(url);
		if (head.type !== 'image/jp2')
			return Promise.reject(new Error('url not a jp2 image'));
		imgLength = head.length;
	} catch (err) {
		return Promise.reject(err);
	}

	const getBox = (pos, buffer) => {

			let xlen = 0,
				len = buffer.ui32(pos),
				box = boxes[buffer.ui32(pos + 4).toString(16)];

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
		getSiz = (pos, buffer) => {

			let	Xsiz = buffer.ui32(pos + 6),
				Ysiz = buffer.ui32(pos + 10),
				XOsiz = buffer.ui32(pos + 14),
				YOsiz = buffer.ui32(pos + 18),
				XTsiz = buffer.ui32(pos + 22),
				YTsiz = buffer.ui32(pos + 26),
				XTOsiz = buffer.ui32(pos + 30),
				YTOsiz = buffer.ui32(pos + 34);

			return {
				Xsiz,
				Ysiz,
				XOsiz,
				YOsiz,
				XTsiz,
				YTsiz,
				XTOsiz,
				YTOsiz,
				Csiz: buffer.ui16(pos + 38),
				Ssiz: (buffer.ui8(pos + 40) & 127) + 1,
				nXTiles: Math.ceil((Xsiz - XTOsiz) / XTsiz),
				nYTiles: Math.ceil((Ysiz - YTOsiz) / YTsiz)
			};

		},
		getCodestreamHeader = async (pos, buffer, header) => {

			let marker = markers[buffer.ui16(pos).toString(16)],
				size = marker.delimiting ? 0 : buffer.ui16(pos + 2);

			if (marker.name === 'SIZ') {
				header.siz = getSiz(pos, buffer);
				header.push({
					name: marker.name,
					buf: buffer.slice(pos, pos + size + 2)
				});
			} else if (marker.name === 'SOT') {
				return { pos, size: buffer.ui32(pos + 6), header };
			} else {
				header.push({
					name: marker.name,
					buf: buffer.slice(pos, pos + size + 2)
				});
			}

			if (pos + size >= buffer.length - EXTRA_BYTES) {
				try {
					let srt = buffer.length,
						end = srt + Math.max(511, pos + size - srt + EXTRA_BYTES);
						if (end > imgLength) return Promise.reject(new Error('reached end of file'));
					let buf = await fetchBytes(url, srt, end);
					buffer = new Buffer(concat([buffer, buf]));
				} catch (err) {
					return Promise.reject(err);
				}
			}

			try {
				return await getCodestreamHeader(pos + 2 /* marker size */ + size, buffer, header);
			} catch (err) {
				return Promise.reject(err);
			}

		};

	const parse = async (pos, buffer) => {

		if (pos >= buffer.length - EXTRA_BYTES) {
			try {
				let srt = buffer.length,
					end = srt + Math.max(511, pos - srt + EXTRA_BYTES);
					if (end > imgLength) return Promise.reject(new Error('reached end of file'));
					let buf = await fetchBytes(url, srt, end);
				buffer = new Buffer(concat([buffer, buf]));
			} catch (err) {
				return Promise.reject(err);
			}
		}

		let box = getBox(pos, buffer);

		if (box.name === 'contiguousCodestream') {
			try {
				let ret = await getCodestreamHeader(pos + 8 + (box.xlen ? 8 : 0), buffer, []);
				let noTiles = ret.header.siz.nXTiles * ret.header.siz.nYTiles;
				let tiles = dims(Array.from(Array(noTiles).keys()), ret.header.siz);
				tiles[0].offset = ret.pos;
				tiles[0].size = ret.size;
				return {
					buf: concat(ret.header.map(h => h.buf)),
					siz: ret.header.siz,
					posSOT: ret.pos,
					imgLength,
					url,
					tiles
				};
			} catch (err) {
				return Promise.reject(err);
			}
		} else if (box.len) { // stop if box.len = 0
			pos = box.sbox ?
				(pos + 8 + (box.xlen ? 8 : 0)) :
				(pos + (box.xlen ? box.xlen : box.len));
			try {
				return await parse(pos, buffer);
			} catch (err) {
				return Promise.reject(err);
			}
		} else {
			return Promise.reject(new Error('no codestream found'));
		}

	};

	header = await parse(0, new Buffer([]));
	cache.add(header);

	return header;

};
