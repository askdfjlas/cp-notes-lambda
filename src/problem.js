const PROBLEM_TABLE = 'problems';
const PROBLEM_PK = 'platform';
const PROBLEM_CACHE_PATH = 'problem-data/problems/';

const contestModule = require('./contest');
const dynamodb = require('./Dynamodb/dynamodb');
const dynamodbUtils = require('./Dynamodb/dynamodbUtils');
const s3 = require('./S3/s3');
const cacheConstants = require('./S3/cacheConstants');

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

function getProblemLink(platform, problemId, rd) {
  let contestCode, problemCode, arr;
  switch(platform) {
    case 'CodeForces':
      contestCode = problemId.split('#')[0];
      problemCode = problemId.split('#')[1];
      return `https://codeforces.com/contest/${contestCode}/problem/${problemCode}`;
    case 'CodeChef':
      arr = problemId.split('@');
      contestCode = arr[1].split('#')[0];
      problemCode = arr[1].split('#')[1];
      return `https://www.codechef.com/${contestCode}/problems/${problemCode}`;
    case 'AtCoder':
      arr = problemId.split('@');
      contestCode = arr[1].split('#')[0].toLowerCase();
      problemCode = arr[1].split('#')[1].toLowerCase();
      return `https://atcoder.jp/contests/${contestCode}/tasks/${contestCode}_${problemCode}`
    case 'TopCoder':
      return `https://community.topcoder.com/stat?c=problem_statement&pm=${rd}`
    case 'Project Euler':
      problemCode = dynamodbUtils.removePrefixZeroes(problemId.split('#')[1]);
      return `https://projecteuler.net/problem=${problemCode}`
    case 'ICPC':
      return `https://icpc.kattis.com/problems/${rd}`
    default:
      return null;
  }
}

async function getProblems(platform, contestId) {
  if(contestId) {
    const dbContestId = contestModule.inflateContestId(contestId);
    let problems =  await dynamodb.queryPrimaryKey(PROBLEM_TABLE, PROBLEM_PK,
      'sk', platform, dbContestId, [
        'sk', 'name', 'problemCode'
      ]
    );
    prettifyProblemIds(problems);
    return problems;
  }
  else {
    const problemsString = await s3.getFile(cacheConstants.CACHE_NAME,
      `${PROBLEM_CACHE_PATH}${platform}.json`);
    return JSON.parse(problemsString);
  }
}

async function getProblemInfo(platform, problemId) {
  const contestId = problemId.split('#')[0];
  const dbProblemId = inflateProblemId(problemId);

  const problemRows = await dynamodb.queryPrimaryKey(PROBLEM_TABLE, PROBLEM_PK,
    'sk', platform, dbProblemId, [ 'name', 'level', 'rd', 'problemCode' ]
  );

  if(problemRows.length === 0) {
    throw Error('Problem not found!');
  }

  const contestInfo = await contestModule.getContestInfo(platform, contestId);
  const problemRow = problemRows[0];

  let problemInfo = {
    problemCode: problemRow.problemCode,
    problemName: problemRow.name,
    contestCode: contestInfo.code,
    contestName: contestInfo.name,
    link: getProblemLink(platform, problemId, problemRow.rd)
  };

  if(problemRow.level) {
    problemInfo.level = problemRow.level;
  }

  return problemInfo;
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
