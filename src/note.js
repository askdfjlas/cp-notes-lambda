const NOTE_TABLE = 'notes';
const NOTE_PK = 'username';

const problemModule = require('./problem');
const dynamodb = require('./Dynamodb/dynamodb');
const jwt = require('./Cognito/jwt');

async function addNote(username, platform, problemId, tokenString) {
  const authenticatedUser = await jwt.verify(tokenString);

  if(username !== authenticatedUser) {
    throw Error('Not logged in as the requested user!')
  }

  const dbProblemId = problemModule.inflateProblemId(problemId);
  const problemExists = await problemModule.checkExistence(platform, dbProblemId);
  if(!problemExists) {
    throw Error('Requested problem does not exist!')
  }

  const dbNoteId = `${platform}#${dbProblemId}`;
  const noteObject = {
    [ NOTE_PK ]: username,
    sk: dbNoteId
  };

  try {
    return await dynamodb.insertValue(NOTE_TABLE, NOTE_PK, noteObject);
  }
  catch(err) {
    if(err.name !== 'ConditionalCheckFailedException')
      throw err;
  }
}

module.exports.addNote = addNote;
