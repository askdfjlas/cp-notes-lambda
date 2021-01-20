const s3 = require('./S3/s3');
const dynamodb = require('./Dynamodb/dynamodb');
const cacheConstants = require('./S3/cacheConstants');
const jwt = require('./Cognito/jwt');
const userPool = require('./Cognito/userPool');
const utils = require('./utils');

const USER_TABLE = 'users';
const USER_PK = 'username';
const AVATAR_PREFIX = 'avatar/';
const AVATAR_DEFAULT_EXTENSION = 'jpg';

async function getProfile(username, tokenString) {
  try {
    var requesterUsername = await jwt.verify(tokenString);
  }
  catch(err) {
    var requesterUsername = null;
  }

  const tableData = await dynamodb.queryPartitionKey(USER_TABLE, USER_PK, username);
  if(tableData.length === 0) {
    utils.throwCustomError('UserNotFound', 'User not found!');
  }
  const userTableRow = tableData[0];

  let userProfile = {
    username: username,
    contribution: userTableRow.contribution
  };

  if(requesterUsername === username) {
    userProfile.email = userTableRow.email
  }

  if(userTableRow.avatarExtension) {
    [ userProfile.avatarData, userProfile.avatarExtension ] = await getUserAvatar(
      username, avatarExtension
    );
  }
  else {
    [ userProfile.avatarData, userProfile.avatarExtension ] = await getUserAvatar(
      '!', AVATAR_DEFAULT_EXTENSION
    );
  }

  return userProfile;
}

async function getUsers(page) {
  const userFile = `${cacheConstants.USER_FILE_PREFIX}${page}.json`;
  const fileContent = await s3.getFile(cacheConstants.CACHE_NAME, userFile);
  return JSON.parse(fileContent);
}

async function getUserAvatar(username, extension) {
  const avatarFilename = `${AVATAR_PREFIX}${username}.${extension}`;
  const avatarData = await s3.getFile(
    cacheConstants.CACHE_NAME, avatarFilename, true
  );
  return [ avatarData, extension ];
}

async function updateUserAvatar(username, avatarData, extension) {
  const avatarFilename = `${AVATAR_PREFIX}${username}.${extension}`;
  await s3.writeFile(cacheConstants.CACHE_NAME, avatarFilename, avatarData,
    'base64', `image/${extension}`);
}

async function updateContribution(username, increment) {
  const userKey = {
    username: username
  };

  await dynamodb.updateValue(USER_TABLE, userKey, {
    contribution: increment
  });
}

module.exports.getProfile = getProfile;
module.exports.getUsers = getUsers;
module.exports.getUserAvatar = getUserAvatar;
module.exports.updateUserAvatar = updateUserAvatar;
module.exports.updateContribution = updateContribution;
