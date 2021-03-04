const COMMENT_TABLE = 'comments';
const COMMENT_PK = 'commentId';
const COMMENT_COMMON_INDEX = 'comments-common';
const COMMENT_COMMON_PK = 'commonIndexPk';

const { v4: uuidv4 } = require('uuid');
const jwt = require('./Cognito/jwt');
const problemModule = require('./problem');
const noteModule = require('./note');
const dynamodb = require('./Dynamodb/dynamodb');
const utils = require('./utils');
const error400 = require('./error400');

function getNoteCommonIndexPk(noteAuthor, platform, problemId) {
  const dbProblemId = problemModule.inflateProblemId(problemId);
  return `NOTE#${noteAuthor}#${platform}#${dbProblemId}`;
}

async function addNoteComment(username, noteAuthor, platform, problemId,
                              replyId, content, tokenString) {
  await jwt.verifyUser(username, tokenString);
  await noteModule.forceExistence(noteAuthor, platform, problemId, true);

  const newCommentId = uuidv4();
  const currentTime = (new Date()).toJSON();

  if(replyId) {

  }
  else {
    const commentObject = {
      commentId: newCommentId,
      creationTime: currentTime,
      username: username,
      content: content,
      likeCount: 0,
      commonIndexPk: getNoteCommonIndexPk(noteAuthor, platform, problemId),
      commonIndexSk: `${currentTime}#${newCommentId}#Z`
    };

    await dynamodb.insertValue(COMMENT_TABLE, COMMENT_PK, commentObject);
  }
}

async function getNoteComments(noteAuthor, platform, problemId) {
  await noteModule.forceExistence(noteAuthor, platform, problemId, true);
  
  const commonIndexPk = getNoteCommonIndexPk(noteAuthor, platform, problemId);
  return await dynamodb.queryPartitionKey(
    COMMENT_TABLE, COMMENT_COMMON_PK, commonIndexPk, false, [
      'commentId', 'creationTime', 'username', 'content', 'likeCount'
    ], false, COMMENT_COMMON_INDEX
  );
}

module.exports.addNoteComment = addNoteComment;
module.exports.getNoteComments = getNoteComments;
