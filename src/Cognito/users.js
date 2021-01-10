const jwt = require('./jwt');
const userPool = require('./userPool');
const utils = require('../utils');

module.exports.getProfile = async function(username, tokenString) {
  try {
    var requesterUsername = await jwt.verify(tokenString);
  }
  catch(err) {
    var requesterUsername = null;
  }

  const requestedUser = await userPool.queryUsername(username);
  if(!requestedUser) {
    utils.throwCustomError('UserNotFound', 'User not found!');
  }

  var userProfile = {
    username: username
  };

  if(requesterUsername === username) {
    userProfile.email = userPool.getUserAttribute(requestedUser, 'email');
  }

  return userProfile;
}
