let cacheName = 'cp-notes-cache';
if(process.env.stage === 'prod') {
  cacheName += '-prod';
}

module.exports = Object.freeze({
  CACHE_NAME: cacheName,
  USER_FILE_PREFIX: 'users/'
});
