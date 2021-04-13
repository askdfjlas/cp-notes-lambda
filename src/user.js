const USER_TABLE = 'users';
const USER_PK = 'username';
const AVATAR_PREFIX = 'avatar/';
const ALLOWED_AVATAR_EXTENSIONS = ['jpg', 'jpeg', 'png'];

const { v4: uuid } = require('uuid');
const s3 = require('./S3/s3');
const dynamodb = require('./Dynamodb/dynamodb');
const cacheConstants = require('./S3/cacheConstants');
const jwt = require('./Cognito/jwt');
const userPool = require('./Cognito/userPool');
const codeforces = require('./codeforces');
const error400 = require('./error400');
const utils = require('./utils');

async function getUserTableRow(username) {
  const tableData = await dynamodb.queryPartitionKey(USER_TABLE, USER_PK, username);
  if(tableData.length === 0) {
    utils.throwCustomError(error400.USER_NOT_FOUND);
  }
  return tableData[0];
}

async function getProfile(username, basicInfoOnly, tokenString) {
  const userTableRow = await getUserTableRow(username);

  let userProfile = {
    username: username
  };

  if(userTableRow.cfUsername) {
    userProfile.cfUsername = userTableRow.cfUsername;
    userProfile.cfRating = userTableRow.cfRating;
    userProfile.cfRank = userTableRow.cfRank;
  }

  if(!basicInfoOnly) {
    userProfile.contribution = userTableRow.contribution;

    let requesterUsername = null;
    try {
      requesterUsername = await jwt.verify(tokenString);
    }
    catch(err) {
      /* User is not signed in */
    }

    if(requesterUsername === username) {
      userProfile.email = userTableRow.email
    }
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

async function beginCfVerification(username, authCfUsername, tokenString) {
  await jwt.verifyUser(username, tokenString);
  await codeforces.getUserInfo(authCfUsername);

  const authId = uuid().split('-').join('n').toUpperCase();

  const userKey = {
    [ USER_PK ]: username
  };

  const userUpdates = {
    authId: authId,
    authCfUsername: authCfUsername
  };

  const userUpdated = await dynamodb.updateValue(USER_TABLE, userKey, null,
    userUpdates, true, ' AND attribute_not_exists(cfUsername)'
  );

  if(!userUpdated) {
    utils.throwCustomError(error400.ALREADY_LINKED);
  }

  return authId;
}

async function endCfVerification(username, authId, authCfUsername, tokenString) {
  await jwt.verifyUser(username, tokenString);
  const cfUserInfo = await codeforces.getUserInfo(authCfUsername);

  /* It is imperative that this is the same exact string which the frontend
     tells the user to set their last name to lol */
  const verificationString = `I am authorizing cp-notes to use my identity: ${authId}`;
  if(cfUserInfo.lastName !== verificationString) {
    utils.throwCustomError(error400.VERIFICATION_FAILED);
  }

  const userKey = {
    [ USER_PK ]: username
  };

  const userUpdates = {
    cfUsername: authCfUsername,
    cfRating: cfUserInfo.rating || 0,
    cfRank: cfUserInfo.rank || 'newbie'
  };

  const additionalConditions = ' AND authCfUsername = :providedAuthCfUsername' +
    ' AND authId = :providedAuthId AND attribute_not_exists(cfUsername)';

  const additionalExpressionAttributeValues = {
    ':providedAuthCfUsername': authCfUsername,
    ':providedAuthId': authId
  };

  const userUpdated = await dynamodb.updateValue(USER_TABLE, userKey, null,
    userUpdates, true, additionalConditions, additionalExpressionAttributeValues
  );

  if(!userUpdated) {
    utils.throwCustomError(error400.VERIFICATION_OVERRIDDEN);
  }
}

module.exports.getUserTableRow = getUserTableRow;
module.exports.getProfile = getProfile;
module.exports.getUsers = getUsers;
module.exports.getUserAvatar = getUserAvatar;
module.exports.updateProfile = updateProfile;
module.exports.updateUserAvatar = updateUserAvatar;
module.exports.updateContribution = updateContribution;
module.exports.beginCfVerification = beginCfVerification;
module.exports.endCfVerification = endCfVerification;
