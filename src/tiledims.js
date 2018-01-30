export default (idxs, header, ext) => {

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

}
