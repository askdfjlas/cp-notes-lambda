const problemModule = require('./problem');

function proxyResponse(response) {
  return {
    statusCode: 200,
    body: JSON.stringify(response),
    // Too lazy to deal with CORS :)
    headers: {
      'Access-Control-Allow-Origin': '*',
    }
  };
}

async function getProblems(event) {
  const platform = event.queryStringParameters.platform;
  const problems = await problemModule.getProblems(platform);

  return proxyResponse(problems);
}

module.exports.getProblems = getProblems;
