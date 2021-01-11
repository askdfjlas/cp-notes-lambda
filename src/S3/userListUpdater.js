const s3 = require('./s3');
const dynamodb = require('../Dynamodb/dynamodb');
const dynamodbUtils = require('../Dynamodb/dynamodbUtils');

const USER_TABLE = 'users';
const CACHE_NAME = 'cp-notes-cache';
const FILE_PREFIX = 'users/';
const PAGINATE_SIZE = 50;

module.exports.handler = async function() {
  const params = {
    TableName: USER_TABLE,
    ProjectionExpression: 'username, contribution'
  };

  let rows = await dynamodb.scanPromise(params);
  let users = dynamodbUtils.filterRows(rows);
  users.sort((user1, user2) => user2.contribution - user1.contribution);

  for(let i = 0; i < Math.ceil(users.length/PAGINATE_SIZE); i++) {
    const startIndex = i * PAGINATE_SIZE;
    const endIndex = Math.min(users.length, startIndex + PAGINATE_SIZE);

    let userPageObject = {
      total: users.length,
      lastUpdated: (new Date()).toJSON(),
      users: []
    };

    for(let j = startIndex; j < endIndex; j++) {
      userPageObject.users.push(users[j]);
    }

    const fileName = `${FILE_PREFIX}${i + 1}.json`;
    await s3.writeFile(CACHE_NAME, fileName, JSON.stringify(userPageObject));
  }
}
