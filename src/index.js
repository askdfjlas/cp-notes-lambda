const problemModule = require('./problem');
const contestModule = require('./contest');
const noteModule = require('./note');
const likeModule = require('./like');
const userModule = require('./user');
const userPoolModule = require('./Cognito/userPool');

// Too lazy to deal with CORS :) (should actually set an origin in the future)
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
};

function proxyResponse(response) {
  return {
    statusCode: 200,
    body: JSON.stringify(response),
    headers: CORS_HEADERS
  };
}

function proxyClientError(err) {
  if(err.clientError) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        name: err.name,
        message: err.message
      }),
      headers: CORS_HEADERS
    };
  }

  throw err;
}

module.exports.getProblems = async function(event) {
  const platform = event.queryStringParameters.platform;
  const contestId = event.queryStringParameters.contestId;
  const problemId = event.queryStringParameters.problemId;

  if(problemId) {
    const problemInfo = await problemModule.getProblemInfo(platform, problemId);
    return proxyResponse(problemInfo);
  }

  const problems = await problemModule.getProblems(platform, contestId);
  return proxyResponse(problems);
}

module.exports.getContests = async function(event) {
  const platform = event.queryStringParameters.platform;
  const contests = await contestModule.getContests(platform);

  return proxyResponse(contests);
}

module.exports.getUsers = async function(event) {
  const username = event.queryStringParameters.username;
  const searchTerm = event.queryStringParameters.searchTerm;
  const page = event.queryStringParameters.page || 1;
  const tokenString = event.headers['Authorization'];

  try {
    if(username) {
      const profile = await userModule.getProfile(username, tokenString);
      return proxyResponse(profile);
    }
    else if(searchTerm) {
      const usernames = await userPoolModule.searchUsers(searchTerm);
      return proxyResponse(usernames);
    }
    else {
      const users = await userModule.getUsers(page);
      return proxyResponse(users);
    }
  }
  catch(err) {
    return proxyClientError(err);
  }
}

module.exports.updateUserProfile = async function(event) {
  const body = JSON.parse(event.body);
  const username = '' + body.username;
  const avatarData = '' + body.avatarData;
  const avatarExtension = '' + body.avatarExtension;
  const tokenString = event.headers['Authorization'];

  try {
    await userModule.updateProfile(username, avatarData, avatarExtension, tokenString);
    return proxyResponse('Success!');
  }
  catch(err) {
    return proxyClientError(err);
  }
}

async function addOrEditNote(event, overwrite) {
  const body = JSON.parse(event.body);
  const username = '' + body.username;
  const platform = '' + body.platform;
  const problemId = '' + body.problemId;
  const title = body.title ? '' + body.title : '';
  const solved = body.solved ? Number(body.solved) : 0;
  const content = body.content ? '' + body.content : '[]';
  const published = body.published === undefined ? false : !!body.published;
  const tokenString = event.headers['Authorization'];

  await noteModule.addOrEditNote(username, platform, problemId, title, solved,
                                 content, published, tokenString, overwrite);

  return proxyResponse('Success');
}

module.exports.addNote = async function(event) {
  return await addOrEditNote(event, false);
}

module.exports.editNote = async function(event) {
  return await addOrEditNote(event, true);
}

module.exports.getNotes = async function(event) {
  const username = event.queryStringParameters.username;
  const platform = event.queryStringParameters.platform;
  const problemId = event.queryStringParameters.problemId;
  const forcePublished = event.queryStringParameters.forcePublished;
  const tokenString = event.headers['Authorization'];

  try {
    if(problemId) {
      const noteInfo = await noteModule.getNoteInfo(
        username, platform, problemId, tokenString, forcePublished
      );
      return proxyResponse(noteInfo);
    }

    const notes = await noteModule.getNotes(username);
    return proxyResponse(notes);
  }
  catch(err) {
    return proxyClientError(err);
  }
}

module.exports.deleteNote = async function(event) {
  const body = JSON.parse(event.body);
  const username = '' + body.username;
  const platform = '' + body.platform;
  const problemId = '' + body.problemId;
  const tokenString = event.headers['Authorization'];

  try {
    await noteModule.deleteNote(username, platform, problemId, tokenString);
    return proxyResponse('Success');
  }
  catch(err) {
    return proxyClientError(err);
  }
}

module.exports.editNoteLike = async function(event) {
  const body = JSON.parse(event.body);
  const username = '' + body.username;
  const noteAuthor = '' + body.noteAuthor;
  const platform = '' + body.platform;
  const problemId = '' + body.problemId;
  const likedStatus = parseInt(body.likedStatus);
  const tokenString = event.headers['Authorization'];

  await likeModule.setUserNoteLikedStatus(
    username, noteAuthor, platform, problemId, likedStatus, tokenString
  );
  return proxyResponse('Success!');
}
