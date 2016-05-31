var AWS = require('aws-sdk');
var async = require('async');
var response = require('cfn-response');

if (!AWS.config.region) {
    AWS.config.update({region: 'us-east-1'});
}

var ec2 = new AWS.EC2();

exports.handler = function (event, context) {

    // console.log("REQUEST RECEIVED:\n", JSON.stringify(event));

    if (event.RequestType == "Delete" && !event.ResourceProperties.InstanceId) {
        response.send(event, context, response.SUCCESS, {Info: "Nothing to delete"});
    }

    var p = event.ResourceProperties,
        stackName = p.StackName || errorExit('StackName missing', event, context),
        instanceId = p.InstanceId || errorExit('InstanceId missing', event, context),
        amiName = p.AmiName || stackName + '-' + instanceId,
        ownerId = event.ResourceProperties.OwnerId || errorExit('OwnerId missing', event, context),
        tags = p.Tags || [],
        res = {},
        tagPrefix = 'cfn:',
        accounts = p.AdditionalAwsAccounts || [];

    if (event.RequestType == "Delete") {
        async.waterfall([

            function findImage(next) {
                console.log("=> Finding image by tags");
                var params = {
                    Filters: [
                        {Name: 'tag:' + tagPrefix + 'stack-name', Values: [stackName]},
                        {Name: 'tag:' + tagPrefix + 'stack-id', Values: [event.StackId]},
                        {Name: 'tag:' + tagPrefix + 'logical-id', Values: [event.LogicalResourceId]}
                    ]
                };
                ec2.describeImages(params, function (err, data) {
                    if (err) {
                        errorExit("describeImages failed " + err, event, context);
                    } else if (data.Images.length === 0) {
                        response.send(event, context, response.SUCCESS, {Info: "Nothing to delete"});
                    } else {
                        var imageId = data.Images[0].ImageId;
                        console.log('Found image ' + imageId);
                        next(null, imageId)
                    }
                });
            },

            function deleteImage(ImageId, next) {
                console.log("=> Deleting image " + ImageId);

                ec2.deregisterImage({ImageId: ImageId}, function (err, data) {
                    if (err) {
                        errorExit("deregisterImage failed " + err, event, context);
                    } else {
                        next(null, ImageId);
                    }
                });

                next(null);
            },

            function findSnapshotsByImageId(ImageId, next) {
                console.log("=> Finding snapshots for image " + ImageId);

                var params = {
                    Filters: [ { Name: 'tag:' + tagPrefix + 'ami', Values: [ ImageId ] }],
                    OwnerIds: [ ownerId ]
                };
                ec2.describeSnapshots(params, function(err, data) {
                    if (err) {
                        console.log(err, err.stack);
                    } else {
                        if (data.Snapshots.length == 0) {
                            response.send(event, context, response.SUCCESS, {Info: "No snapshots found"});
                        } else if (data.Snapshots.length > 1) {
                            console.log("Found more than one snaphot. Only deleting the first one...");
                        }
                        var SnapshotId = data.Snapshots[0].SnapshotId;
                        console.log('Found snapshot ' + SnapshotId);
                        next(null, SnapshotId)
                    }
                });

            },

            function deleteSnapshot(SnapshotId, next) {
                console.log("=> Deleting snapshot snapshot " + SnapshotId);

                var params = { SnapshotId: SnapshotId };
                ec2.deleteSnapshot(params, function(err, data) {
                    if (err) {
                        console.log(err, err.stack);
                    }
                    next();
                });
            }

        ], function (error) {
            if (error) {
                console.log('ERROR: ' + error);
                response.send(event, context, response.FAILED, res);
            } else {
                response.send(event, context, response.DONE, res);
            }
        });
    } else {

        async.waterfall([

            function createImage(next) {
                console.log ('=> Creating image');
                ec2.createImage(
                    {
                        InstanceId: instanceId,
                        Name: amiName,
                        NoReboot: true
                    }, function (err, data) {
                        if (err) {
                            errorExit("createImage failed " + err, event, context);
                        } else {
                            var ImageId = data.ImageId;
                            console.log('New image id: ' + ImageId);
                            next(null, ImageId);
                        }
                    }
                );
            },

            function tagImage(ImageId, next) {
                console.log ('=> Tagging image');
                var params = {
                    Resources: [ImageId],
                    Tags: tags.concat([
                        {Key: tagPrefix + 'instance', Value: instanceId}, // just in case we need it for debugging
                        {Key: tagPrefix + 'stack-name', Value: stackName},
                        {Key: tagPrefix + 'stack-id', Value: event.StackId},
                        {Key: tagPrefix + 'logical-id', Value: event.LogicalResourceId}
                    ])
                };
                ec2.createTags(params, function (err, data) {
                    if (err) {
                        errorExit("createTags failed " + err, event, context);
                    } else {
                        res.ImageId = ImageId;
                        next(null, ImageId);
                    }
                });
            },

            function findSnapshotByImageId(ImageId, next) {
                console.log ('=> Finding snapshot by image id ' + ImageId);

                var params = {
                    OwnerIds: [ ownerId ],
                    MaxResults: 1000
                };

                // wait until snapshot shows up
                async.retry({times: 60, interval: 2000}, function(callback, results) {
                    console.log('Trying to find a matching snapshot...');
                    ec2.describeSnapshots(params, function(err, data) {
                        if (err) {
                            callback(err, err.stack);
                        } else {
                            var SnapshotId;
                            console.log(data.Snapshots.length);
                            data.Snapshots.forEach(function(snapshot) {
                                if (snapshot.Description.match(new RegExp("Created by CreateImage.*for " + ImageId + " from .*"))) {
                                    SnapshotId = snapshot.SnapshotId;
                                    console.log("Found snapshot: " + SnapshotId);
                                }
                            });
                            if (SnapshotId) {
                                callback(null, SnapshotId);
                            } else {
                                console.log('Could not find a snapshot for ' + ImageId);
                                callback('Could not find a snapshot for ' + ImageId);
                            }
                        }
                    });
                }, function(err, SnapshotId) {
                    if (err) {
                        next("Could not find snapshot after many retries");
                    } else {
                        next(null, SnapshotId, ImageId);
                    }
                });
            },

            function tagSnapshot(SnapshotId, ImageId, next) {
                console.log ('=> Tagging snapshot: ' + SnapshotId);
                var params = {
                    Resources: [SnapshotId],
                    Tags: tags.concat([
                        {Key: tagPrefix + 'ami', Value: ImageId},
                        {Key: tagPrefix + 'instance', Value: instanceId}, // just in case we need it for debugging
                        {Key: tagPrefix + 'stack-name', Value: stackName},
                        {Key: tagPrefix + 'stack-id', Value: event.StackId},
                        {Key: tagPrefix + 'logical-id', Value: event.LogicalResourceId}
                    ])
                };
                ec2.createTags(params, function (err, data) {
                    if (err) {
                        errorExit("createTags failed " + err, event, context);
                    } else {
                        res.ImageId = ImageId;
                        next(null, ImageId);
                    }
                });

            },

            function grantAccessToSecondaryAccount(ImageId, next) {
                if (accounts.length == 0) {
                    next();
                    return;
                }

                console.log('=> Granting access to some other accounts');

                var params = {
                    ImageId: ImageId,
                    LaunchPermission: {
                        Add: accounts.map(function (accountId) {
                            return {UserId: accountId};
                        })
                    }
                };

                // wait until image is ready
                async.retry({times: 60, interval: 2000}, function(callback, results) {
                    console.log('Trying to grant access to other accounts...');

                    ec2.modifyImageAttribute(params, function (err, data) {
                        if (err) {
                            console.log('Failed running modifyImageAttribute: ' + err);
                            callback(err, err.stack);
                        } else {
                            console.log('Successfully granted access to other accounts');
                            callback();
                        }
                    });
                }, function(err) {
                    if (err) {
                        next("Failed granting access after many retries")
                    } else {
                        next();
                    }
                });
            }

        ], function (error) {
            if (error) {
                console.log('ERROR: ' + error);
                response.send(event, context, response.FAILED, res);
            } else {
                response.send(event, context, response.DONE, res);
            }
        });
    }

};

var errorExit = function (message, event, context) {
    res = {Error: message};
    console.log(res.Error);
    response.send(event, context, response.FAILED, res);
};