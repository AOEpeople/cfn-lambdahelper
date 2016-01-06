var r = require('cfn-response');
var AWS = require('aws-sdk');

exports.handler = function (event, context) {
    console.log('REQUEST RECEIVED:\n', JSON.stringify(event));
    if (event.RequestType == 'Delete') {
        r.send(event, context, r.SUCCESS);
        return;
    }
    var rp = event.ResourceProperties;
    var r53 = new AWS.Route53();
    r53.getHostedZone({Id: rp.HostedZoneId}, function (err, data) {
        var resp = {};
        if (err) {
            resp.Error = 'getHostedZone call failed';
            console.log(resp.Error + ':\n', err);
            r.send(event, context, r.FAILED, resp);
        } else {
            var domain = data.HostedZone.Name;
            console.log('Domain: ' + domain);
            resp.Domain = domain;
            var names = rp.Name.split(",").map(function (v) {
                return v.trim();
            });
            var batch = [];
            for (var i = 0; i < names.length; i++) {
                batch.push(
                    {
                        Action: 'UPSERT',
                        ResourceRecordSet: {
                            Name: names[i] + '.' + domain,
                            Type: 'A',
                            AliasTarget: {
                                HostedZoneId: rp.AliasTargetHostedZoneId,
                                DNSName: rp.AliasTargetDNSName,
                                EvaluateTargetHealth: false
                            }
                        }
                    }
                );
            }
            r53.changeResourceRecordSets(
                {
                    ChangeBatch: {
                        Changes: batch,
                        Comment: rp.Comment
                    },
                    HostedZoneId: rp.HostedZoneId
                },
                function (err, data) {
                    if (err) {
                        resp.Error = 'changeResourceRecordSets call failed';
                        console.log(resp.Error + ':\n', err);
                        r.send(event, context, r.FAILED, resp);
                    } else {
                        var changeId = data.ChangeInfo.Id.split('\/')[2];
                        console.log('ChangeId: ' + changeId);
                        resp.ChangeId = changeId;
                        var check = function () {
                            console.log('Polling...');
                            r53.getChange(
                                {
                                    Id: changeId
                                },
                                function (err, data) {
                                    if (err) {
                                        resp.Error = 'changeResourceRecordSets call failed';
                                        console.log(resp.Error + ':\n', err);
                                        r.send(event, context, r.FAILED, resp);
                                    } else {
                                        var status = data.ChangeInfo.Status;
                                        console.log('Status: ' + status);
                                        if (status == 'PENDING') {
                                            setTimeout(check, 3000);
                                        } else {
                                            resp.status = status;
                                            console.log('DONE!');
                                            r.send(event, context, r.SUCCESS, resp);
                                        }
                                    }
                                }
                            );
                        };
                        setTimeout(check, 3000);
                    }
                }
            );
        }
    });
};
