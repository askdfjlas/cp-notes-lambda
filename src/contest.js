const CONTEST_TABLE = 'contests';
const CONTEST_PK = 'platform';

const dynamodb = require('./Dynamodb/dynamodb');
const dynamodbUtils = require('./Dynamodb/dynamodbUtils');

const CONTEST_ID_LENGTH = 8;

function replaceContestSortKeys(contests) {
  for(let i = 0; i < contests.length; i++) {
    contests[i].sk = dynamodbUtils.removePrefixZeroes(contests[i].sk);
  }
}

function inflateContestPrefixZeroes(inputString) {
  return dynamodbUtils.inflatePrefixZeroes(inputString, CONTEST_ID_LENGTH);
}

async function getContests(platform) {
  var contests = await dynamodb.queryPartitionKey(CONTEST_TABLE, CONTEST_PK,
    platform, false, [
    'sk', 'name'
  ]);

  replaceContestSortKeys(contests);
  return contests;
}

module.exports.getContests = getContests;
module.exports.inflateContestPrefixZeroes = inflateContestPrefixZeroes;
