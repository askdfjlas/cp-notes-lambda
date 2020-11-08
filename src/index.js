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

function proxyClientError(name, message) {
  return {
    statusCode: 400,
    body: JSON.stringify({
      name: name,
      message: message
    }),
    headers: CORS_HEADERS
  };
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

  const profile = await usersModule.getProfile(username, tokenString);
  if(!profile)
    return proxyClientError('UserNotFound', 'User not found!');

  return proxyResponse(profile);
}

async function addOrEditNote(event, overwrite) {
  const body = JSON.parse(event.body);
  const username = body.username;
  const platform = body.platform;
  const problemId = body.problemId;
  const title = body.title || '';
  const solved = body.solved || '0';
  const content = body.content || '';
  const published = body.published || false;
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
