const PROBLEM_TABLE = 'CpNotesLambdaStack-problemsA8758FC1-YCONP0CMUGAF';
const PROBLEM_PK = 'platform';

const dynamodb = require('./dynamodb');

async function getProblems(platform) {
  return await dynamodb.queryPK(PROBLEM_TABLE, PROBLEM_PK, platform);
}

module.exports.getProblems = getProblems;
