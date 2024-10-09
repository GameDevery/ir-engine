#!/bin/bash

if [ -e '../../.icona/icons.json' ]
then
    mv '../../.icona/icons.json' './src/icons/icona.json'
    echo "moved icona json!"
else
    echo "icona file not found"
    exit 1
fi