import getBoxes from './box.js'
import markers from './marker.js'
import concat from './concat.js'
import getLength from './getlength.js'
import Buffer from './buffer.js'
import dims from './tiledims.js'
import Cache from './cache.js'
import getExtent from './extent.js'
import fetchBytes from './fetchbytes.js'

const cache = new Cache();

export default async function getHeader(url) {

	const EXTRA_BYTES = 42; // enough for box & marker type & size & SIZ vars

	let imgLen = 0, header, KB = 1024;

	if (header = cache.get(url)) return header;

	try {
		imgLen = await getLength(url);
	} catch (err) {
		return Promise.reject(err);
	}

	const getSiz = (pos, buffer) => {

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
	getCodestreamHeader = async (pos, buffer, header = []) => {

		let marker = markers[buffer.ui16(pos).toString(16)],
			size = marker.delimiting ? 0 : buffer.ui16(pos + 2);

		if (marker.name === 'SIZ') {
			header.siz = getSiz(pos, buffer);
			header.push({
				name: marker.name,
				buf: buffer.slice(pos, pos + size + 2)
			});
		} else if (marker.name === 'SOT') {
			header.sot = pos;
			header.len = buffer.ui32(pos + 6);
			return header;
		} else {
			header.push({
				name: marker.name,
				buf: buffer.slice(pos, pos + size + 2)
			});
		}

		if (pos + size >= buffer.length - EXTRA_BYTES) {
			try {
				let srt = buffer.length,
					end = srt + Math.max(1023, pos + size - srt + EXTRA_BYTES);
					if (end > imgLen) throw new Error('reached end of file');
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


	try {

		let boxs = await getBoxes(url);
		let jp2c = boxs[boxs.length - 1];
		if (jp2c.name === 'jp2c') {
			let ext = getExtent(boxs);
			let off = jp2c.off + 8 + (jp2c.xlen ? 8 : 0)
			let head = await getCodestreamHeader(off, jp2c.buf);
			let tiles = dims(Array.from(Array(head.siz.nXTiles * head.siz.nYTiles).keys()), head, ext);
			let header = {
				buf: concat(head.map(h => h.buf)),
				cmp: head.siz.Csiz,
				bit: head.siz.Ssiz,
				w: head.siz.Xsiz,
				h: head.siz.Ysiz,
				ext,
				res: [
					Math.round((ext[2] - ext[0]) / head.siz.Xsiz),
					Math.round((ext[3] - ext[1]) / head.siz.Ysiz)
				],
				imgLen: imgLen,
				url,
				tiles
			};
			cache.add(header);
			return header;

		} else {
			throw new Error('Codestream not found');
		}

	} catch (err) {
		return Promise.reject(err);
	}

};

