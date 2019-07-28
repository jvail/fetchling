export default (boxs) => {
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
}
