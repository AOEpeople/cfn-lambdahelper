var response = require('cfn-response');
exports.handler = function (event, context) {

    console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));
    if (event.RequestType == 'Delete') {
        // TODO: do we need to remove this security group or does this happen explicitely when the security group is deleted?
        response.send(event, context, response.SUCCESS);
        return;
    }

    var LoadBalancerName = event.ResourceProperties.LoadBalancerName || errorExit('No LoadBalancerName found', event, context);
    var SecurityGroupId = event.ResourceProperties.SecurityGroupId || errorExit('No SecurityGroupId found', event, context);

    var AWS = require('aws-sdk');
    var elb = new AWS.ELB({region: 'us-east-1'});

    elb.describeLoadBalancers({LoadBalancerNames: [LoadBalancerName]}, function(err, data) {
        if (err) {
            errorExit(err, event, context);
        } else {
            var securityGroups = data.LoadBalancerDescriptions[0].SecurityGroups;
            console.log(securityGroups);
            if (securityGroups.indexOf(SecurityGroupId) == -1) {
                securityGroups.push(SecurityGroupId);
                console.log(securityGroups);
                elb.applySecurityGroupsToLoadBalancer({
                    LoadBalancerName: LoadBalancerName,
                    SecurityGroups: securityGroups
                }, function (err, data) {
                    if (err) {
                        errorExit(err, event, context);
                    } else {
                        console.log(data)
                        response.send(event, context, response.SUCCESS, {});
                    }
                });
            } else {
                console.log('Security group was already in place');
                response.send(event, context, response.SUCCESS, {});
            }
        }
    });
};

var errorExit = function (message, event, context) {
    responseData = {Error: message};
    console.log(responseData.Error);
    response.send(event, context, response.FAILED, responseData);
};