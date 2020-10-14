const CONTEST_TABLE = 'contests';
const CONTEST_PK = 'platform';

const dynamodb = require('./dynamodb');

async function getContests(platform) {
  return await dynamodb.queryPartitionKey(CONTEST_TABLE, CONTEST_PK, platform, [
    'sk', 'name'
  ]);
}

module.exports.getContests = getContests;
