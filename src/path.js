export default (name, src) => src ? `${src.split('/').slice(0, -1).join('/')}/${name}` : name;

