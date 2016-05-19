<?php

require_once __DIR__ . '/../../vendor/autoload.php';

$elbRepository = new \AwsInspector\Model\Elb\Repository();

while (true) {
    $elb = $elbRepository->findElbByName('test-elb');
    $dnsName = $elb->getDNSName();
    $request = trim(@file_get_contents("http://$dnsName/"));
    echo "$request\n";
    foreach ($elb->getInstanceStates() as $instance) {
        echo "{$instance['InstanceId']}: {$instance['State']}\n";
    }
    echo "\n\n";
    sleep(1);
}