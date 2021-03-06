const fetchBytes = async (url, srt, end) => {
	try {
		let res = await fetch(url, {
				method: 'GET',
				mode: 'cors',
				headers: {
					Range: `bytes=${srt}-${end}`
				}
			});
		if (res.status === 206 /* partial */) return res.arrayBuffer();
		if (res.status === 416 /* exceeds length */) return new ArrayBuffer(0);
		return Promise.reject(new Error(`Request failed (${res.status})`));
	} catch (err) {
		if (res.status === 416) return new ArrayBuffer(0);
		return Promise.reject(err);
	}
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
		len: d.byteLength,
		data: d.buffer,
		slice: (...args) => new Buffer(d.buffer.slice(...args))
	});
}

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
};

const boxes = Object.freeze({
	0x6a502020: {
		name: 'jP',
		sbox: false
	},
	0x66747970: {
		name: 'ftyp',
		sbox: false
	},
	0x6a703268: {
		name: 'jp2h',
		sbox: true
	},
	0x69686472: {
		name: 'ihdr',
		sbox: false
	},
	0x62706363: {
		name: 'bpcc',
		sbox: false
	},
	0x6a703269: {
		name: 'jp2i',
		sbox: false
	},
	0x786d6c20: {
		name: 'xml',
		sbox: false
	},
	0x75756964: {
		name: 'uuid',
		sbox: false
	},
	0x75696e66: {
		name: 'uinf',
		sbox: true
	},
	0x636f6c72: {
		name: 'colr',
		sbox: false
	},
	0x70636c72: {
		name: 'pclr',
		sbox: false
	},
	0x636d6170: {
		name: 'cmap',
		sbox: false
	},
	0x63646566: {
		name: 'cdef',
		sbox: false
	},
	0x72657320: {
		name: 'res',
		sbox: true
	},
	0x6a703263: {
		name: 'jp2c',
		sbox: false
	},
	0x6a706368: {
		name: 'jpch',
		sbox: true
	},
	0x72657363: {
		name: 'resc',
		sbox: false
	},
	0x72657364: {
		name: 'resd',
		sbox: false
	},
	0x756c7374: {
		name: 'ulst',
		sbox: false
	},
	0x75726c20: {
		name: 'url',
		sbox: false
	},
	0x61736f63: {
		name: 'asoc',
		sbox: true
	},
	0x6c626c20: {
		name: 'lbl',
		sbox: false
	}
});

async function* getBox(url, buf) {

	let off = 0;

	while (1) {

		let box = boxes[buf.ui32(off + 4)],
			off_ = off,
			len = buf.ui32(off),
			xlen = len === 1 ? buf.ui32(off + 8) * 4294967296 + buf.ui32(off + 12) : 0;

		if (!box) {
			throw new Error('no jp2 box found');
		}

		off = box.sbox ? (off + 8 + (xlen ? 8 : 0)) : (off + len);
		if (off + 16 >= buf.len && box.name !== 'jp2c') {
			let byt = await fetchBytes(url, buf.len, buf.len + Math.max(1024, off + 16));
			buf = new Buffer(concat([buf, byt]));
		}
		yield {
			name: box.name,
			sbox: box.sbox,
			len: xlen ? xlen : len,
			xlen,
			off: off_,
			buf
		};
		if (box.name === 'jp2c') return;
	}

}
async function getBoxes (url) {

	try {

		let boxs = [];
		let byt = await fetchBytes(url, 0, 2048);
		let buf = new Buffer(byt);

		if (buf.ui32(4) === 0x6a502020) {
			for await (const box of getBox(url, buf)) {
				buf = box.buf;
				switch (box.name) {
					case 'lbl':
					case 'xml':
						box.data = String.fromCharCode.apply(null, new Uint8Array(buf.data.slice(box.off + 8, box.off + box.len)));
					break;
				}
				boxs.push(box);
			}
		} else {
			throw new Error('not a j2k file');
		}

		return boxs;

	} catch (err) {
		return Promise.reject(err);
	}

}

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

const getLength = async (url) => {
	try {
		const len = +(await fetch(url, {
			method: 'HEAD',
			mode: 'cors',
			cache: 'no-store'
		})).headers.get('Content-Length');
		if (Number.isFinite(len)) {
			return len;
		} else {
			throw Error(`HEAD request to "${url}" did report content length of image.`);
		}
	} catch (err) {
		return Promise.reject(err);
	}
};

const dims = (idxs, header, ext) => {

	const min = Math.min, max = Math.max, floor = Math.floor, round = Math.round, siz = header.siz;

	return idxs.map(idx => {

		let py = floor(idx / siz.nYTiles),
			px = idx - (siz.nYTiles * py),
			tx0 = max(siz.XTOsiz + px * siz.XTsiz, siz.XOsiz),
			tx1 = min(siz.XTOsiz + (px + 1) * siz.XTsiz, siz.Xsiz),
			ty0 = max(siz.YTOsiz + py * siz.YTsiz, siz.YOsiz),
			ty1 = min(siz.YTOsiz + (py + 1) * siz.YTsiz, siz.Ysiz),
			tw = tx1 - tx0,
			th = ty1 - ty0,
			off = idx === 0 ? header.sot : 0,
			len = idx === 0 ? header.len : 0,
			x0 = ext[0],
			x1 = ext[2],
			y0 = ext[1],
			y1 = ext[3],
			rx = round((x1 - x0) / siz.Xsiz),
			ry = round((y1 - y0) / siz.Ysiz);

		return { idx, off, len, tw, th, tx0, ty0, ext: [
				x0 + tx0 * rx,
				y1 - ty0 * ry - th * ry,
				x0 + tx0 * rx + tw * rx,
				y1 - ty0 * ry
			]
		};

	});

};

function Cache () {

	const d = [];

	return {
		add: (h) => d.push(h),
		get: (url) => d.find(h => h.url === url)
	};

}

const getExtent = (boxs) => {
	// UTM
	const toNumber = s => s.split(/\s+/).map(s => parseFloat(s));
	const box = boxs.find((box, i, boxs) => i > 0 && boxs[i-1].data === 'gml.root-instance' && box.name === 'xml');
	const pix = box.data.match(/\d[\d\s]+?\d(?=<\/gml:high>)/g).map(toNumber);
	const ori = box.data.match(/\d[\d\s]+?\d(?=<\/gml:pos>)/g).map(toNumber);
	const off = box.data.match(/-?\d[-?\d\s]+?\d(?=<\/gml:offsetVector>)/g).map(toNumber);

	return [
		ori[0][0] - 0.5 * off[0][0],
		ori[0][1] + pix[0][1] * off[1][1] - 0.5 * off[1][1],
		ori[0][0] + pix[0][0] * off[0][0] - 0.5 * off[0][0],
		ori[0][1] - 0.5 * off[1][1],
	];
};

const cache = new Cache();

async function getHeader(url) {

	const EXTRA_BYTES = 42; // enough for box & marker type & size & SIZ vars

	let imgLen = 0, header;

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
			let off = jp2c.off + 8 + (jp2c.xlen ? 8 : 0);
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

}

async function find (header, idx) {

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

}

/* TODO: cache tile byte pos in header.tiles */

async function getTiles(header, idxs_) {

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

	}
	try {
		let pos = await find(header, idxs[0]);
		return get(pos, []);
	} catch (err) {
		Promise.reject(err);
	}

}

const getPath = (name, src) => src ? `${src.split('/').slice(0, -1).join('/')}/${name}` : name;

const decode = (function () {
	if (typeof Worker !== 'undefined') {
		const src = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : import.meta.url;
		const queue = [];
		const worker = new Worker(getPath('j2k-worker.js', src));
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
	}

	return null;

}());

const fetchling = { header: getHeader, tiles: getTiles, decode };

export { fetchling };
