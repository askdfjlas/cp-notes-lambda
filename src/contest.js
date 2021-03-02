const CONTEST_TABLE = 'contests';
const CONTEST_PK = 'platform';
const CONTEST_ID_LENGTH = 8;
const CONTEST_CACHE_PATH = 'problem-data/contests/';

const dynamodb = require('./Dynamodb/dynamodb');
const dynamodbUtils = require('./Dynamodb/dynamodbUtils');
const s3 = require('./S3/s3');
const cacheConstants = require('./S3/cacheConstants');

function prettifyContestIds(platform, contests) {
  for(let i = 0; i < contests.length; i++) {
    contests[i].sk = dynamodbUtils.removePrefixZeroes(contests[i].sk);
  }
}

function inflateContestId(contestId) {
  let arr = contestId.split('@');
  arr[0] = dynamodbUtils.inflatePrefixZeroes(arr[0], CONTEST_ID_LENGTH);
  return arr.join('@');
}

async function getContests(platform) {
  const contestsString = await s3.getFile(cacheConstants.CACHE_NAME,
    `${CONTEST_CACHE_PATH}${platform}.json`);
  return JSON.parse(contestsString);
}

async function getContestInfo(platform, contestId) {
  const dbContestId = inflateContestId(contestId);

  const contestRows = await dynamodb.queryPrimaryKey(CONTEST_TABLE, CONTEST_PK,
    'sk', platform, dbContestId, [ 'name', 'contestCode' ]
  );

  if(contestRows.length === 0) {
    throw Error('Contest not found!');
  }
  const contestRow = contestRows[0];

  return {
    name: contestRow.name,
    code: contestRow.contestCode
  };
}

module.exports.getContests = getContests;
module.exports.getContestInfo = getContestInfo;
module.exports.inflateContestId = inflateContestId;
