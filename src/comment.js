const COMMENT_TABLE = 'comments';
const COMMENT_PK = 'commentId';
const COMMENT_COMMON_INDEX = 'comments-common';
const COMMENT_COMMON_PK = 'commonIndexPk';
const COMMENT_COMMON_SK = 'commonIndexSk';

const { v4: uuidv4 } = require('uuid');
const jwt = require('./Cognito/jwt');
const problemModule = require('./problem');
const noteModule = require('./note');
const dynamodb = require('./Dynamodb/dynamodb');
const dynamodbUtils = require('./Dynamodb/dynamodbUtils');
const utils = require('./utils');
const error400 = require('./error400');

function getNoteCommonIndexPk(noteAuthor, platform, problemId) {
  const dbProblemId = problemModule.inflateProblemId(problemId);
  return `NOTE#${noteAuthor}#${platform}#${dbProblemId}`;
}

async function updateEntityActivityTime(commonIndexPk) {
  const terms = commonIndexPk.split('#');
  if(terms.length === 5) {
    const [ entityType, username, platform, contestCode, problemCode ] = terms;
    if(entityType === 'NOTE') {
      const shortContestCode = dynamodbUtils.removePrefixZeroes(contestCode);
      const problemId = shortContestCode + '#' + problemCode;
      await noteModule.updateNoteActivityTime(username, platform, problemId);
    }
  }
}

async function addNoteComment(username, noteAuthor, platform, problemId,
                              content, tokenString) {
  await jwt.verifyUser(username, tokenString);
  await noteModule.forceExistence(noteAuthor, platform, problemId, true);

  const newCommentId = uuidv4();
  const currentTime = (new Date()).toJSON();

  const commentObject = {
    [ COMMENT_COMMON_PK ]: getNoteCommonIndexPk(noteAuthor, platform, problemId),
    [ COMMENT_COMMON_SK ]: `${currentTime}#${newCommentId}#Z`,
    commentId: newCommentId,
    creationTime: currentTime,
    username: username,
    content: content,
    likeCount: 0
  };

  await dynamodb.insertValue(COMMENT_TABLE, COMMENT_PK, commentObject);
  await updateEntityActivityTime(commentObject[COMMENT_COMMON_PK]);

  return newCommentId;
}

async function replyNoteComment(username, rootReplyId, replyId,
                                content, tokenString) {
  await jwt.verifyUser(username, tokenString);
  const rootComment = await getCommentInfo(rootReplyId);
  const replyComment = await getCommentInfo(replyId);

  const replyCommentRoot = replyComment.rootReplyId || replyId;
  if(replyCommentRoot !== rootReplyId) {
    utils.throwCustomError(error400.COMMENT_NOT_FOUND);
  }

  const newCommentId = uuidv4();
  const currentTime = (new Date()).toJSON();
  const inverseTime = utils.getInverseTimestamp(currentTime);
  const commonIndexSk =
    `${rootComment.creationTime}#${rootReplyId}#${inverseTime}`;

  const commentObject = {
    [ COMMENT_COMMON_PK ]: rootComment[COMMENT_COMMON_PK],
    [ COMMENT_COMMON_SK ]: commonIndexSk,
    commentId: newCommentId,
    creationTime: currentTime,
    username: username,
    content: content,
    likeCount: 0,
    rootReplyId: rootReplyId,
    replyId: replyId
  };

  await dynamodb.insertValue(COMMENT_TABLE, COMMENT_PK, commentObject);
  await updateEntityActivityTime(commentObject[COMMENT_COMMON_PK]);

  return newCommentId;
}

async function getNoteComments(noteAuthor, platform, problemId) {
  await noteModule.forceExistence(noteAuthor, platform, problemId, true);

  const commonIndexPk = getNoteCommonIndexPk(noteAuthor, platform, problemId);
  const projectedAttributes = [
    'commentId', 'creationTime', 'editedTime', 'username', 'content',
    'likeCount', 'rootReplyId', 'replyId'
  ];

  const commentRows = await dynamodb.queryPartitionKey(
    COMMENT_TABLE, COMMENT_COMMON_PK, commonIndexPk, false,
    projectedAttributes, false, COMMENT_COMMON_INDEX
  );

  let processedComments = [];
  for(const comment of commentRows) {
    if(comment.rootReplyId) {
      processedComments[processedComments.length - 1].replies.push(comment);
    }
    else {
      comment.replies = [];
      processedComments.push(comment);
    }
  }

  return processedComments;
}

async function getCommentInfo(commentId) {
  const commentRows = await dynamodb.queryPartitionKey(
    COMMENT_TABLE, COMMENT_PK, commentId
  );

  if(commentRows.length === 0) {
    utils.throwCustomError(error400.COMMENT_NOT_FOUND);
  }

  return commentRows[0];
}

async function editComment(commentId, content, tokenString) {
  const comment = await getCommentInfo(commentId);
  if(comment.deleted) {
    utils.throwCustomError(error400.COMMENT_NOT_FOUND);
  }

  await jwt.verifyUser(comment.username, tokenString);

  const commentKey = {
    [ COMMENT_PK ]: commentId
  };

  const setUpdates = {
    content: content,
    editedTime: (new Date()).toJSON()
  };

  const commentEdited = await dynamodb.updateValue(COMMENT_TABLE, commentKey,
    null, setUpdates, true, ' AND attribute_not_exists(deleted)'
  );

  if(!commentEdited) {
    utils.throwCustomError(error400.COMMENT_NOT_FOUND);
  }

  await updateEntityActivityTime(comment[COMMENT_COMMON_PK]);
}

async function deleteComment(commentId, tokenString) {
  const comment = await getCommentInfo(commentId);
  await jwt.verifyUser(comment.username, tokenString);

  const commentKey = {
    [ COMMENT_PK ]: commentId
  };

  const setUpdates = {
    content: null,
    deleted: true
  };

  await dynamodb.updateValue(COMMENT_TABLE, commentKey, null, setUpdates, true);
  await updateEntityActivityTime(comment[COMMENT_COMMON_PK]);
}

module.exports.addNoteComment = addNoteComment;
module.exports.replyNoteComment = replyNoteComment;
module.exports.getNoteComments = getNoteComments;
module.exports.getCommentInfo = getCommentInfo;
module.exports.editComment = editComment;
module.exports.deleteComment = deleteComment;
