const NOTE_TABLE = 'notes';
const NOTE_PK = 'username';

const problemModule = require('./problem');
const dynamodb = require('./Dynamodb/dynamodb');
const jwt = require('./Cognito/jwt');
const utils = require('./utils');

async function getNotes(username) {
  const projectedAttributes = [
    'published', 'title', 'platform', 'contestName', 'contestCode', 'problemSk',
    'problemCode', 'problemName', 'solved'
  ];

  return await dynamodb.queryPartitionKey(
    NOTE_TABLE, NOTE_PK, username, true, projectedAttributes
  );
}

async function getNoteInfo(username, platform, problemId, tokenString) {
  const dbProblemId = problemModule.inflateProblemId(problemId);
  const dbNoteId = `${platform}#${dbProblemId}`;

  const noteRows = await dynamodb.queryPrimaryKey(
    NOTE_TABLE, NOTE_PK, 'sk', username, dbNoteId, null, true
  );

  if(noteRows.length === 0) {
    utils.throwCustomError('NoteNotFound', 'Note not found!');
  }

  let noteRow = noteRows[0];
  if(!noteRow.published) {
    await jwt.verifyUser(username, tokenString);
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
    problemCode: problemInfo.problemCode,
    problemName: problemInfo.problemName,
    problemSk: problemId,
    contestName: problemInfo.contestName,
    contestCode: problemInfo.contestCode
  };

  try {
    return await dynamodb.insertValue(NOTE_TABLE, NOTE_PK, noteObject, overwrite);
  }
  catch(err) {
    if(err.name !== 'ConditionalCheckFailedException')
      throw err;
  }
}

async function deleteNote(username, platform, problemId, tokenString) {
  await jwt.verifyUser(username, tokenString);

  const dbProblemId = problemModule.inflateProblemId(problemId);
  const dbNoteId = `${platform}#${dbProblemId}`;

  await dynamodb.deletePrimaryKey(
    NOTE_TABLE, NOTE_PK, 'sk', username, dbNoteId
  );
}

module.exports.getNotes = getNotes;
module.exports.getNoteInfo = getNoteInfo;
module.exports.addOrEditNote = addOrEditNote;
module.exports.deleteNote = deleteNote;
