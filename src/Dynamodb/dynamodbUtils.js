function removePrefixZeroes(inputString) {
  let zeroCount = 0;
  for(let i = 0; i < inputString.length; i++) {
    if(inputString[i] !== '0') break;
    zeroCount++;
  }

  return inputString.substring(zeroCount, inputString.length);
}

function inflatePrefixZeroes(inputString, totalLength) {
  if(inputString.length > totalLength) {
    throw Error('Input string length exceeds total length!');
  }

  return ('0'.repeat(totalLength - inputString.length)) + inputString;
}

module.exports.removePrefixZeroes = removePrefixZeroes;
module.exports.inflatePrefixZeroes = inflatePrefixZeroes;
