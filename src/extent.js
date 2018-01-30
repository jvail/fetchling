export default (boxs) => {
	// UTM
	let toN = s => s.split(/\s+/).map(s => parseFloat(s));
	let box = boxs.find((b, i, a) => i > 0 && a[i-1].data === 'gml.root-instance' && b.name === 'xml');
	let pix = box.data.match(/\d[\d\s]+?\d(?=<\/gml:high>)/g).map(toN);
	let ori = box.data.match(/\d[\d\s]+?\d(?=<\/gml:pos>)/g).map(toN);
	let off = box.data.match(/-?\d[-?\d\s]+?\d(?=<\/gml:offsetVector>)/g).map(toN);

	return [
		ori[0][0] - 0.5 * off[0][0],
		ori[0][1] + pix[0][1] * off[1][1]  - 0.5 * off[1][1],
		ori[0][0] + pix[0][0] * off[0][0]  - 0.5 * off[0][0],
		ori[0][1] - 0.5 * off[1][1],
	];
}
