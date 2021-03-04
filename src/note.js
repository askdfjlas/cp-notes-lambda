const NOTE_TABLE = 'notes';
const NOTE_PK = 'username';
const NOTE_PROBLEM_INDEX = 'notes-problem';
const NOTE_PROBLEM_PK = 'problemIndexPk';
const NOTE_CONTEST_INDEX = 'notes-contest';
const NOTE_CONTEST_PK = 'contestIndexPk';
const NOTE_PLATFORM_INDEX = 'notes-platform';
const NOTE_PLATFORM_PK = 'platformIndexPk';
const NOTE_ALL_INDEX = 'notes-all';
const NOTE_ALL_PK = 'published';
const NOTE_RECENT_INDEX = 'notes-recent';
const NOTE_RECENT_PK = 'published';
const PAGINATE_SIZE = 50;

const problemModule = require('./problem');
const contestModule = require('./contest');
const likeModule = require('./like');
const userModule = require('./user');
const countModule = require('./count');
const dynamodb = require('./Dynamodb/dynamodb');
const jwt = require('./Cognito/jwt');
const utils = require('./utils');
const error400 = require('./error400');

async function getUserNotes(username) {
  const projectedAttributes = [
    'username', 'published', 'title', 'platform', 'contestName', 'contestCode',
    'problemSk', 'problemCode', 'problemName', 'solved', 'editedTime', 'likeCount',
    'level'
  ];

  const rows = await dynamodb.queryPartitionKey(
    NOTE_TABLE, NOTE_PK, username, true, projectedAttributes
  );

  for(let row of rows) {
    row.published = row.published ? true : false;
  }

  return rows;
}

async function getNotesFilteredList(platform, contestId, problemId, recent, page) {
  let noteIndexName, noteIndexPk, dbCountId;
  if(recent) {
    dbCountId = '!';
    noteIndexPk = NOTE_RECENT_PK;
    noteIndexName = NOTE_RECENT_INDEX;
  }
  else if(problemId) {
    const dbProblemId = problemModule.inflateProblemId(problemId);
    dbCountId = `${platform}#${dbProblemId}`;
    noteIndexPk = NOTE_PROBLEM_PK;
    noteIndexName = NOTE_PROBLEM_INDEX;
  }
  else if(contestId) {
    const dbContestId = contestModule.inflateContestId(contestId);
    dbCountId = `${platform}#${dbContestId}`;
    noteIndexPk = NOTE_CONTEST_PK;
    noteIndexName = NOTE_CONTEST_INDEX;
  }
  else if(platform) {
    dbCountId = platform;
    noteIndexPk = NOTE_PLATFORM_PK;
    noteIndexName = NOTE_PLATFORM_INDEX;
  }
  else {
    dbCountId = '!';
    noteIndexPk = NOTE_ALL_PK;
    noteIndexName = NOTE_ALL_INDEX;
  }

  let noteIndexPkValue = `1#${dbCountId}`;
  if(recent || (!problemId && !contestId && !platform)) {
    noteIndexPkValue = 1;
  }

  const totalNoteCount = await countModule.getCount('NOTE', dbCountId);
  const totalPages = Math.ceil(totalNoteCount/PAGINATE_SIZE);

  if(page > Math.max(totalPages, 1)) {
    utils.throwCustomError(error400.PAGE_NOT_FOUND);
  }

  const paginatedNotes = await dynamodb.queryPartitionKeyKthPage(
    NOTE_TABLE, noteIndexPk, noteIndexPkValue, page, PAGINATE_SIZE,
    false, noteIndexName
  );

  return {
    notes: paginatedNotes,
    totalPages: Math.max(totalPages, 1)
  };
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
  noteRow.published = noteRow.published ? true : false;

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

async function writeNote(username, dbNoteId, noteDynamicAttributes,
                         noteFixedAttributes, overwrite) {
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

async function addOrEditNote(username, platform, problemId, title, solved,
                             content, published, tokenString, overwrite) {
  await jwt.verifyUser(username, tokenString);

  const contestId = problemId.split('#')[0];
  const dbContestId = contestModule.inflateContestId(contestId);
  const dbProblemId = problemModule.inflateProblemId(problemId);
  const problemInfo = await problemModule.getProblemInfo(platform, problemId);

  if(!title) {
    title = `Notes for ${problemInfo.problemName}`;
  }

  const publishedNumber = published ? 1 : 0;
  const platformIndexPk = `${publishedNumber}#${platform}`;
  const contestIndexPk = `${publishedNumber}#${platform}#${dbContestId}`;
  const problemIndexPk = `${publishedNumber}#${platform}#${dbProblemId}`;
  const dbNoteId = `${platform}#${dbProblemId}`;
  const currentTime = (new Date()).toJSON();

  const noteDynamicAttributes = {
    title: title,
    solved: solved,
    content: content,
    published: publishedNumber,
    platformIndexPk: platformIndexPk,
    contestIndexPk: contestIndexPk,
    problemIndexPk: problemIndexPk,
    editedTime: currentTime,
    activityTime: currentTime
  };

  let noteFixedAttributes = {
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

  if('level' in problemInfo) {
    noteFixedAttributes.level = problemInfo.level;
  }

  await writeNote(username, dbNoteId, noteDynamicAttributes,
                  noteFixedAttributes, overwrite);
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

async function forceExistence(username, platform, problemId, forcePublished) {
  const noteExists = await checkExistence(
    username, platform, problemId, forcePublished
  );
  if(!noteExists) {
    utils.throwCustomError(error400.NOTE_NOT_FOUND);
  }
}

module.exports.getUserNotes = getUserNotes;
module.exports.getNotesFilteredList = getNotesFilteredList;
module.exports.getNoteInfo = getNoteInfo;
module.exports.addOrEditNote = addOrEditNote;
module.exports.updateNoteLikeCount = updateNoteLikeCount;
module.exports.deleteNote = deleteNote;
module.exports.checkExistence = checkExistence;
module.exports.forceExistence = forceExistence;
