import { default as header }  from './src/getheader.js'
import { default as tiles }  from './src/gettiles.js'
import { default as decode }  from './src/j2k.js'

const fetchling = { header, tiles, decode };

export { fetchling };
