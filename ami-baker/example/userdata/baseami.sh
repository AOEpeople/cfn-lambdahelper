#!/usr/bin/env bash

# This indicates the the complete process is done and is handled in a trap function
WAIT_CONDITION_HANDLE='{Ref:BakingCompleteHandle}'

function error_exit {
    echo ">>> ERROR_EXIT: $1. Signaling error to wait condition..."
    /usr/bin/cfn-signal --exit-code 1 --reason "$1" "${WAIT_CONDITION_HANDLE}";
    exit 1;
}
function done_exit {
    rv=$?
    if [ "$rv" == "0" ] ; then
        echo ">>> Signaling success to CloudFormation"
        /usr/local/bin/cfn-signal --exit-code $? "${WAIT_CONDITION_HANDLE}"
    else
        echo ">>> NOT sending success signal to CloudFormation (return value: ${rv})"
    fi
    exit $rv
}
trap "done_exit" EXIT



# Bake your AMI here...




# Let the AmiBaker know that this instance is ready for baking
echo "Signal 'ready for baking'"
/usr/local/bin/cfn-signal --exit-code $? "{Ref:ReadyForBakingHandle}"

# Wait for AMI to be available
echo "Waiting for AMI to be available..."
aws ec2 wait image-available \
    --filters 'Name=tag:cfn:stack-name,Values={Ref:AWS::StackName}' \
    --region '{Ref:AWS::Region}'

# Shutdown
echo "Shutting down instance now"
shutdown -h now