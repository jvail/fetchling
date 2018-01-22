const fetchling = (function (exports) {
'use strict';

const fetchBytes = async (url, srt, end) => {
	try {
		let res = await fetch(url, {
				method: 'GET',
				mode: 'cors',
				headers: {
					Range: `bytes=${srt}-${end}`
				}
			});
		if (res.ok) {
			return res.arrayBuffer();
		} else {
			Promise.reject(new Error(`Request failed (${res.status})`));
		}
	} catch (err) {
		Promise.reject(err);
	}
};

const boxes = Object.freeze({
	'6a502020': {
		name: 'signature',
		sbox: false
	},
	'66747970': {
		name: 'fileType',
		sbox: false
	},
	'6a703268': {
		name: 'jp2Header',
		sbox: true
	},
	'69686472': {
		name: 'imageHeader',
		sbox: false
	},
	'62706363': {
		name: 'bitsPerComponent',
		sbox: false
	},
	'6a703269': {
		name: 'intellectualProperty',
		sbox: false
	},
	'786d6c20': {
		name: 'xml',
		sbox: false
	},
	'75756964': {
		name: 'uuid',
		sbox: false
	},
	'75696e66': {
		name: 'uuidInfo',
		sbox: true
	},
	'636f6c72': {
		name: 'colourSpecification',
		sbox: false
	},
	'70636c72': {
		name: 'palette',
		sbox: false
	},
	'636d6170': {
		name: 'componentMapping',
		sbox: false
	},
	'63646566': {
		name: 'channelDefinition',
		sbox: false
	},
	'72657320': {
		name: 'resolution',
		sbox: true
	},
	'6a703263': {
		name: 'contiguousCodestream',
		sbox: false
	},
	'6a706368': {
		name: 'codestreamHeader',
		sbox: true
	},
	'72657363': {
		name: 'captureResolution',
		sbox: false
	},
	'72657364': {
		name: 'displayResolution',
		sbox: false
	},
	'756c7374': {
		name: 'uuidList',
		sbox: false
	},
	'75726c20': {
		name: 'url',
		sbox: false
	},
	'61736f63': {
		name: 'association',
		sbox: true
	},
	'6c626c20': {
		name: 'label',
		sbox: false
	}
});

const markers = Object.freeze({
	'ff4f': {
		name: 'SOC',
		delimiting: true
	},
	'ffd9': {
		name: 'EOC',
		delimiting: false
	},
	'ff93': {
		name: 'SOD',
		delimiting: true
	},
	'ff91': {
		name: 'SOP',
		delimiting: false
	},
	'ff92': {
		name: 'EPH',
		delimiting: true
	},
	'ff90': {
		name: 'SOT',
		delimiting: false
	},
	'ff51': {
		name: 'SIZ',
		delimiting: false
	},
	'ffd9': {
		name: 'EOC',
		delimiting: true
	},
	'ff52': {
		name: 'COD',
		delimiting: false
	},
	'ff53': {
		name: 'COC',
		delimiting: false
	},
	'ff5e': {
		name: 'RGN',
		delimiting: false
	},
	'ff5c': {
		name: 'QCD',
		delimiting: false
	},
	'ff5d': {
		name: 'QCC',
		delimiting: false
	},
	'ff5f': {
		name: 'POC',
		delimiting: false
	},
	'ff55': {
		name: 'TLM',
		delimiting: false
	},
	'ff57': {
		name: 'PLM',
		delimiting: false
	},
	'ff58': {
		name: 'PLT',
		delimiting: false
	},
	'ff60': {
		name: 'PPM',
		delimiting: false
	},
	'ff61': {
		name: 'PPT',
		delimiting: false
	},
	'ff63': {
		name: 'CRG',
		delimiting: false
	},
	'ff64': {
		name: 'COM',
		delimiting: false
	}
});

const concat = (bufs) => {
	return bufs.reduce((a, b) => {
		let alen = a.byteLength, blen = 0;
		if (Array.isArray(b)) {
			blen = b.length;
		} else {
			if (b.array instanceof Uint8Array) {
				b = b.array;
				blen = b.byteLength;
			} else if (b instanceof ArrayBuffer) {
				b = new Uint8Array(b);
				blen = b.byteLength;
			}
		}
		let c = new Uint8Array(alen + blen);
		c.set(a, 0);
		c.set(b, alen);
		return c;
	}, new Uint8Array()).buffer;
}

const checkHead = (url) => {
	return new Promise((resolve, reject) => {
		/* apparently fetch does not expose all response headers */
		try {
			let req = new XMLHttpRequest();
			req.onload = () => {
				if (req.status === 200) {
					resolve({
						status: req.status,
						ranges: (req.getResponseHeader('Accept-Ranges') && req.getResponseHeader('Accept-Ranges').indexOf('bytes') >= 0),
						type: req.getResponseHeader('Content-Type'),
						length: +req.getResponseHeader('Content-Length')
					});
				} else {
					reject(new Error(`Request failed (${req.status})`));
				}
			};
			req.onerror = () => {
				reject(new Error(`Request failed (${req.status})`));
			};
			req.open('HEAD', url);
			req.send();
		} catch (err) {
			reject(err);
		}
	});
};

function Buffer(data) {
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
		slice: (...args) => new Buffer(d.buffer.slice(...args))
	});
}

const dims = (idxs, siz) => {

	const min = Math.min, max = Math.max, floor = Math.floor;

	return idxs.map(idx => {

		let py = floor(idx / siz.nYTiles),
			px = idx - (siz.nYTiles * py),
			tx0 = max(siz.XTOsiz + px * siz.XTsiz, siz.XOsiz),
			tx1 = min(siz.XTOsiz + (px + 1) * siz.XTsiz, siz.Xsiz),
			ty0 = max(siz.YTOsiz + py * siz.YTsiz, siz.YOsiz),
			ty1 = min(siz.YTOsiz + (py + 1) * siz.YTsiz, siz.Ysiz);

		return {
			idx,
			/*pos: 0, cache pos */
			tw: tx1 - tx0,
			th: ty1 - ty0,
			tx0,
			ty0
		};

	});

}

async function getHeader(url) {

	const EXTRA_BYTES = 42; // enough for box & marker type & size & SIZ vars

	let imgLength = 0;

	try {
		let head = await checkHead(url);
		if (head.ranges !== true)
			return Promise.reject(new Error('no support for range requests'));
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
				return { pos, header };
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
				return {
					buf: concat(ret.header.map(h => h.buf)),
					siz: ret.header.siz,
					posSOT: ret.pos,
					imgLength,
					url,
					tiles: dims(Array.from(Array(noTiles).keys()), ret.header.siz)
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

	return parse(0, new Buffer([]));

}

/* TODO: cache tile byte pos in header.tiles */

async function getTiles(header, idxs_) {

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

	}

	return get(header.posSOT, []);

}

const j2k = (function () {
	const queue = [];
	const worker = new Worker('js/j2k-worker.js');
	let initialized = new Promise ((resolve, reject) => {
		queue.push({ resolve, reject });
	});
	worker.onmessage = (evt) => {
		if (!initialized && evt.data.initialized) {
			queue.shift().resolve(initialized = true);
		} else {
			if (evt.data) {
				queue.shift().resolve({
					idx: evt.data.idx,
					i16: new Int16Array(evt.data.buf)
				});
			} else {
				queue.shift().reject(evt.data);
			}
		}
	};
	return async function (data) {
		if (initialized !== true) await initialized;
		return new Promise((resolve, reject) => {
			if (!(data.buf instanceof ArrayBuffer)) {
				reject('Input not a buffer');
			} else {
				queue.push({ resolve, reject });
				worker.postMessage(data, [data.buf]);
			}
		});
	};
}());

exports.header = getHeader;
exports.tiles = getTiles;
exports.decode = j2k;

return exports;

}({}));