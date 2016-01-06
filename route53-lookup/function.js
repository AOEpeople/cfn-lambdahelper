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
            resp.Domain = data.HostedZone.Name;
            // Remove trailing . from the domain name
            if (resp.Domain.charAt(resp.Domain.length - 1) == '.') {
                resp.Domain = resp.Domain.substr(0, resp.Domain.length - 1);
            }
            resp.Hostname = rp.Hostname.trim();
            resp.FQDN = resp.Hostname + '.' + resp.Domain;
            console.log('FQDN: ' + resp.FQDN);
            r.send(event, context, r.SUCCESS, resp);
        }
    });
};
