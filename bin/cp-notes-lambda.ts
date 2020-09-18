#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CpNotesLambdaStack } from '../lib/cp-notes-lambda-stack';

const app = new cdk.App();
new CpNotesLambdaStack(app, 'CpNotesLambdaStack');
