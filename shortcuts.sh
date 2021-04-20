alias cpbeta='export AWS_PROFILE=beta'
alias cpprod='export AWS_PROFILE=prod'

cplambdadeploy()
{
  if [ $AWS_PROFILE = 'beta' ]
  then
    cdk deploy
  else
    echo YOU\'RE DEPLOYING TO PROD - YOU SURE ABOUT THIS?
    read answer
    if [ $answer = 'y' ]
    then
      cdk deploy
    else
      echo DEPLOYMENT STOPPED
    fi
  fi
}
