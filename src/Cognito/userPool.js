const aws = require('aws-sdk');
const cognitoConstants = require('./cognitoConstants');
const cognitoIdp = new aws.CognitoIdentityServiceProvider({
  region: cognitoConstants.POOL_REGION
});

const USER_QUERY_LIMIT = 15;

async function queryUsers(filterString, attributesToGet) {
  const params = {
    UserPoolId: cognitoConstants.USER_POOL_ID,
    Filter: filterString,
    Limit: USER_QUERY_LIMIT,
    AttributesToGet: attributesToGet
  };

  return await cognitoIdp.listUsers(params).promise();
}

function getSingleUser(data) {
  if(data.Users.length === 0)
    return null;
  return data.Users[0];
}

async function queryEmail(email) {
  const data = await queryUsers(`email = "${email}"`);
  return getSingleUser(data);
}

 async function queryUsername(username) {
  const data = await queryUsers(`username = "${username}"`);
  return getSingleUser(data);
}

function getUserAttribute(user, attributeName) {
  for(const attribute of user.Attributes) {
    if(attribute.Name === attributeName)
      return attribute.Value;
  }
  return null;
}

async function searchUsers(searchTerm) {
  const data = await queryUsers(`username ^= "${searchTerm}"`, []);
  let usernames = [];
  for(const user of data.Users) {
    usernames.push(user.Username);
  }
  return usernames;
}

module.exports.queryEmail = queryEmail;
module.exports.queryUsername = queryUsername;
module.exports.getUserAttribute = getUserAttribute;
module.exports.searchUsers = searchUsers;
