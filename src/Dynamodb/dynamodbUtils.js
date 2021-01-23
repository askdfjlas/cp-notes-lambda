const USED_DDB_KEYWORDS = ['name'];

function filterType(data) {
  if(data.hasOwnProperty('S'))
    return data.S;
  else if(data.hasOwnProperty('BOOL'))
    return data.BOOL;
  return Number(data.N);
}

function filterRow(row) {
  let filteredRow = {};
  for(const property in row) {
    filteredRow[property] = filterType(row[property]);
  }
  return filteredRow;
}

function filterRows(rows) {
  var filteredRows = [];
  for(const row of rows.Items) {
    filteredRows.push(filterRow(row));
  }
  return filteredRows;
}

function filterProjectedAttributes(projectedAttributes) {
  let expressionAttributeNames = {};
  let noExpressionAttributes = true;

  for(let i = 0; i < projectedAttributes.length; i++) {
    if(USED_DDB_KEYWORDS.includes(projectedAttributes[i])) {
      const oldName = projectedAttributes[i];
      const newName = `#${projectedAttributes[i]}Replacement`;

      projectedAttributes[i] = newName;
      expressionAttributeNames[newName] = oldName;
      noExpressionAttributes = false;
    }
  }

  if(noExpressionAttributes)
    return null;

  return expressionAttributeNames;
}

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

function createDynamodbObjectFromValue(value) {
  if((typeof value) === 'string') {
    return { S: value };
  }
  else if((typeof value) === 'boolean') {
    return { BOOL: value };
  }
  else {
    return { N: '' + value };
  }
}

function createItemFromObject(valueObject) {
  let item = {};
  for(const property in valueObject) {
    const value = valueObject[property];
    item[property] = createDynamodbObjectFromValue(value);
  }
  return item;
}

function replaceAttributeValue(attribute) {
  if(attribute in USED_DDB_KEYWORDS) {
    return attribute + 'Replacement';
  }
  return attribute;
}

function generateUpdateExpression(additionUpdates={}, setUpdates={}) {
  let additionUpdateFragments = [];
  let setUpdateFragments = [];
  let expressionAttributeValues = {};

  for(let attribute in additionUpdates) {
    const oldAttribute = attribute;
    attribute = replaceAttributeValue(attribute);
    additionUpdateFragments.push(`${oldAttribute} :${attribute}`);

    const increment = additionUpdates[attribute];
    expressionAttributeValues[`:${attribute}`] = { N: '' + increment };
  }

  for(let attribute in setUpdates) {
    const oldAttribute = attribute;
    attribute = replaceAttributeValue(attribute);
    setUpdateFragments.push(`${oldAttribute} = :${attribute}`);

    expressionAttributeValues[`:${attribute}`] = createDynamodbObjectFromValue(
      setUpdates[attribute]
    );
  }

  let updateExpressions = [];
  if(additionUpdateFragments.length > 0) {
    updateExpressions.push('ADD ' + additionUpdateFragments.join(','));
  }
  if(setUpdateFragments.length > 0) {
    updateExpressions.push('SET ' + setUpdateFragments.join(','));
  }

  return [ updateExpressions.join(' '), expressionAttributeValues ];
}

module.exports.filterType = filterType;
module.exports.filterRow = filterRow;
module.exports.filterRows = filterRows;
module.exports.filterProjectedAttributes = filterProjectedAttributes;
module.exports.removePrefixZeroes = removePrefixZeroes;
module.exports.inflatePrefixZeroes = inflatePrefixZeroes;
module.exports.createItemFromObject = createItemFromObject;
module.exports.generateUpdateExpression = generateUpdateExpression;
