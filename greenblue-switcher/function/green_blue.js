
var AWS = require('aws-sdk');
var async = require('async');
var response = require('cfn-response');

if (!AWS.config.region) {
    AWS.config.update({region: 'eu-west-1'});
}

var asgClient = new AWS.AutoScaling({apiVersion: '2011-01-01'});
var elbClient = new AWS.ELB({apiVersion: '2012-06-01'});

exports.handler = function (event, context) {

    var elbName = event.ResourceProperties.LoadBalancerName;
    var asgName = event.ResourceProperties.AutoScalingGroupName;

    console.log('====> RequestType: ' + event.RequestType);
    console.log('====> ELB: ' + elbName + ' ASG: ' + asgName);

    if (event.RequestType != 'Create') {
        response.send(event, context, response.SUCCESS, {"message": "Nothing to do"});
        context.done();
        return;
    }

    // 1. Attach [asgName] to [elbName]
    attachAsgToElb(elbName, asgName, function() {

        // 2. Wait until all [asgName]'s instances show up as "InService" in the [elbName]
        async.retry({times: 180, interval: 1000}, function(callback, results) {
            console.log('Comparing elb and asg instances...');
            compareElbAndAsgInstances(elbName, asgName, function(allInService) {
                console.log('Done.');
                if (!allInService) {
                    callback('Not all instances are InService yet', null);
                } else {
                    callback(null, 'All instances are InService');
                }
            });
        }, function(err, result) {
            if (err) {
                console.log("Not all instances InServices after many retries");
                var params = {
                    AutoScalingGroupName: asgName,
                    LoadBalancerNames: [elbName]
                };
                asgClient.detachLoadBalancers(params, function(err, data) {
                    if (err) {
                        console.log(err, err.stack);
                        console.log("Error detaching " + asgName); // TODO: what now?!
                    } else {
                        console.log("Successfully detached " + asgName);
                    }
                    response.send(event, context, response.FAILED, {"message": "ASG did not stabilize"});
                });
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
    console.log('Attaching ASG ' + asgName + ' to ELB ' + elbName);
    var params = {
        AutoScalingGroupName: asgName,
        LoadBalancerNames: [elbName]
    };
    asgClient.attachLoadBalancers(params, function(err, data) {
        if (err) {
            console.log(err, err.stack);
        } else {
            console.log('Successfully attached ASG ' + asgName + ' to ELB ' + elbName);
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
                    console.log('Found instance ' +  instanceId + ' which is not InService (ASG)');
                }
                if (elbInstances[instanceId] != 'InService') {
                    allInService = false;
                    console.log('Found instance ' +  instanceId + ' which is not InService (ELB)');
                }
            });
            callback(allInService);
        });
    });
}

function getAllInstancesForElb(elbName, callback) {
    console.log('Getting all instances for ELB ' + elbName);
    var instances = {};
    var params = { LoadBalancerName: elbName };
    elbClient.describeInstanceHealth(params, function(err, data) {
        if (err) {
            console.log(err, err.stack);
        } else {
            data.InstanceStates.forEach(function(instanceState) {
                instances[instanceState.InstanceId] = instanceState.State;
            });
            console.log(instances);
            callback(null, instances);
        }
    });
}

function getAllInstancesForAsg(asgName, callback) {
    console.log('Getting all instances for ASG ' + asgName);
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
            console.log(instances);
            callback(null, instances);
        }
    });
}

function findAsgsByElb(elbName, callback) {
    console.log('Finding all ASG for ELB ' + elbName);
    var autoScalingGroups = [];
    asgClient.describeAutoScalingGroups({}, function(err, data) {
        if (err) {
            console.log(err, err.stack);
        } else {
            data.AutoScalingGroups.forEach(function(autoScalingGroup) {
                if (autoScalingGroup.LoadBalancerNames.indexOf(elbName) >= 0) {
                    autoScalingGroups.push(autoScalingGroup.AutoScalingGroupName);
                }
            });
            callback(null, autoScalingGroups);
        }
    });
}

