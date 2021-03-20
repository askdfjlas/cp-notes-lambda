const USER_TABLE = 'users';
const USER_PK = 'username';
const AVATAR_PREFIX = 'avatar/';
const ALLOWED_AVATAR_EXTENSIONS = ['jpg', 'jpeg', 'png'];

const s3 = require('./S3/s3');
const dynamodb = require('./Dynamodb/dynamodb');
const cacheConstants = require('./S3/cacheConstants');
const jwt = require('./Cognito/jwt');
const userPool = require('./Cognito/userPool');
const error400 = require('./error400');
const utils = require('./utils');

async function getProfile(username, tokenString) {
  try {
    var requesterUsername = await jwt.verify(tokenString);
  }
  catch(err) {
    var requesterUsername = null;
  }

  const tableData = await dynamodb.queryPartitionKey(USER_TABLE, USER_PK, username);
  if(tableData.length === 0) {
    utils.throwCustomError(error400.USER_NOT_FOUND);
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
    userProfile.avatarData = await getUserAvatar(username);
  }
  else {
    userProfile.avatarData = await getUserAvatar('!');
  }

  return userProfile;
}

async function getUsers(page) {
  const userFile = `${cacheConstants.USER_FILE_PREFIX}${page}.json`;
  const fileContent = await s3.getFile(cacheConstants.CACHE_NAME, userFile);
  return JSON.parse(fileContent);
}

async function getUserAvatar(username) {
  const avatarFilename = `${AVATAR_PREFIX}${username}.txt`;
  return await s3.getFile(cacheConstants.CACHE_NAME, avatarFilename);
}

async function updateUserAvatar(username, avatarData) {
  let extension = null;
  for(const allowedExtension of ALLOWED_AVATAR_EXTENSIONS) {
    const neededPrefixString = `data:image/${allowedExtension};base64,`;
    if(avatarData.substring(0, neededPrefixString.length) === neededPrefixString) {
      extension = allowedExtension;
      break;
    }
  }

  if(!extension) {
    utils.throwCustomError(error400.BAD_FILE_TYPE);
  }

  const userKey = {
    [ USER_PK ]: username
  };

  await dynamodb.updateValue(USER_TABLE, userKey, null, {
    avatarExtension: extension
  });

  const avatarFilename = `${AVATAR_PREFIX}${username}.txt`;
  await s3.writeFile(cacheConstants.CACHE_NAME, avatarFilename, avatarData);
}

async function updateProfile(username, avatarData, tokenString) {
  await jwt.verifyUser(username, tokenString);
  if(avatarData) {
    await updateUserAvatar(username, avatarData);
  }
}

async function updateContribution(username, increment) {
  const userKey = {
    [ USER_PK ]: username
  };

  await dynamodb.updateValue(USER_TABLE, userKey, {
    contribution: increment
  });
}

module.exports.getProfile = getProfile;
module.exports.getUsers = getUsers;
module.exports.getUserAvatar = getUserAvatar;
module.exports.updateProfile = updateProfile;
module.exports.updateUserAvatar = updateUserAvatar;
module.exports.updateContribution = updateContribution;
