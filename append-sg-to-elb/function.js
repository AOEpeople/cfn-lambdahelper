var response = require('cfn-response');
var AWS = require('aws-sdk');
var elb = new AWS.ELB({region: 'us-east-1'});

exports.handler = function (event, context) {

    console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));

    var LoadBalancerName = event.ResourceProperties.LoadBalancerName || errorExit('No LoadBalancerName found', event, context);
    var SecurityGroupId = event.ResourceProperties.SecurityGroupId || errorExit('No SecurityGroupId found', event, context);

    if (event.RequestType == 'Delete') {
        elb.describeLoadBalancers({LoadBalancerNames: [LoadBalancerName]}, function (err, data) {
            if (err) {
                errorExit(err, event, context);
            } else {
                var securityGroups = data.LoadBalancerDescriptions[0].SecurityGroups;
                console.log(securityGroups);
                var index = securityGroups.indexOf(SecurityGroupId);
                if (index == -1) {
                    console.log('Security group was already removed');
                    response.send(event, context, response.SUCCESS, {});
                } else {
                    // remove security group from array
                    securityGroups.splice(index, 1);
                    console.log(securityGroups);
                    elb.applySecurityGroupsToLoadBalancer({
                        LoadBalancerName: LoadBalancerName,
                        SecurityGroups: securityGroups
                    }, function (err, data) {
                        if (err) {
                            errorExit(err, event, context);
                        } else {
                            response.send(event, context, response.SUCCESS, {});
                        }
                    });
                }
            }
        });
    } else {
        elb.describeLoadBalancers({LoadBalancerNames: [LoadBalancerName]}, function (err, data) {
            if (err) {
                errorExit(err, event, context);
            } else {
                var securityGroups = data.LoadBalancerDescriptions[0].SecurityGroups;
                console.log(securityGroups);
                if (securityGroups.indexOf(SecurityGroupId) == -1) {
                    // add security group to array
                    securityGroups.push(SecurityGroupId);
                    console.log(securityGroups);
                    elb.applySecurityGroupsToLoadBalancer({
                        LoadBalancerName: LoadBalancerName,
                        SecurityGroups: securityGroups
                    }, function (err, data) {
                        if (err) {
                            errorExit(err, event, context);
                        } else {
                            response.send(event, context, response.SUCCESS, {});
                        }
                    });
                } else {
                    console.log('Security group was already in place');
                    response.send(event, context, response.SUCCESS, {});
                }
            }
        });
    }
};

var errorExit = function (message, event, context) {
    responseData = {Error: message};
    console.log(responseData.Error);
    response.send(event, context, response.FAILED, responseData);
};