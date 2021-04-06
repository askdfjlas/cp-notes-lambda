const fetch = require('node-fetch');
const error400 = require('./error400');
const utils = require('./utils');

const USER_INFO_ENDPOINT = 'https://codeforces.com/api/user.info?handles=';
const MAX_RETRIES = 3;

async function getUserInfo(username) {
  if(username.includes(';')) {
    utils.throwCustomError(error400.USER_NOT_FOUND);
  }

  for(let i = 0; i < MAX_RETRIES; i++) {
    const data = await fetch(USER_INFO_ENDPOINT + username);
    if(data.status === 200) {
      const dataJson = await data.json();
      return dataJson.result[0];
    }
    else if(data.status === 400) {
      utils.throwCustomError(error400.USER_NOT_FOUND);
    }
  }

  utils.throwCustomError(error400.CODEFORCES_DOWN);
}

module.exports.getUserInfo = getUserInfo;
