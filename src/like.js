const LIKE_TABLE = 'likes';
const LIKE_PK = 'pk';
const LIKE_SK = 'username';

const problemModule = require('./problem');
const noteModule = require('./note');
const dynamodb = require('./Dynamodb/dynamodb');
const jwt = require('./Cognito/jwt');
const utils = require('./utils');
const error400 = require('./error400');

function getNoteLikeTotalIds(noteAuthor, platform, problemId) {
  const dbProblemId = problemModule.inflateProblemId(problemId);
  const dbLikeId = `NOTE#${noteAuthor}#${platform}#${dbProblemId}#LIKE`;
  const dbTotalId = `NOTE#${noteAuthor}#${platform}#${dbProblemId}#TOTAL`;

  return [ dbLikeId, dbTotalId ];
}

async function initializeNoteLikeCount(noteAuthor, platform, problemId) {
  const [ dbLikeId, dbTotalId ] = getNoteLikeTotalIds(
    noteAuthor, platform, problemId
  );

  const likeCountObject = {
    [ LIKE_PK ]: dbTotalId,
    [ LIKE_SK ]: '!',
    totalCount: 0
  };

  await dynamodb.insertValue(LIKE_TABLE, LIKE_PK, likeCountObject, false);
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

  const [ dbLikeId, dbTotalId ] = getNoteLikeTotalIds(
    noteAuthor, platform, problemId
  );
  const currentTime = (new Date()).toJSON();

  let noteLikeDelta = 0;
  if(likedStatus === 0) {
    const oldLikeItem = await dynamodb.deletePrimaryKey(
      LIKE_TABLE, LIKE_PK, LIKE_SK, dbLikeId, username
    );
    if(oldLikeItem) {
      noteLikeDelta--;
    }
  }
  else {
    const likeObject = {
      [ LIKE_PK ]: dbLikeId,
      [ LIKE_SK ]: username,
      editedTime: currentTime
    };

    const itemInserted = await dynamodb.insertValue(
      LIKE_TABLE, LIKE_PK, likeObject, false
    );
    if(itemInserted) {
      noteLikeDelta++;
    }
  }

  const totalLikeKey = {
    [ LIKE_PK ]: dbTotalId,
    [ LIKE_SK ]: '!'
  };
  await dynamodb.updateValue(LIKE_TABLE, totalLikeKey, {
    totalCount: noteLikeDelta
  });
}

async function getUserNoteLikedStatus(username, noteAuthor, platform, problemId, tokenString) {
  await jwt.verifyUser(username, tokenString);

  const [ dbLikeId, dbTotalId ] = getNoteLikeTotalIds(
    noteAuthor, platform, problemId
  );

  const likedRows = await dynamodb.queryPrimaryKey(
    LIKE_TABLE, LIKE_PK, LIKE_SK, dbLikeId, username, null, true
  );

  return likedRows.length;
}

async function getNoteLikeCount(noteAuthor, platform, problemId) {
  const [ dbLikeId, dbTotalId ] = getNoteLikeTotalIds(
    noteAuthor, platform, problemId
  );

  const totalRows = await dynamodb.queryPrimaryKey(
    LIKE_TABLE, LIKE_PK, LIKE_SK, dbTotalId, '!', null, true
  );

  return totalRows[0].totalCount;
}

async function deleteNoteLikes(noteAuthor, platform, problemId) {
  const [ dbLikeId, dbTotalId ] = getNoteLikeTotalIds(
    noteAuthor, platform, problemId
  );

  await dynamodb.deletePrimaryKey(LIKE_TABLE, LIKE_PK, LIKE_SK, dbTotalId, '!');
  await dynamodb.deletePartitionKey(LIKE_TABLE, LIKE_PK, LIKE_SK, dbLikeId);
}

module.exports.initializeNoteLikeCount = initializeNoteLikeCount;
module.exports.setUserNoteLikedStatus = setUserNoteLikedStatus;
module.exports.getUserNoteLikedStatus = getUserNoteLikedStatus;
module.exports.getNoteLikeCount = getNoteLikeCount;
module.exports.deleteNoteLikes = deleteNoteLikes;
