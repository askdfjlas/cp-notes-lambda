const aws = require('aws-sdk');
const cognitoConstants = require('./cognitoConstants');
const cognitoIdp = new aws.CognitoIdentityServiceProvider({
  region: cognitoConstants.POOL_REGION
});

async function queryUsers(filterString) {
  const params = {
    UserPoolId: cognitoConstants.USER_POOL_ID,
    Filter: filterString
  };

  return await cognitoIdp.listUsers(params).promise();
}

function getSingleUser(data) {
  if(data.Users.length === 0)
    return null;
  return data.Users[0];
}

module.exports.queryEmail = async function(email) {
  const data = await queryUsers(`email = "${email}"`);
  return getSingleUser(data);
}

module.exports.queryUsername = async function(username) {
  const data = await queryUsers(`username = "${username}"`);
  return getSingleUser(data);
}

module.exports.getUserAttribute = function(user, attributeName) {
  for(const attribute of user.Attributes) {
    if(attribute.Name === attributeName)
      return attribute.Value;
  }
  return null;
}
