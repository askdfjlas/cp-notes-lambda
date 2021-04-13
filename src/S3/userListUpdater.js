const s3 = require('./s3');
const cacheConstants = require('./cacheConstants');
const dynamodb = require('../Dynamodb/dynamodb');
const dynamodbUtils = require('../Dynamodb/dynamodbUtils');

const USER_TABLE = 'users';
const PAGINATE_SIZE = 50;

module.exports.handler = async function() {
  const params = {
    TableName: USER_TABLE,
    ProjectionExpression: 'username, contribution, cfRank'
  };

  let rows = await dynamodb.scanPromise(params);
  let users = dynamodbUtils.filterRows(rows);
  users.sort((user1, user2) => user2.contribution - user1.contribution);

  const totalPages = Math.ceil(users.length/PAGINATE_SIZE);
  for(let i = 0; i < totalPages; i++) {
    const startIndex = i * PAGINATE_SIZE;
    const endIndex = Math.min(users.length, startIndex + PAGINATE_SIZE);

    let userPageObject = {
      totalPages: totalPages,
      lastUpdated: (new Date()).toJSON(),
      users: []
    };

    for(let j = startIndex; j < endIndex; j++) {
      userPageObject.users.push(users[j]);
    }

    const fileName = `${cacheConstants.USER_FILE_PREFIX}${i + 1}.json`;
    await s3.writeFile(cacheConstants.CACHE_NAME, fileName, JSON.stringify(userPageObject));
  }
}
