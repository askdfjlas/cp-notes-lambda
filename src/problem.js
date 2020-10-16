const PROBLEM_TABLE = 'problems';
const PROBLEM_PK = 'platform';

const contestModule = require('./contest');
const dynamodb = require('./Dynamodb/dynamodb');
const dynamodbUtils = require('./Dynamodb/dynamodbUtils');

function replaceProblemSortKeys(problems) {
  for(let i = 0; i < problems.length; i++) {
    const arr = problems[i].sk.split('#');

    const prettyContestId = dynamodbUtils.removePrefixZeroes(arr[0]);
    const problemId = arr[1];

    problems[i].sk = prettyContestId + problemId;
  }
}

async function getProblems(platform, contestId) {
  var problems;

  if(contestId) {
    dbContestId = contestModule.inflateContestPrefixZeroes(contestId);
    problems =  await dynamodb.queryPrimaryKey(PROBLEM_TABLE, PROBLEM_PK,
      'sk', platform, dbContestId, [
        'sk', 'name'
    ]);
  }
  else {
    problems = await dynamodb.queryPartitionKey(PROBLEM_TABLE, PROBLEM_PK,
      platform, true, [
        'sk', 'name'
    ]);
  }

  replaceProblemSortKeys(problems);
  return problems;
}

module.exports.getProblems = getProblems;
