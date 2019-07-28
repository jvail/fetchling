import fetchBytes from './fetchbytes.js'
import Buffer from './buffer.js'
import concat from './concat.js'

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

};

export default async function (url) {

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

};
