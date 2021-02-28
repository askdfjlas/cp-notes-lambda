const CONTEST_TABLE = 'contests';
const CONTEST_PK = 'platform';
const CONTEST_ID_LENGTH = 8;

const dynamodb = require('./Dynamodb/dynamodb');
const dynamodbUtils = require('./Dynamodb/dynamodbUtils');

function prettifyContestIds(platform, contests) {
  for(let i = 0; i < contests.length; i++) {
    contests[i].sk = dynamodbUtils.removePrefixZeroes(contests[i].sk);
    contests[i].contestCode = getContestCode(platform, contests[i].sk);
  }
}

function inflateContestId(contestId) {
  let arr = contestId.split('@');
  arr[0] = dynamodbUtils.inflatePrefixZeroes(arr[0], CONTEST_ID_LENGTH);
  return arr.join('@');
}

async function getContests(platform) {
  let contests = await dynamodb.queryPartitionKey(CONTEST_TABLE, CONTEST_PK,
    platform, false, [
    'sk', 'name'
  ]);

  prettifyContestIds(platform, contests);
  return contests;
}

function getContestCode(platform, contestId) {
  if(platform === 'CodeChef' || platform === 'AtCoder') {
    return contestId.split('@')[1];
  }
  return contestId;
}

async function getContestInfo(platform, contestId) {
  const dbContestId = inflateContestId(contestId);

  const contestRows = await dynamodb.queryPrimaryKey(CONTEST_TABLE, CONTEST_PK,
    'sk', platform, dbContestId, [ 'name' ]
  );

  if(contestRows.length === 0) {
    throw Error('Contest not found!');
  }
  const contestRow = contestRows[0];

  return {
    name: contestRow.name,
    code: getContestCode(platform, contestId)
  };
}

module.exports.getContests = getContests;
module.exports.getContestInfo = getContestInfo;
module.exports.inflateContestId = inflateContestId;
