const NOTE_TABLE = 'notes';
const NOTE_PK = 'username';

const problemModule = require('./problem');
const likeModule = require('./like');
const dynamodb = require('./Dynamodb/dynamodb');
const jwt = require('./Cognito/jwt');
const utils = require('./utils');
const error400 = require('./error400');

async function getNotes(username) {
  const projectedAttributes = [
    'username', 'published', 'title', 'platform', 'contestName', 'contestCode',
    'problemSk', 'problemCode', 'problemName', 'solved', 'editedTime'
  ];

  return await dynamodb.queryPartitionKey(
    NOTE_TABLE, NOTE_PK, username, true, projectedAttributes
  );
}

async function getNoteInfo(username, platform, problemId, tokenString, forcePublished) {
  const dbProblemId = problemModule.inflateProblemId(problemId);
  const dbNoteId = `${platform}#${dbProblemId}`;

  const noteRows = await dynamodb.queryPrimaryKey(
    NOTE_TABLE, NOTE_PK, 'sk', username, dbNoteId, null, true
  );

  if(noteRows.length === 0 || (forcePublished && !noteRows[0].published)) {
    utils.throwCustomError(error400.NOTE_NOT_FOUND);
  }

  let noteRow = noteRows[0];
  if(!noteRow.published) {
    await jwt.verifyUser(username, tokenString);
  }

  noteRow.likeCount = await likeModule.getNoteLikeCount(username, platform, problemId);
  try {
    const requesterUsername = await jwt.verify(tokenString);
    noteRow.likedStatus = await likeModule.getUserNoteLikedStatus(
      requesterUsername, username, platform, problemId, tokenString
    );
  }
  catch(err) {
    // User is not signed in
  }

  delete noteRow.sk;
  return noteRow;
}

async function addOrEditNote(username, platform, problemId, title, solved,
                             content, published, tokenString, overwrite) {
  await jwt.verifyUser(username, tokenString);

  const dbProblemId = problemModule.inflateProblemId(problemId);
  const problemInfo = await problemModule.getProblemInfo(platform, problemId);

  if(!title) {
    title = `Notes for ${problemInfo.problemName}`;
  }

  const dbNoteId = `${platform}#${dbProblemId}`;
  const noteObject = {
    [ NOTE_PK ]: username,
    sk: dbNoteId,
    title: title,
    solved: solved,
    content: content,
    published: published,
    platform: platform,
    problemSk: problemId,
    problemCode: problemInfo.problemCode,
    problemName: problemInfo.problemName,
    contestName: problemInfo.contestName,
    contestCode: problemInfo.contestCode,
    editedTime: (new Date()).toJSON()
  };

  if(!overwrite) {
    await likeModule.initializeNoteLikeCount(username, platform, problemId);
  }

  await dynamodb.insertValue(NOTE_TABLE, NOTE_PK, noteObject, overwrite);
}

async function deleteNote(username, platform, problemId, tokenString) {
  await jwt.verifyUser(username, tokenString);

  const dbProblemId = problemModule.inflateProblemId(problemId);
  const dbNoteId = `${platform}#${dbProblemId}`;

  await dynamodb.deletePrimaryKey(
    NOTE_TABLE, NOTE_PK, 'sk', username, dbNoteId
  );

  await likeModule.deleteNoteLikes(username, platform, problemId);
}

async function checkExistence(username, platform, problemId, forcePublished) {
  const dbProblemId = problemModule.inflateProblemId(problemId);
  const dbNoteId = `${platform}#${dbProblemId}`;

  const rows = await dynamodb.queryPrimaryKey(
    NOTE_TABLE, NOTE_PK, 'sk', username, dbNoteId, null, true
  );

  if(forcePublished)
    return rows.length > 0 && rows[0].published;
  else
    return rows.length > 0;
}

module.exports.getNotes = getNotes;
module.exports.getNoteInfo = getNoteInfo;
module.exports.addOrEditNote = addOrEditNote;
module.exports.deleteNote = deleteNote;
module.exports.checkExistence = checkExistence;
