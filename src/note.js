const NOTE_TABLE = 'notes';
const NOTE_PK = 'username';

const problemModule = require('./problem');
const dynamodb = require('./Dynamodb/dynamodb');
const jwt = require('./Cognito/jwt');

async function addOrEditNote(username, platform, problemId, title, solved,
                             content, published, tokenString, overwrite) {
  await jwt.verifyUser(username, tokenString);

  const dbProblemId = problemModule.inflateProblemId(problemId);
  const problemExists = await problemModule.checkExistence(platform, dbProblemId);
  if(!problemExists) {
    throw Error('Requested problem does not exist!')
  }

  const dbNoteId = `${platform}#${dbProblemId}`;
  const noteObject = {
    [ NOTE_PK ]: username,
    sk: dbNoteId,
    title: title,
    solved: solved,
    content: content,
    published: published
  };

  try {
    return await dynamodb.insertValue(NOTE_TABLE, NOTE_PK, noteObject, overwrite);
  }
  catch(err) {
    if(err.name !== 'ConditionalCheckFailedException')
      throw err;
  }
}

module.exports.addOrEditNote = addOrEditNote;
