const NOTE_TABLE = 'notes';
const NOTE_PK = 'username';

const problemModule = require('./problem');
const likeModule = require('./like');
const userModule = require('./user');
const countModule = require('./count');
const dynamodb = require('./Dynamodb/dynamodb');
const jwt = require('./Cognito/jwt');
const utils = require('./utils');
const error400 = require('./error400');

async function getNotes(username) {
  const projectedAttributes = [
    'username', 'published', 'title', 'platform', 'contestName', 'contestCode',
    'problemSk', 'problemCode', 'problemName', 'solved', 'editedTime', 'likeCount'
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

/* Increment published note counts at all levels of hierarchy */
async function incrementNotePublishedCount(dbNoteId, increment) {
  let hierarchyList = dbNoteId.split('#');
  while(hierarchyList.length > 0) {
    const sk = hierarchyList.join('#');
    await countModule.updateCount('NOTE', sk, increment);
    hierarchyList.splice(hierarchyList.length - 1);
  }
  /* Most general hierarchy level */
  await countModule.updateCount('NOTE', '!', increment);
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
  const noteDynamicAttributes = {
    title: title,
    solved: solved,
    content: content,
    published: published,
    editedTime: (new Date()).toJSON()
  };

  const noteFixedAttributes = {
    [ NOTE_PK ]: username,
    sk: dbNoteId,
    platform: platform,
    problemSk: problemId,
    problemCode: problemInfo.problemCode,
    problemName: problemInfo.problemName,
    contestName: problemInfo.contestName,
    contestCode: problemInfo.contestCode,
    likeCount: 0
  }

  if(overwrite) {
    const itemKey = {
      [ NOTE_PK ]: username,
      sk: dbNoteId
    };

    const oldItem = await dynamodb.updateValue(
      NOTE_TABLE, itemKey, null, noteDynamicAttributes
    );

    if(!oldItem) {
      delete noteFixedAttributes[NOTE_PK];
      delete noteFixedAttributes.sk;
      await dynamodb.updateValue(
        NOTE_TABLE, itemKey, null, noteFixedAttributes
      );

      if(noteDynamicAttributes.published) {
        await incrementNotePublishedCount(dbNoteId, 1);
      }
    }
    else {
      if(noteDynamicAttributes.published && !oldItem.published) {
        await incrementNotePublishedCount(dbNoteId, 1);
      }
      else if(!noteDynamicAttributes.published && oldItem.published) {
        await incrementNotePublishedCount(dbNoteId, -1);
      }
    }
  }
  else {
    const noteObject = {
      ...noteDynamicAttributes,
      ...noteFixedAttributes
    };

    const itemInserted = await dynamodb.insertValue(
      NOTE_TABLE, NOTE_PK, noteObject, false
    );

    if(itemInserted && noteObject.published) {
      await incrementNotePublishedCount(dbNoteId, 1);
    }
  }
}

async function updateNoteLikeCount(noteAuthor, platform, problemId, increment) {
  const dbProblemId = problemModule.inflateProblemId(problemId);
  const dbNoteId = `${platform}#${dbProblemId}`;

  const noteKey = {
    [ NOTE_PK ]: noteAuthor,
    sk: dbNoteId
  };

  const oldNoteObject = await dynamodb.updateValue(NOTE_TABLE, noteKey, {
    likeCount: increment
  }, null, true);

  if(!oldNoteObject) {
    return false;
  }

  const oldLikeCount = oldNoteObject.likeCount;
  const newLikeCount = oldLikeCount + increment;
  const authorContributionDelta = Math.pow(newLikeCount, 3) - Math.pow(oldLikeCount, 3);
  await userModule.updateContribution(noteAuthor, authorContributionDelta);
  return true;
}

async function deleteNote(username, platform, problemId, tokenString) {
  await jwt.verifyUser(username, tokenString);

  const dbProblemId = problemModule.inflateProblemId(problemId);
  const dbNoteId = `${platform}#${dbProblemId}`;

  const oldNoteObject = await dynamodb.deletePrimaryKey(
    NOTE_TABLE, NOTE_PK, 'sk', username, dbNoteId
  );

  if(oldNoteObject) {
    const oldAuthorContribution = Math.pow(oldNoteObject.likeCount, 3);
    await userModule.updateContribution(username, -oldAuthorContribution);

    if(oldNoteObject.published) {
      await incrementNotePublishedCount(dbNoteId, -1);
    }
  }

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
module.exports.updateNoteLikeCount = updateNoteLikeCount;
module.exports.deleteNote = deleteNote;
module.exports.checkExistence = checkExistence;
