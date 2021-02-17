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

function getProblemLink(platform, problemId) {
  let contestCode, problemCode;
  switch(platform) {
    case 'CodeForces':
      contestCode = problemId.split('#')[0];
      problemCode = problemId.split('#')[1];
      return `https://codeforces.com/contest/${contestCode}/problem/${problemCode}`;
    case 'CodeChef':
      const arr = problemId.split('@');
      contestCode = arr[1].split('#')[0];
      problemCode = arr[1].split('#')[1];
      return `https://www.codechef.com/${contestCode}/problems/${problemCode}`;
    default:
      return null;
  }
}

async function getProblems(platform, contestId) {
  let problems;

  if(contestId) {
    const dbContestId = contestModule.inflateContestId(contestId);
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

async function getProblemInfo(platform, problemId) {
  const contestId = problemId.split('#')[0];
  const dbProblemId = inflateProblemId(problemId);

  const problemRows = await dynamodb.queryPrimaryKey(PROBLEM_TABLE, PROBLEM_PK,
    'sk', platform, dbProblemId, [ 'name' ]
  );

  if(problemRows.length === 0) {
    throw Error('Problem not found!');
  }

  const contestInfo = await contestModule.getContestInfo(platform, contestId);
  const problemRow = problemRows[0];

  return {
    problemCode: problemId.replace('#', ''),
    problemName: problemRow.name,
    contestCode: contestInfo.code,
    contestName: contestInfo.name,
    link: getProblemLink(platform, problemId)
  };
}

async function checkExistence(platform, dbProblemId) {
  const dbRows = await dynamodb.queryPrimaryKey(PROBLEM_TABLE, PROBLEM_PK,
    'sk', platform, dbProblemId, [ 'sk' ]
  );

  return dbRows.length > 0;
}

module.exports.getProblems = getProblems;
module.exports.inflateProblemId = inflateProblemId;
module.exports.getProblemInfo = getProblemInfo;
module.exports.checkExistence = checkExistence;
