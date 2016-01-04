var response = require('cfn-response');
exports.handler = function (event, context) {

    console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));
    if (event.RequestType == 'Delete') {
        response.send(event, context, response.SUCCESS);
        return;
    }

    var responseData = {};

    var params = {
        ChangeBatch: {
            Changes: [{
                Action: 'UPSERT',
                ResourceRecordSet: {
                    Name: event.ResourceProperties.Name,
                    Type: 'A',
                    AliasTarget: {
                        DNSName: event.ResourceProperties.AliasTargetDNSName,
                        EvaluateTargetHealth: false,
                        HostedZoneId: event.ResourceProperties.AliasTargetHostedZoneId
                    }
                }
            }],
            Comment: event.ResourceProperties.Comment
        },
        HostedZoneId: event.ResourceProperties.HostedZoneId
    };

    var AWS = require('aws-sdk');
    var route53 = new AWS.Route53();

    route53.changeResourceRecordSets(params, function (err, data) {
        if (err) {
            responseData.Error = 'changeResourceRecordSets call failed';
            console.log(responseData.Error + ':\\n', err);
            response.send(event, context, response.FAILED, responseData);
        } else {
            var changeId = data.ChangeInfo.Id.split('/')[2];
            console.log('ChangeId: ' + changeId);
            responseData.ChangeId = changeId;
            var check = function () {
                console.log('Polling...');
                route53.getChange({Id: changeId}, function (err, data) {
                    if (err) {
                        responseData.Error = 'changeResourceRecordSets call failed';
                        console.log(responseData.Error + ':\\n', err);
                        response.send(event, context, response.FAILED, responseData);
                    } else {
                        var status = data.ChangeInfo.Status;
                        console.log('Status: ' + status);
                        if (status == 'PENDING') {
                            setTimeout(check, 3000);
                        } else {
                            responseData.status = status;
                            console.log('DONE!');
                            response.send(event, context, response.SUCCESS, responseData);
                        }
                    }
                });
            };
            setTimeout(check, 3000);
        }
    });
};