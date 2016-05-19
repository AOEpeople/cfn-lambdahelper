#!/usr/bin/env bash
apt-get update
apt-get install -y apache2
echo "Green" > /var/www/html/index.html