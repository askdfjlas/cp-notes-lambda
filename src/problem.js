const PROBLEM_TABLE = 'problems';
const PROBLEM_PK = 'platform';

const dynamodb = require('./dynamodb');

async function getProblems(platform) {
  return await dynamodb.queryPartitionKey(PROBLEM_TABLE, PROBLEM_PK, platform, [
    'sk', 'name'
  ]);
}

module.exports.getProblems = getProblems;
