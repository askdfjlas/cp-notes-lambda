const CONTEST_TABLE = 'contests';
const CONTEST_PK = 'platform';
const CONTEST_ID_LENGTH = 8;

const dynamodb = require('./Dynamodb/dynamodb');
const dynamodbUtils = require('./Dynamodb/dynamodbUtils');

function prettifyContestIds(contests) {
  for(let i = 0; i < contests.length; i++) {
    contests[i].sk = dynamodbUtils.removePrefixZeroes(contests[i].sk);
  }
}

function inflateContestId(contestId) {
  return dynamodbUtils.inflatePrefixZeroes(contestId, CONTEST_ID_LENGTH);
}

async function getContests(platform) {
  var contests = await dynamodb.queryPartitionKey(CONTEST_TABLE, CONTEST_PK,
    platform, false, [
    'sk', 'name'
  ]);

  prettifyContestIds(contests);
  return contests;
}

module.exports.getContests = getContests;
module.exports.inflateContestId = inflateContestId;
