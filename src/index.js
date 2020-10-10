const problemModule = require('./problem');
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
  const problems = await problemModule.getProblems(platform);

  return proxyResponse(problems);
}

module.exports.getUserProfile = async function(event) {
  const username = event.queryStringParameters.username;
  const tokenString = event.headers['Authorization'];

  const profile = await usersModule.getProfile(username, tokenString);
  if(!profile)
    return proxyClientError('UserNotFound', 'User not found!');

  return proxyResponse(profile);
}
