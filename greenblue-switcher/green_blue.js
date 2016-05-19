
var AWS = require('aws-sdk');
var async = require('async');

var response;
try {
    response = require('cfn-response');
} catch (ex) {
    response = {}
    response.SUCCESS = "SUCCESS";
    response.FAILED = "FAILED";
    response.send = function(event, context, responseStatus, responseData, physicalResourceId) {
        var responseBody = JSON.stringify({
            Status: responseStatus,
            Reason: "See the details in CloudWatch Log Stream: " + context.logStreamName,
            PhysicalResourceId: physicalResourceId || context.logStreamName,
            StackId: event.StackId,
            RequestId: event.RequestId,
            LogicalResourceId: event.LogicalResourceId,
            Data: responseData
        });
        console.log("Response body:\n", responseBody);
        context.done();
    }
}

if (!AWS.config.region) {
    AWS.config.update({region: 'us-east-1'});
}

// var response = require('cfn-response');

var asgClient = new AWS.AutoScaling({apiVersion: '2011-01-01'});
var elbClient = new AWS.ELB({apiVersion: '2012-06-01'});

exports.handler = function (event, context) {

    if (event.RequestType != 'Create') {
        response.send(event, context, response.SUCCESS, {"message": "Nothing to do"});
    }

    var elbName = event.ResourceProperties.LoadBalancerName;
    var asgName = event.ResourceProperties.AutoScalingGroupName;

    // 1. Attach [asgName] to [elbName]
    attachAsgToElb(elbName, asgName, function() {

        // 2. Wait until all [asgName]'s instances show up as "InService" in the [elbName]
        async.retry({times: 240, interval: 1000}, function(callback, results) {
            console.log('Comparing elb and asg instances...');
            compareElbAndAsgInstances(elbName, asgName, function(allInService) {
                console.log('Done.');
                if (!allInService) {
                    callback('Not all instances are InService', null);
                } else {
                    callback(null, 'All instances are InService');
                }
            });
        }, function(err, result) {
            if (err) {
                console.log("Not all instances InServices after many retries");
                response.send(event, context, response.FAILED, {"message": "ASG did not stabilize"});
            } else {
                console.log("All instances are InService");

                // 3. Detach all asg except [asgName] from [elbName]
                findAsgsByElb(elbName, function(err, autoScalingGroups) {
                    console.log("Found following autoscaling groups:");
                    console.log(autoScalingGroups);

                    if (autoScalingGroups.length == 1) {
                        response.send(event, context, response.SUCCESS, {"message": "This was already the only ASG attached to this ELB"});
                    }

                    var counter = 0;
                    autoScalingGroups.forEach(function(autoscalingGroup) {
                        if (autoscalingGroup != asgName) {
                            counter++;
                            var params = {
                                AutoScalingGroupName: autoscalingGroup,
                                LoadBalancerNames: [elbName]
                            };
                            asgClient.detachLoadBalancers(params, function(err, data) {
                                if (err) {
                                    console.log(err, err.stack);
                                    console.log("Error detaching " + autoscalingGroup); // TODO: what now?!
                                } else {
                                    console.log("Successfully detached " + autoscalingGroup);
                                }
                                counter--;
                                if (counter == 0) {
                                    response.send(event, context, response.SUCCESS, {"message": "Done"});
                                }
                            });
                        }
                    });
                });
            }
        });
    });
};

function attachAsgToElb(elbName, asgName, callback) {
    var params = {
        AutoScalingGroupName: asgName,
        LoadBalancerNames: [elbName]
    };
    asgClient.attachLoadBalancers(params, function(err, data) {
        if (err) {
            console.log(err, err.stack);
        } else {
            console.log("Successfully attached asg to elb");
            callback({}, true)
        }
    });
}

function compareElbAndAsgInstances(elbName, asgName, callback) {
    getAllInstancesForAsg(asgName, function(err, asgInstances) {
        getAllInstancesForElb(elbName, function(err, elbInstances) {
            var allInService = true;
            Object.keys(asgInstances).forEach(function(instanceId) {
                var state = asgInstances[instanceId];
                if (state != 'InService') {
                    allInService = false;
                }
                if (elbInstances[instanceId] != 'InService') {
                    allInService = false;
                }
            });
            callback(allInService);
        });
    });
}

function getAllInstancesForElb(loadBalancerName, callback) {
    var instances = {};
    var params = { LoadBalancerName: loadBalancerName };
    elbClient.describeInstanceHealth(params, function(err, data) {
        if (err) {
            console.log(err, err.stack);
        } else {
            data.InstanceStates.forEach(function(instanceState) {
                instances[instanceState.InstanceId] = instanceState.State;
            });
            callback(null, instances);
        }
    });
}

function getAllInstancesForAsg(asgName, callback) {
    var instances = {};
    var params = {AutoScalingGroupNames: [asgName]};
    asgClient.describeAutoScalingGroups(params, function(err, data) {
        if (err) {
            console.log(err, err.stack);
        } else {
            // TODO: verify this autoscaling group was found
            data.AutoScalingGroups[0].Instances.forEach(function(instance) {
                instances[instance.InstanceId] = instance.LifecycleState;
            });
            callback(null, instances);
        }
    });
}

function findAsgsByElb(loadBalancerName, callback) {
    var autoScalingGroups = [];
    asgClient.describeAutoScalingGroups({}, function(err, data) {
        if (err) {
            console.log(err, err.stack);
        } else {
            data.AutoScalingGroups.forEach(function(autoScalingGroup) {
                if (autoScalingGroup.LoadBalancerNames.indexOf(loadBalancerName) >= 0) {
                    autoScalingGroups.push(autoScalingGroup.AutoScalingGroupName);
                }
            });
            callback(null, autoScalingGroups);
        }
    });
}

