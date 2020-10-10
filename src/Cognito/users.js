const jwt = require('../Cognito/jwt');
const userPool = require('./userPool');

module.exports.getProfile = async function(username, tokenString) {
  try {
    var requesterUsername = await jwt.verify(tokenString);
  }
  catch(err) {
    console.log(err.message);
    var requesterUsername = null;
  }

  const requestedUser = await userPool.queryUsername(username);
  if(!requestedUser)
    return null;

  var userProfile = {
    username: username
  };

  if(requesterUsername === username) {
    userProfile.email = userPool.getUserAttribute(requestedUser, 'email');
  }

  return userProfile;
}
