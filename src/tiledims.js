export default (idxs, siz) => {

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
			offset: 0,
			size: 0,
			tw: tx1 - tx0,
			th: ty1 - ty0,
			tx0,
			ty0
		};

	});

}
