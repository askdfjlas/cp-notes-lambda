const s3 = require('./S3/s3');
const cacheConstants = require('./S3/cacheConstants');
const jwt = require('./Cognito/jwt');
const userPool = require('./Cognito/userPool');
const utils = require('./utils');

async function getProfile(username, tokenString) {
  try {
    var requesterUsername = await jwt.verify(tokenString);
  }
  catch(err) {
    var requesterUsername = null;
  }

  const requestedUser = await userPool.queryUsername(username);
  if(!requestedUser) {
    utils.throwCustomError('UserNotFound', 'User not found!');
  }

  var userProfile = {
    username: username
  };

  if(requesterUsername === username) {
    userProfile.email = userPool.getUserAttribute(requestedUser, 'email');
  }

  return userProfile;
}

async function getUsers(page) {
  const userFile = `${cacheConstants.USER_FILE_PREFIX}${page}.json`;
  const fileContent = await s3.getFile(cacheConstants.CACHE_NAME, userFile);
  return JSON.parse(fileContent);
}

module.exports.getProfile = getProfile;
module.exports.getUsers = getUsers;
