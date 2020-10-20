const PROBLEM_TABLE = 'problems';
const PROBLEM_PK = 'platform';

const contestModule = require('./contest');
const dynamodb = require('./Dynamodb/dynamodb');
const dynamodbUtils = require('./Dynamodb/dynamodbUtils');

function prettifyProblemIds(problems) {
  for(let i = 0; i < problems.length; i++) {
    problems[i].sk = dynamodbUtils.removePrefixZeroes(problems[i].sk);
  }
}

function inflateProblemId(problemId) {
  const arr = problemId.split('#');

  const inflatedContestId = contestModule.inflateContestId(arr[0]);
  const problemCode = arr[1];

  return `${inflatedContestId}#${problemCode}`;
}

async function getProblems(platform, contestId) {
  var problems;

  if(contestId) {
    dbContestId = contestModule.inflateContestId(contestId);
    problems =  await dynamodb.queryPrimaryKey(PROBLEM_TABLE, PROBLEM_PK,
      'sk', platform, dbContestId, [
        'sk', 'name'
      ]
    );
  }
  else {
    problems = await dynamodb.queryPartitionKey(PROBLEM_TABLE, PROBLEM_PK,
      platform, true, [
        'sk', 'name'
      ]
    );
  }

  prettifyProblemIds(problems);
  return problems;
}

async function checkExistence(platform, dbProblemId) {
  const dbRows = await dynamodb.queryPrimaryKey(PROBLEM_TABLE, PROBLEM_PK,
    'sk', platform, dbProblemId, [ 'sk' ]
  );

  return dbRows.length > 0;
}

module.exports.getProblems = getProblems;
module.exports.inflateProblemId = inflateProblemId;
module.exports.checkExistence = checkExistence;
