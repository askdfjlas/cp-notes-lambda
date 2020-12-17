const LIKE_TABLE = 'likes';
const LIKE_PK = 'pk';
const LIKE_SK = 'username';

const problemModule = require('./problem');
const noteModule = require('./note');
const dynamodb = require('./Dynamodb/dynamodb');
const jwt = require('./Cognito/jwt');
const utils = require('./utils');
const error400 = require('./error400');

function getLikeDislikeId(noteAuthor, platform, problemId) {
  const dbProblemId = problemModule.inflateProblemId(problemId);
  const dbLikeId = `NOTE#${noteAuthor}#${platform}#${dbProblemId}#LIKE`;
  const dbDislikeId = `NOTE#${noteAuthor}#${platform}#${dbProblemId}#DISLIKE`;

  return [ dbLikeId, dbDislikeId ];
}

async function setUserNoteLikedStatus(username, noteAuthor, platform, problemId,
                                      likedStatus, tokenString) {
  await jwt.verifyUser(username, tokenString);

  const noteExists = await noteModule.checkExistence(
    noteAuthor, platform, problemId, true
  );
  if(!noteExists) {
    utils.throwCustomError(error400.NOTE_NOT_FOUND);
  }

  const [ dbLikeId, dbDislikeId ] = getLikeDislikeId(noteAuthor, platform, problemId);
  const currentTime = (new Date()).toJSON();

  if(likedStatus === 0) {
    await dynamodb.deletePrimaryKey(LIKE_TABLE, LIKE_PK, LIKE_SK, dbLikeId, username);
    await dynamodb.deletePrimaryKey(LIKE_TABLE, LIKE_PK, LIKE_SK, dbDislikeId, username);
  }
  else if(likedStatus === 1) {
    const likeObject = {
      [ LIKE_PK ]: dbLikeId,
      [ LIKE_SK ]: username,
      editedTime: currentTime
    };

    await dynamodb.insertValue(LIKE_TABLE, LIKE_PK, likeObject, true);
    await dynamodb.deletePrimaryKey(LIKE_TABLE, LIKE_PK, LIKE_SK, dbDislikeId, username);
  }
  else {
    const dislikeObject = {
      [ LIKE_PK ]: dbDislikeId,
      [ LIKE_SK ]: username,
      editedTime: currentTime
    };

    await dynamodb.insertValue(LIKE_TABLE, LIKE_PK, dislikeObject, true);
    await dynamodb.deletePrimaryKey(LIKE_TABLE, LIKE_PK, LIKE_SK, dbLikeId, username);
  }
}

async function getUserNoteLikedStatus(username, noteAuthor, platform, problemId, tokenString) {
  await jwt.verifyUser(username, tokenString);

  const [ dbLikeId, dbDislikeId ] = getLikeDislikeId(noteAuthor, platform, problemId);

  const likedRows = await dynamodb.queryPrimaryKey(
    LIKE_TABLE, LIKE_PK, LIKE_SK, dbLikeId, username, null, true
  );

  const dislikedRows = await dynamodb.queryPrimaryKey(
    LIKE_TABLE, LIKE_PK, LIKE_SK, dbDislikeId, username, null, true
  );

  return likedRows.length - dislikedRows.length;
}

async function getNoteLikeCount(noteAuthor, platform, problemId) {
  const [ dbLikeId, dbDislikeId ] = getLikeDislikeId(noteAuthor, platform, problemId);

  const likeCount = await dynamodb.queryPartitionKey(
    LIKE_TABLE, LIKE_PK, dbLikeId, true, null, true
  );

  const dislikeCount = await dynamodb.queryPartitionKey(
    LIKE_TABLE, LIKE_PK, dbDislikeId, true, null, true
  );

  return likeCount - dislikeCount;
}

async function deleteNoteLikes(noteAuthor, platform, problemId, tokenString) {
  const [ dbLikeId, dbDislikeId ] = getLikeDislikeId(noteAuthor, platform, problemId);

  await dynamodb.deletePartitionKey(LIKE_TABLE, LIKE_PK, LIKE_SK, dbLikeId);
  await dynamodb.deletePartitionKey(LIKE_TABLE, LIKE_PK, LIKE_SK, dbDislikeId);
}

module.exports.setUserNoteLikedStatus = setUserNoteLikedStatus;
module.exports.getUserNoteLikedStatus = getUserNoteLikedStatus;
module.exports.getNoteLikeCount = getNoteLikeCount;
module.exports.deleteNoteLikes = deleteNoteLikes;
