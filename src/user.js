const USER_TABLE = 'users';
const USER_PK = 'username';
const AVATAR_PREFIX = 'avatar/';
const AVATAR_DEFAULT_EXTENSION = 'jpg';

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
    [ userProfile.avatarData, userProfile.avatarExtension ] = await getUserAvatar(
      username, userTableRow.avatarExtension
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
  if(extension !== 'png' && extension !== 'jpg') {
    utils.throwCustomError(error400.BAD_FILE_TYPE);
  }

  const userKey = {
    [ USER_PK ]: username
  };

  await dynamodb.updateValue(USER_TABLE, userKey, null, {
    avatarExtension: extension
  });

  const avatarFilename = `${AVATAR_PREFIX}${username}.${extension}`;
  avatarData = Buffer.from(avatarData, 'base64');

  await s3.writeFile(cacheConstants.CACHE_NAME, avatarFilename, avatarData,
    'base64', `image/${extension}`);
}

async function updateProfile(username, avatarData, extension, tokenString) {
  await jwt.verifyUser(username, tokenString);
  if(avatarData) {
    await updateUserAvatar(username, avatarData, extension);
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
