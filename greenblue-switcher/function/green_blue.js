
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
    var graceful = event.ResourceProperties.Graceful;

    console.log('====> RequestType: ' + event.RequestType);
    console.log('====> ELB: ' + elbName + ' ASG: ' + asgName);
    console.log('====> GRACEFUL MODE: ' + graceful);

    if (event.RequestType != 'Create') {
        response.send(event, context, response.SUCCESS, {"message": "Nothing to do"});
        context.done();
        return;
    }

    // 1. Attach [asgName] to [elbName]
    attachAsgToElb(elbName, asgName, function() {

        var retryCounter = 0;

        var abortErrorFilter = function() {
            var remainingTime = context.getRemainingTimeInMillis();
            if (remainingTime < 10000) {
                console.log('Aborting since there are only ' + remainingTime + 'ms left.');
                return false; // async.retry will abort
            } else {
                console.log('There is time left ('+remainingTime+'ms). Keep trying...');
                return true; // async.retry will continue retrying
            }
        };

        // 2. Wait until all [asgName]'s instances show up as "InService" in the [elbName]
        async.retry({times: 150, interval: 2000, errorFilter: abortErrorFilter}, function(callback) {
            retryCounter++;
            var remainingTime = context.getRemainingTimeInMillis();
            console.log('---- RETRY: ' + retryCounter + ', TIME LEFT: ' +remainingTime + ' ms ---------------------------------');
            console.log('Comparing elb and asg instances...');
            compareElbAndAsgInstances(elbName, asgName, function(err, allInService) {
                if (err) {
                    callback(err);
                } else {
                    console.log('Done.');
                    if (!allInService) {
                        callback('Not all instances are InService yet', null);
                    } else {
                        callback(null, 'All instances are InService');
                    }
                }
            });
        }, function(err) {
            if (err) {
                console.log("Not all instances InService after many retries.");

                if (graceful) {
                    // skip detaching for debugging purposes
                    response.send(event, context, response.SUCCESS, {"message": "ASG did not stabilize (graceful mode)"});
                    return;
                }

                var params = {
                    AutoScalingGroupName: asgName,
                    LoadBalancerNames: [elbName]
                };
                console.log("Detaching new ASG " + asgName);
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
                console.log("Detaching all ASGs except " + asgName);
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
        if (err) {
            callback(err);
        } else {
            getAllInstancesForElb(elbName, function (err, elbInstances) {
                if (err) {
                    callback(err);
                } else {
                    var allInService = true;
                    Object.keys(asgInstances).forEach(function (instanceId) {
                        var state = asgInstances[instanceId];
                        console.log('['+instanceId+'] ASG: ' + state + '; ELB: ' + elbInstances[instanceId]);
                        if (state != 'InService') {
                            allInService = false;
                            console.log('Found instance ' + instanceId + ' which is not InService (ASG)');
                        }
                        if (elbInstances[instanceId] != 'InService') {
                            allInService = false;
                            console.log('Found instance ' + instanceId + ' which is not InService (ELB)');
                        }
                    });
                    callback(null, allInService);
                }
            });
        }
    });
}

function getAllInstancesForElb(elbName, callback) {
    console.log('Getting all instances for ELB ' + elbName);
    var instances = {};
    var params = { LoadBalancerName: elbName };
    elbClient.describeInstanceHealth(params, function(err, data) {
        if (err) {
            console.log(err, err.stack);
            callback(err);
        } else {
            console.log('ELB.describeInstanceHealth:');
            console.log(data);
            data.InstanceStates.forEach(function(instanceState) {
                instances[instanceState.InstanceId] = instanceState.State;
            });
            console.log('Instances found in ELB ' + elbName + ':');
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
            callback(err);
        } else {
            // TODO: verify this autoscaling group was found
            data.AutoScalingGroups[0].Instances.forEach(function(instance) {
                instances[instance.InstanceId] = instance.LifecycleState;
            });
            console.log('Instances found in ASG ' + asgName + ':');
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
            callback(err);
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

