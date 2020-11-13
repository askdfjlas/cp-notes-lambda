const problemModule = require('./problem');
const contestModule = require('./contest');
const noteModule = require('./note');
const usersModule = require('./Cognito/users');

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

module.exports.getUserProfile = async function(event) {
  const username = event.queryStringParameters.username;
  const tokenString = event.headers['Authorization'];

  try {
    const profile = await usersModule.getProfile(username, tokenString);
    return proxyResponse(profile);
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

module.exports.getNote = async function(event) {
  const username = event.queryStringParameters.username;
  const platform = event.queryStringParameters.platform;
  const problemId = event.queryStringParameters.problemId;
  const tokenString = event.headers['Authorization'];

  try {
    const noteInfo = await noteModule.getNote(
      username, platform, problemId, tokenString
    );
    return proxyResponse(noteInfo);
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
