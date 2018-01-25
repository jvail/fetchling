export default (name) => document ? `${document.currentScript.src.split('/').slice(0, -1).join('/')}/${name}` : name;

